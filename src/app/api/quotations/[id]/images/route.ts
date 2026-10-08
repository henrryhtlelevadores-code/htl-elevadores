import { NextResponse } from "next/server";
import { db, quotationImages, quotations } from "@/db/index";
import { asc, eq } from "drizzle-orm";
import { generateUuid } from "@/lib/uuid";
import { uploadToR2 } from "@/lib/r2";
import { authorizeApi } from "@/features/auth/api";
import { MAX_IMAGE_BYTES, validateImageUpload } from "@/lib/image-validation";

export const dynamic = "force-dynamic";

const MAX_IMAGES_PER_QUOTATION = 4;
const MAX_CAPTION_LENGTH = 200;

async function quotationExists(id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: quotations.id })
    .from(quotations)
    .where(eq(quotations.id, id))
    .limit(1);
  return Boolean(row);
}

const notFound = () =>
  NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });

const tooLarge = () =>
  NextResponse.json({ error: "La imagen supera el tamaño máximo de 5 MB." }, { status: 413 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("quotations:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!(await quotationExists(id))) return notFound();

  const images = await db
    .select()
    .from(quotationImages)
    .where(eq(quotationImages.quotationId, id))
    .orderBy(asc(quotationImages.orderIndex));
  return NextResponse.json({ images });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("quotations:write");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!(await quotationExists(id))) return notFound();

    // Corte temprano por tamaño declarado, antes de leer el cuerpo.
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) return tooLarge();

    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta una imagen válida." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) return tooLarge();

    // El tipo sale de los bytes reales, no del Content-Type ni del nombre.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateImageUpload(bytes);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const existing = await db
      .select({ id: quotationImages.id })
      .from(quotationImages)
      .where(eq(quotationImages.quotationId, id));
    if (existing.length >= MAX_IMAGES_PER_QUOTATION) {
      return NextResponse.json({ error: "Una cotización admite máximo 4 imágenes." }, { status: 400 });
    }

    // Nombre y extensión generados en servidor.
    const imageId = generateUuid();
    const key = `quotations/images/${id}/${imageId}.${validation.image.extension}`;
    const url = await uploadToR2(key, bytes, validation.image.contentType);
    await db.insert(quotationImages).values({
      id: imageId,
      quotationId: id,
      url,
      caption: String(form.get("caption") ?? "").slice(0, MAX_CAPTION_LENGTH) || null,
      orderIndex: existing.length,
      isReferenceOnly: true,
    });
    return NextResponse.json({ success: true, url, id: imageId });
  } catch (error) {
    console.error("Error al subir imagen de cotización:", error);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}

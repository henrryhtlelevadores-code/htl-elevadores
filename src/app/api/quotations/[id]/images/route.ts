import { NextResponse } from "next/server";
import { db, quotationImages } from "@/db/index";
import { eq } from "drizzle-orm";
import { generateUuid } from "@/lib/uuid";
import { uploadToR2 } from "@/lib/r2";
import { getSessionUserId } from "@/features/auth/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;
  const images = await db.select().from(quotationImages).where(eq(quotationImages.quotationId, id));
  return NextResponse.json({ images });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Adjunta una imagen válida." }, { status: 400 });
    }
    const existing = await db
      .select({ id: quotationImages.id })
      .from(quotationImages)
      .where(eq(quotationImages.quotationId, id));
    if (existing.length >= 4) {
      return NextResponse.json({ error: "Una cotización admite máximo 4 imágenes." }, { status: 400 });
    }
    const imageId = generateUuid();
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const key = `quotations/images/${id}/${imageId}.${extension}`;
    const url = await uploadToR2(key, new Uint8Array(await file.arrayBuffer()), file.type);
    await db.insert(quotationImages).values({
      id: imageId,
      quotationId: id,
      url,
      caption: String(form.get("caption") ?? "") || null,
      orderIndex: existing.length,
      isReferenceOnly: true,
    });
    return NextResponse.json({ success: true, url, id: imageId });
  } catch (error) {
    console.error("Error al subir imagen de cotización:", error);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}

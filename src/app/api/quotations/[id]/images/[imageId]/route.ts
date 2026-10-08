import { NextResponse } from "next/server";
import { db, quotationImages } from "@/db/index";
import { and, eq } from "drizzle-orm";
import { deleteR2ObjectByUrl } from "@/lib/r2";
import { authorizeApi } from "@/features/auth/api";

const MAX_CAPTION_LENGTH = 200;

/** La imagen debe pertenecer a la cotización de la URL. */
async function findImage(quotationId: string, imageId: string) {
  const [image] = await db
    .select()
    .from(quotationImages)
    .where(and(eq(quotationImages.id, imageId), eq(quotationImages.quotationId, quotationId)))
    .limit(1);
  return image ?? null;
}

const notFound = () =>
  NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await authorizeApi("quotations:write");
  if (!auth.ok) return auth.response;

  const { id, imageId } = await params;
  if (!(await findImage(id, imageId))) return notFound();

  const body = (await request.json().catch(() => null)) as
    | { caption?: unknown; orderIndex?: unknown }
    | null;
  const caption =
    typeof body?.caption === "string" ? body.caption.slice(0, MAX_CAPTION_LENGTH) || null : null;
  const orderIndex =
    typeof body?.orderIndex === "number" && Number.isInteger(body.orderIndex) && body.orderIndex >= 0
      ? body.orderIndex
      : 0;

  await db
    .update(quotationImages)
    .set({ caption, orderIndex })
    .where(and(eq(quotationImages.id, imageId), eq(quotationImages.quotationId, id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const auth = await authorizeApi("quotations:write");
  if (!auth.ok) return auth.response;

  const { id, imageId } = await params;
  const image = await findImage(id, imageId);
  if (!image) return notFound();

  await db.delete(quotationImages).where(eq(quotationImages.id, imageId));
  try {
    await deleteR2ObjectByUrl(image.url);
  } catch (error) {
    console.warn("No se pudo eliminar imagen de R2:", error);
  }
  return NextResponse.json({ success: true });
}

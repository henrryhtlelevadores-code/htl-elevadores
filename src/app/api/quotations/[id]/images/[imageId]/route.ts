import { NextResponse } from "next/server";
import { db, quotationImages } from "@/db/index";
import { and, eq } from "drizzle-orm";
import { deleteR2ObjectByUrl } from "@/lib/r2";
import { getSessionUserId } from "@/features/auth/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id, imageId } = await params;
  const body = (await request.json()) as { caption?: string; orderIndex?: number };
  await db
    .update(quotationImages)
    .set({ caption: body.caption ?? null, orderIndex: body.orderIndex ?? 0 })
    .where(and(eq(quotationImages.id, imageId), eq(quotationImages.quotationId, id)));
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id, imageId } = await params;
  const [image] = await db
    .select()
    .from(quotationImages)
    .where(and(eq(quotationImages.id, imageId), eq(quotationImages.quotationId, id)))
    .limit(1);
  if (!image) return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  await db.delete(quotationImages).where(eq(quotationImages.id, imageId));
  try {
    await deleteR2ObjectByUrl(image.url);
  } catch (error) {
    console.warn("No se pudo eliminar imagen de R2:", error);
  }
  return NextResponse.json({ success: true });
}

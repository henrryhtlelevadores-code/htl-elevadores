import { NextResponse, type NextRequest } from "next/server";
import { generateAndStoreQuotationPdf } from "@/features/quotations/quotation-pdf-actions";
import { getSessionUserId } from "@/features/auth/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await generateAndStoreQuotationPdf(id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 404 }
    );
  }
  return NextResponse.json({
    success: true,
    url: result.pdfUrl,
    generatedAt: result.generatedAt,
    reused: result.reused,
  });
}

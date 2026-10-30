import { NextResponse } from "next/server";
import { authorizeApi } from "@/features/auth/api";
import { renderWorkOrderReportPdf } from "@/features/reports/pdf";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

function downloadName(request: Request, defaultName: string): string {
  const name = new URL(request.url).searchParams.get("download");
  return (name ? name.slice(0, 120) : defaultName).replace(/[^A-Za-z0-9._-]+/g, "_");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("reports:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const buffer = await renderWorkOrderReportPdf(id);
    const filename = downloadName(request, `Informe_OT_${id}.pdf`);

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar PDF";
    if (message.includes("no encontrado") || message.includes("no ha sido aprobado")) {
      return NextResponse.json({ error: message }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}

import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { authorizeApi } from "@/features/auth/api";
import { buildWorkOrderReportData } from "@/features/clients/work-order-report";
import { WorkOrderReportPDF } from "@/features/clients/components/work-order-report-pdf";
import { getErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/** Reporte PDF de OTs pendientes (con anexo de faenas preventivas). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("clients:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const data = await buildWorkOrderReportData(id);
    if (!data) {
      return NextResponse.json(
        { error: "Sede no encontrada." },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const buffer = await renderToBuffer(
      React.createElement(WorkOrderReportPDF, { data }) as unknown as Parameters<
        typeof renderToBuffer
      >[0]
    );

    const download = new URL(request.url).searchParams.get("download");
    const filename = `Reporte_OTs_${safeFilename(data.costCenterName) || "Sede"}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": download
          ? `attachment; filename="${filename}"`
          : "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar el reporte de OTs:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

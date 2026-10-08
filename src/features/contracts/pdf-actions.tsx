"use server";

import React from "react";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { db, contracts } from "@/db/index";
import { eq } from "drizzle-orm";
import { getErrorMessage } from "@/lib/errors";
import {
  isPrivatePdfStorageConfigured,
  newPrivatePdfKey,
  uploadPrivatePdf,
} from "@/lib/r2";
import { contractPdfPath } from "@/lib/pdf-paths";
import { PreventiveContractPDF } from "./components/preventive-contract-pdf";
import { buildContractTemplateData, buildOverridesSnapshot } from "./template";
import { getContractById } from "./actions";
import { requirePermission } from "@/features/auth/guard";

export interface ContractPdfInput {
  signerName: string;
  signerDocument: string;
  signatureDate: number;
  customClauses: Record<string, string>;
}

async function renderContractPdf(contractId: string, input: ContractPdfInput): Promise<Buffer> {
  const contract = await getContractById(contractId);
  if (!contract) {
    throw new Error("Contrato no encontrado");
  }

  const template = buildContractTemplateData(contract, {
    signerName: input.signerName,
    signerDocument: input.signerDocument,
    signatureDate: input.signatureDate,
    customClauses: input.customClauses,
  });

  return renderToBuffer(
    React.createElement(PreventiveContractPDF, template) as unknown as Parameters<
      typeof renderToBuffer
    >[0]
  );
}

export async function previewContractPdf(contractId: string, input: ContractPdfInput) {
  await requirePermission("contracts:read");
  try {
    const buffer = await renderContractPdf(contractId, input);
    const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
    return { success: true as const, dataUrl };
  } catch (error) {
    console.error("Error al generar vista previa del PDF:", error);
    return { success: false as const, error: getErrorMessage(error) };
  }
}

export async function generateAndLockContractPdf(contractId: string, input: ContractPdfInput) {
  await requirePermission("contracts:write");
  try {
    const contract = await getContractById(contractId);
    if (!contract) {
      return { success: false, error: "Contrato no encontrado" };
    }

    if (contract.documentStatus === "LOCKED" && contract.finalPdfUrl) {
      return {
        success: true,
        message: "El contrato ya fue bloqueado",
        pdfUrl: contract.finalPdfUrl,
      };
    }

    if (!isPrivatePdfStorageConfigured()) {
      return {
        success: false,
        error:
          "El almacenamiento privado de PDFs no está configurado (R2_PRIVATE_BUCKET_NAME).",
      };
    }

    const buffer = await renderContractPdf(contractId, input);

    // Clave aleatoria en el bucket privado: no se deriva del número de contrato.
    const finalPdfKey = newPrivatePdfKey("contracts");
    await uploadPrivatePdf(finalPdfKey, buffer);
    const pdfUrl = contractPdfPath(contractId);

    const template = buildContractTemplateData(contract, {
      signerName: input.signerName,
      signerDocument: input.signerDocument,
      signatureDate: input.signatureDate,
      customClauses: input.customClauses,
    });
    const overridesSnapshot = buildOverridesSnapshot(template, input.customClauses);

    await db
      .update(contracts)
      .set({
        clientSignerName: input.signerName,
        clientSignerDocument: input.signerDocument,
        signatureDate: input.signatureDate,
        documentOverrides: overridesSnapshot,
        documentStatus: "LOCKED",
        finalPdfKey,
      })
      .where(eq(contracts.id, contractId));

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${contractId}`);

    return {
      success: true,
      message: "Contrato bloqueado y PDF generado",
      pdfUrl,
    };
  } catch (error) {
    console.error("Error generando PDF del contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
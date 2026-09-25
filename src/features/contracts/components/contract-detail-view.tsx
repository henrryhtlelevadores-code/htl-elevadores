"use client";

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ContractTemplateData } from "./preventive-contract-pdf";
import { EDITABLE_CLAUSES, resolveClauseText } from "../clause-defaults";
import type { ContractDetail } from "../actions";
import { updateContractDocument } from "../actions";
import { generateAndLockContractPdf, previewContractPdf } from "../pdf-actions";
import { buildContractTemplateData } from "../template";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Download,
  FileText,
  Pencil,
  Loader,
} from "lucide-react";

interface ContractDetailViewProps {
  contract: ContractDetail;
}

export function ContractDetailView({ contract }: ContractDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [signerName, setSignerName] = useState(contract.clientSignerName ?? "");
  const [signerDocument, setSignerDocument] = useState(contract.clientSignerDocument ?? "");
  const [signatureDateStr, setSignatureDateStr] = useState(() => {
    if (contract.signatureDate) {
      const d = new Date(contract.signatureDate * 1000);
      return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [customClauses, setCustomClauses] = useState<Record<string, string>>(
    () => {
      const raw = contract.documentOverrides as Record<string, unknown> | null;
      if (raw && typeof raw === "object" && raw.custom_clauses) {
        return raw.custom_clauses as Record<string, string>;
      }
      return {};
    }
  );
  const [editingClause, setEditingClause] = useState<string | null>(null);
  const [clauseDraft, setClauseDraft] = useState("");

  const isLocked = contract.documentStatus === "LOCKED";

  const signatureDateTs = useMemo(() => {
    if (!signatureDateStr) return contract.signatureDate ?? 0;
    return Math.floor(new Date(signatureDateStr + "T12:00:00").getTime() / 1000);
  }, [signatureDateStr, contract.signatureDate]);

  const templateData = useMemo<ContractTemplateData>(
    () =>
      buildContractTemplateData(contract, {
        signerName,
        signerDocument,
        signatureDate: signatureDateTs,
        customClauses,
      }),
    [contract, signerName, signerDocument, signatureDateTs, customClauses]
  );

  const handleStartEditClause = useCallback(
    (key: string) => {
      setEditingClause(key);
      setClauseDraft(resolveClauseText(customClauses, key, templateData));
    },
    [customClauses, templateData]
  );

  const handleSaveClause = useCallback(() => {
    if (!editingClause) return;
    setCustomClauses((prev) => ({
      ...prev,
      [editingClause]: clauseDraft,
    }));
    setEditingClause(null);
    setClauseDraft("");
  }, [editingClause, clauseDraft]);

  const handleDiscardClause = useCallback(() => {
    setEditingClause(null);
    setClauseDraft("");
  }, []);

  const handleSaveDocument = useCallback(() => {
    startTransition(async () => {
      const ts = signatureDateTs;
      const res = await updateContractDocument(contract.id, {
        clientSignerName: signerName,
        clientSignerDocument: signerDocument,
        signatureDate: ts,
        documentOverrides: { custom_clauses: customClauses },
      });
      if (res.success) {
        toast.success("Documento guardado", { description: res.message });
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }, [contract.id, signerName, signerDocument, signatureDateTs, customClauses]);

  const handleLockAndGeneratePdf = useCallback(() => {
    startTransition(async () => {
      const res = await generateAndLockContractPdf(contract.id, {
        signerName,
        signerDocument,
        signatureDate: signatureDateTs,
        customClauses,
      });

      if (res.success) {
        toast.success("Contrato bloqueado y PDF generado", {
          description: `El PDF está disponible en: ${res.pdfUrl}`,
        });
        router.refresh();
      } else {
        toast.error("Error al bloquear", { description: res.error });
      }
    });
  }, [contract.id, signerName, signerDocument, signatureDateTs, customClauses, router]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);

    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await previewContractPdf(contract.id, {
          signerName,
          signerDocument,
          signatureDate: signatureDateTs,
          customClauses,
        });
        if (!res.success || !res.dataUrl) {
          console.error("Preview PDF failed:", res.error);
        } else {
          const base64 = res.dataUrl.split(",")[1];
          const byteChars = atob(base64);
          const bytes = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            bytes[i] = byteChars.charCodeAt(i);
          }
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = URL.createObjectURL(
            new Blob([bytes], { type: "application/pdf" })
          );
          setPreviewUrl(objectUrlRef.current);
        }
      } catch (err) {
        console.error("Error generando vista previa:", err);
      } finally {
        setPreviewLoading(false);
      }
    }, 600);

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [contract.id, signerName, signerDocument, signatureDateTs, customClauses]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/contracts")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="size-5 text-[#0066CC]" />
              {contract.contractNumber}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contract.cost_center_name} — {contract.service_type_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isLocked
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
            }`}
          >
            {isLocked ? "BLOQUEADO" : "BORRADOR"}
          </span>
          {contract.finalPdfUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(contract.finalPdfUrl!, "_blank")}
              className="text-xs font-semibold gap-2 border-border"
            >
              <Download className="size-3.5" />
              Descargar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* Left panel: Form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Pencil className="size-4 text-[#0066CC]" />
            Datos del Firmante
          </h2>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nombre del Representante</Label>
              <Input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Ej: Juan Pérez López"
                disabled={isLocked}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">DNI del Representante</Label>
              <Input
                value={signerDocument}
                onChange={(e) => setSignerDocument(e.target.value)}
                placeholder="Ej: 12345678"
                disabled={isLocked}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fecha de Firma</Label>
              <DatePicker
                value={signatureDateStr}
                onChange={(v) => setSignatureDateStr(v)}
                disabled={isLocked}
                className="text-xs"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-sm font-bold text-foreground mb-3">
              Cláusulas Editables
            </h2>
            <p className="text-[10px] text-muted-foreground mb-3">
              Haz clic en una cláusula para editarla. Los cambios se reflejan en la vista previa.
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {EDITABLE_CLAUSES.map(({ key, label }) => {
                const isEditing = editingClause === key;
                const hasCustom = !!customClauses[key];
                const currentText = resolveClauseText(customClauses, key, templateData);
                return (
                  <div key={key} className="rounded-lg border border-border bg-background/50 p-2">
                    <button
                      onClick={() => (isEditing ? handleDiscardClause() : handleStartEditClause(key))}
                      disabled={isLocked}
                      className="w-full text-left flex items-center justify-between group"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground">
                        Cláusula {label}
                      </span>
                      <span className="text-[9px] text-muted-foreground group-hover:text-foreground">
                        {isEditing ? "Cancelar" : hasCustom ? "Editar (custom)" : "Editar"}
                      </span>
                    </button>
                    {isEditing && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={clauseDraft}
                          onChange={(e) => setClauseDraft(e.target.value)}
                          rows={4}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] text-foreground resize-y focus-visible:ring-1 focus-visible:ring-[#0066CC] focus:outline-none"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveClause}
                          className="h-6 text-[10px] bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold"
                        >
                          Guardar cláusula
                        </Button>
                      </div>
                    )}
                    {!isEditing && (
                      <p
                        className={`text-[9px] mt-1 truncate ${
                          hasCustom
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }`}
                        title={currentText}
                      >
                        {currentText.slice(0, 90)}
                        {currentText.length > 90 ? "..." : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSaveDocument}
              disabled={isPending || isLocked}
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-2 border-border"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Guardar Cambios
            </Button>
            <Button
              onClick={handleLockAndGeneratePdf}
              disabled={isPending || isLocked || !signerName || !signerDocument}
              size="sm"
              className="text-xs font-semibold gap-2 bg-[#810303] hover:bg-[#6b0202] text-white"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Lock className="size-3.5" />
              )}
              Bloquear y Generar PDF
            </Button>
          </div>
        </div>

        {/* Right panel: Live PDF Preview */}
        <div className="rounded-xl border border-border bg-zinc-100 dark:bg-[#0A0A0A] overflow-hidden">
          <div className="px-4 py-2 border-b border-border dark:border-[#333] flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Vista Previa del Documento
            </span>
            <span className="text-[9px] text-muted-foreground">
              A4 — {templateData.elevatorsCount} equipo(s)
            </span>
          </div>
          <div className="h-[calc(100vh-220px)] relative flex items-center justify-center p-3">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Vista previa del contrato"
                className="w-full h-full bg-white rounded-sm shadow-xl"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {previewLoading ? (
                  <Loader className="size-5 animate-spin" />
                ) : (
                  <span className="text-[10px]">
                    No se pudo generar la vista previa.
                  </span>
                )}
              </div>
            )}
            {previewLoading && previewUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                <Loader className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

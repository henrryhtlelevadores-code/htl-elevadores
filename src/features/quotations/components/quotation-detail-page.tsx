"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { marked } from "marked";
import { generateAndStoreQuotationPdf } from "../quotation-pdf-actions";
import { issueQuotation, updateQuotationDocument, type QuotationDetail } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2, Save, Upload, Trash2 } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { quotationImages } from "@/db/schema";

type QuotationImage = InferSelectModel<typeof quotationImages>;

function MarkdownPreview({ markdown }: { markdown: string }) {
  return <div className="welcome-message preview-content">{marked.lexer(markdown || "").map((token, index) => {
    if (token.type === "space") return null;
    if (token.type === "list") return <ul key={index} className="list-inside list-disc pl-5">{token.items.map((item: { text: string }, itemIndex: number) => <li key={itemIndex}>{item.text}</li>)}</ul>;
    if (token.type === "heading") return <div key={index} className="font-bold">{token.text}</div>;
    return <p key={index}>{"text" in token ? token.text : token.raw}</p>;
  })}</div>;
}

function defaultWelcome(quotation: QuotationDetail) {
  const service = quotation.lines[0]?.description || "servicio de mantenimiento";
  return `Sr. ${quotation.client_name ?? "Cliente"}\n\nEstimados Señores:\n\nMediante la presente hacemos llegar nuestra cotización por ${service}.\n\nInformación Adicional del ${service}\n\n- Tareas realizadas 01\n- Tareas realizadas 02`;
}

export function QuotationDetailPage({
  quotation,
  images,
}: {
  quotation: QuotationDetail;
  images: QuotationImage[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("document");
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl] = useState(quotation.pdfUrl ?? "");
  const [quotationImages, setQuotationImages] = useState(images);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    welcomeMessage: quotation.welcomeMessage ?? defaultWelcome(quotation),
    paymentTerms: quotation.paymentTerms ?? "80% a la aceptación | 20% a la culminación",
    executionTime: quotation.executionTime ?? `Un (01) día por ${quotation.lines[0]?.elevator_name || "equipo"} aproximadamente`,
    workingHours: quotation.workingHours ?? "Diurno / nocturno",
    validityDays: String(quotation.validityDays ?? 15),
  });
  const welcomeRef = useRef<HTMLTextAreaElement>(null);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function insertMarkdown(before: string, after = "") {
    const element = welcomeRef.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const selected = form.welcomeMessage.slice(start, end);
    const value = `${form.welcomeMessage.slice(0, start)}${before}${selected}${after}${form.welcomeMessage.slice(end)}`;
    setField("welcomeMessage", value);
    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + before.length + selected.length + after.length;
      element.setSelectionRange(cursor, cursor);
    });
  }

  function saveDocument() {
    startTransition(async () => {
      const result = await updateQuotationDocument(quotation.id, {
        ...form,
        validityDays: Number(form.validityDays),
      });
      if (result.success) {
        setPdfUrl("");
        toast.success(result.message);
        router.refresh();
      } else toast.error("No se pudo guardar", { description: result.error });
    });
  }

  function generatePdf() {
    startTransition(async () => {
      const result = await generateAndStoreQuotationPdf(quotation.id);
      if (result.success) {
        setPdfUrl(result.pdfUrl);
        toast.success("PDF generado");
      } else toast.error("No se pudo generar el PDF", { description: result.error });
    });
  }

  async function uploadImages(files: FileList | File[]) {
    const incoming = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (quotationImages.length + incoming.length > 4) {
      toast.error("Máximo 4 imágenes por cotización");
      return;
    }
    for (const file of incoming) {
      const tempId = crypto.randomUUID();
      setUploading((current) => new Set(current).add(tempId));
      toast.info("Subiendo imagen...");
      const body = new FormData();
      body.append("image", file);
      try {
        const result = await fetch(`/api/quotations/${quotation.id}/images`, { method: "POST", body });
        const json = await result.json();
        if (!result.ok) throw new Error(json.error ?? "No se pudo subir la imagen");
        toast.success("Imagen subida correctamente");
      } catch (error) {
        toast.error("Error al subir imagen", { description: error instanceof Error ? error.message : undefined });
      } finally {
        setUploading((current) => { const next = new Set(current); next.delete(tempId); return next; });
      }
    }
    const refreshed = await fetch(`/api/quotations/${quotation.id}/images`).then((r) => r.json());
    setQuotationImages(refreshed.images ?? quotationImages);
    router.refresh();
  }

  async function deleteImage(image: QuotationImage) {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    const previous = quotationImages;
    setQuotationImages((current) => current.filter((item) => item.id !== image.id));
    setDeleting((current) => new Set(current).add(image.id));
    toast.info("Eliminando imagen...");
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/images/${image.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar la imagen");
      toast.success("Imagen eliminada");
    } catch (error) {
      setQuotationImages(previous);
      toast.error("Error al eliminar la imagen", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setDeleting((current) => { const next = new Set(current); next.delete(image.id); return next; });
    }
  }

  function emitQuotation() {
    startTransition(async () => {
      const result = await issueQuotation(quotation.id);
      if (result.success) { toast.success(result.message); router.refresh(); }
      else toast.error("No se pudo emitir", { description: result.error });
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button className="mb-2 flex items-center gap-1 text-xs text-muted-foreground" onClick={() => router.push("/quotations")}>
            <ArrowLeft className="size-3.5" /> Cotizaciones
          </button>
          <h1 className="text-xl font-bold">Cotización {quotation.quotationNumber}</h1>
          <p className="text-xs text-muted-foreground">{quotation.cost_center_name ?? "Sin centro de costos"}</p>
        </div>
        <div className="flex items-center gap-2"><Badge variant="outline">{quotation.status === "DRAFT" ? "BORRADOR" : quotation.status}</Badge>{quotation.status === "DRAFT" ? <Button size="sm" onClick={emitQuotation}>Emitir</Button> : null}</div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {["documento", "preview"].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
             className={`border-b-2 px-3 py-2 text-xs font-semibold ${tab === item ? "border-[#810303] text-[#810303]" : "border-transparent text-muted-foreground"}`}
          >
            {item === "lineas" ? "Líneas" : item === "preview" ? "Vista previa" : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "documento" ? (
        <div className="space-y-5 rounded-lg border border-border p-5">
          <div>
             <div className="mb-2 flex gap-2 rounded-t border border-b-0 border-border bg-muted/30 p-2">
              <Button type="button" size="sm" variant="outline" className="px-3 hover:bg-muted" title="Negrita (Ctrl+B)" aria-label="Negrita (Ctrl+B)" onClick={() => insertMarkdown("**", "**")}>B</Button>
              <Button type="button" size="sm" variant="outline" className="px-3 italic hover:bg-muted" title="Cursiva (Ctrl+I)" aria-label="Cursiva (Ctrl+I)" onClick={() => insertMarkdown("*", "*")}>I</Button>
              <Button type="button" size="sm" variant="outline" className="px-3 hover:bg-muted" title="Lista con viñetas" aria-label="Lista con viñetas" onClick={() => insertMarkdown("- ")}>•</Button>
              <Button type="button" size="sm" variant="outline" className="px-3 hover:bg-muted" title="Lista numerada" aria-label="Lista numerada" onClick={() => insertMarkdown("1. ")}>1.</Button>
            </div>
            <Textarea ref={welcomeRef} rows={12} value={form.welcomeMessage} onChange={(e) => setField("welcomeMessage", e.target.value)} placeholder="Escribe la introducción en Markdown..." />
            <p className="mt-1 text-[11px] text-muted-foreground">Markdown: **negrita**, *cursiva* y listas con -.</p>
            <div className="mt-3 rounded border border-border bg-muted/10 p-3 text-sm leading-6"><MarkdownPreview markdown={form.welcomeMessage} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold">Forma de Pago<Textarea rows={2} value={form.paymentTerms} onChange={(e) => setField("paymentTerms", e.target.value)} /></label>
            <label className="text-xs font-semibold">Ejecución<Textarea rows={2} value={form.executionTime} onChange={(e) => setField("executionTime", e.target.value)} /></label>
            <label className="text-xs font-semibold">Horario<Input value={form.workingHours} onChange={(e) => setField("workingHours", e.target.value)} /></label>
            <label className="text-xs font-semibold">Validez (días)<Input type="number" min={1} value={form.validityDays} onChange={(e) => setField("validityDays", e.target.value)} /></label>
          </div>
          <Button onClick={saveDocument} disabled={isPending} className="gap-2"><Save className="size-4" />Guardar cambios</Button>
          <div className="space-y-3"><h2 className="text-sm font-bold">Imágenes referenciales</h2><label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void uploadImages(e.dataTransfer.files); }} className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-xs text-muted-foreground"><Upload className="size-5" />Arrastra imágenes aquí o selecciónalas<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && void uploadImages(e.target.files)} /></label>{uploading.size > 0 ? <div className="flex items-center justify-center gap-2 rounded border border-dashed p-6 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Subiendo...</div> : null}<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{quotationImages.map((image) => <div key={image.id} className="relative overflow-hidden rounded border"><img src={image.url} alt={image.caption ?? "Referencial"} className="aspect-square w-full object-contain bg-muted" /><button type="button" disabled={deleting.has(image.id)} className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-600 disabled:opacity-50" onClick={() => void deleteImage(image)}>{deleting.has(image.id) ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}</button></div>)}</div><p className="text-[11px] text-amber-700">⚠ Sube solo imágenes propias o con permiso del autor. Se marcarán como referenciales.</p></div>
        </div>
      ) : tab === "preview" ? (
        <div className="space-y-3">
          <div className="flex gap-2"><Button onClick={generatePdf} disabled={isPending} className="gap-2">{isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}Generar PDF</Button>{pdfUrl ? <a href={pdfUrl} target="_blank" rel="noopener" className="inline-flex items-center rounded-md border border-border px-3 text-xs font-semibold">Descargar PDF</a> : null}</div>
          {pdfUrl ? <iframe title="Vista previa de cotización" src={pdfUrl} className="h-[760px] w-full rounded-lg border border-border" /> : <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">Genera el PDF para verlo aquí.</div>}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-5 text-sm text-muted-foreground">Este contenido continúa editable desde el popup de cotización. Usa la pestaña Documento para completar la presentación del PDF.</div>
      )}
    </div>
  );
}

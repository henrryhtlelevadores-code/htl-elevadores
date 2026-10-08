"use client";

import { useRef, useState, useTransition } from "react";
import type { ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateAndStoreQuotationPdf } from "../quotation-pdf-actions";
import { issueQuotation, updateQuotationDocument, type QuotationDetail } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Building2, CheckCircle2, FileText, Loader2, Save, Send, Upload, Trash2 } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { quotationImages } from "@/db/schema";

type QuotationImage = InferSelectModel<typeof quotationImages>;

function defaultWelcome(quotation: QuotationDetail) {
  const service = quotation.lines[0]?.description || "servicio de mantenimiento";
  return `Sr. ${quotation.client_name ?? "Cliente"}\n\nEstimados Señores:\n\nMediante la presente hacemos llegar nuestra cotización por ${service}.\n\nInformación Adicional del ${service}\n\n- Tareas realizadas 01\n- Tareas realizadas 02`;
}

const DEFAULT_CLOSE_MESSAGE = "Sabemos lo importante que es el funcionamiento de su ascensor en su edificio. Quedamos a su total disposición para programar la reparación a la brevedad y garantizar la seguridad de todos los usuarios. Sin otro particular, me despido.";

export function QuotationDetailPage({
  quotation,
  images,
}: {
  quotation: QuotationDetail;
  images: QuotationImage[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("documento");
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl] = useState(quotation.pdfUrl ?? "");
  const [quotationImages, setQuotationImages] = useState(images);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");
  const [captionOpen, setCaptionOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuotationImage | null>(null);
  const [emitOpen, setEmitOpen] = useState(false);
  const [form, setForm] = useState({
    welcomeMessage: quotation.welcomeMessage ?? defaultWelcome(quotation),
    closeMessage: quotation.closeMessage ?? DEFAULT_CLOSE_MESSAGE,
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
    const file = incoming[0];
    if (!file) return;
    setCaptionFile(file);
    setCaptionDraft("");
    setCaptionOpen(true);
  }

  async function confirmImageUpload() {
    if (!captionFile) return;
    const file = captionFile;
    setCaptionOpen(false);
    setCaptionFile(null);
    const tempId = crypto.randomUUID();
    setUploading((current) => new Set(current).add(tempId));
    toast.info("Subiendo imagen...");
    const body = new FormData();
    body.append("image", file);
    body.append("caption", captionDraft.trim());
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
    const refreshed = await fetch(`/api/quotations/${quotation.id}/images`).then((r) => r.json());
    setQuotationImages(refreshed.images ?? quotationImages);
    router.refresh();
  }

  function handleImagePaste(event: ClipboardEvent<HTMLElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      event.preventDefault();
      void uploadImages(files);
    }
  }

  async function deleteImage(image: QuotationImage) {
    setDeleteTarget(image);
  }

  async function confirmDeleteImage() {
    const image = deleteTarget;
    setDeleteTarget(null);
    if (!image) return;
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
    setEmitOpen(true);
  }

  function confirmEmit() {
    setEmitOpen(false);
    startTransition(async () => {
      const result = await issueQuotation(quotation.id);
      if (result.success) { toast.success(result.message); router.refresh(); }
      else toast.error("No se pudo emitir", { description: result.error });
    });
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-40 -mx-4 bg-background/95 px-4 pt-1 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="min-w-0">
            <button className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => router.push("/quotations")}>
              <ArrowLeft className="size-3.5" /> Cotizaciones
            </button>
            <h1 className="truncate text-xl font-bold">Cotización {quotation.quotationNumber}</h1>
            <p className="truncate text-xs text-muted-foreground">{quotation.cost_center_name ?? "Sin centro de costos"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline">{quotation.status === "DRAFT" ? "BORRADOR" : quotation.status}</Badge>
            {quotation.status === "DRAFT" ? <Button size="sm" onClick={emitQuotation} className="gap-1.5"><Send className="size-3.5" />Emitir</Button> : null}
            <Button size="sm" disabled={isPending} onClick={saveDocument} className="gap-1.5">
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Guardar cambios
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border">
          {["documento", "preview"].map((item) => (
            <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${tab === item ? "border-[#810303] text-[#810303]" : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"}`}>
              {item === "preview" ? "Vista previa" : "Documento"}
            </button>
          ))}
        </div>
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
             <Textarea ref={welcomeRef} rows={12} className="min-h-[200px] resize-y" value={form.welcomeMessage} onChange={(e) => setField("welcomeMessage", e.target.value)} placeholder="Escribe la introducción en Markdown..." />
          </div>
           <div className="grid gap-3 sm:grid-cols-2">
             <label className="text-xs font-medium">Forma de Pago<Textarea rows={2} className="resize-y" value={form.paymentTerms} onChange={(e) => setField("paymentTerms", e.target.value)} /></label>
             <label className="text-xs font-medium">Ejecución<Textarea rows={2} className="resize-y" value={form.executionTime} onChange={(e) => setField("executionTime", e.target.value)} /></label>
             <label className="text-xs font-medium">Horario<Input value={form.workingHours} onChange={(e) => setField("workingHours", e.target.value)} /></label>
              <label className="text-xs font-medium">Validez (días)<Input type="number" min={1} value={form.validityDays} onChange={(e) => setField("validityDays", e.target.value)} /></label>
           </div>
            <label className="block text-xs font-medium">Mensaje de cierre<Textarea rows={5} className="resize-y" value={form.closeMessage} onChange={(e) => setField("closeMessage", e.target.value)} placeholder="Escribe el mensaje de cierre de la cotización..." /></label>
            <section className="space-y-3 rounded-xl border border-border bg-muted/10 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-medium">Imágenes referenciales</h2><p className="mt-1 text-[11px] text-muted-foreground">Se mostrarán en esta sección del PDF, junto con el comentario de cada imagen.</p></div><button type="button" onClick={() => { setCaptionFile(null); setCaptionDraft(""); setCaptionOpen(true); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void uploadImages(e.dataTransfer.files); }} className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[#0066CC] hover:bg-muted/40 hover:text-foreground"><Upload className="size-4" />Agregar imagen</button></div>{uploading.size > 0 ? <div className="flex items-center gap-2 rounded border border-dashed p-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Subiendo...</div> : null}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{quotationImages.map((image) => <div key={image.id} className="group relative h-32 w-32 overflow-hidden rounded-lg border border-border bg-muted sm:h-36 sm:w-36"><img src={image.url} alt={image.caption ?? "Referencial"} className="size-full object-contain transition duration-200 group-hover:brightness-75" />{image.caption ? <p className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-[10px] text-white">{image.caption}</p> : null}<button type="button" disabled={deleting.has(image.id)} className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 p-3 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 disabled:opacity-50" onClick={() => void deleteImage(image)} aria-label="Eliminar imagen">{deleting.has(image.id) ? <Loader2 className="size-5 animate-spin" /> : <Trash2 className="size-5" />}</button></div>)}</div><p className="text-[11px] text-amber-700">⚠ Puedes pegar una imagen desde el portapapeles dentro de “Agregar imagen”.</p></section>
        </div>
      ) : tab === "preview" ? (
        <div className="space-y-3">
          <div className="flex gap-2"><Button onClick={generatePdf} disabled={isPending} className="gap-2">{isPending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}Generar PDF</Button>{pdfUrl ? <a href={pdfUrl} target="_blank" rel="noopener" className="inline-flex items-center rounded-md border border-border px-3 text-xs font-semibold">Descargar PDF</a> : null}</div>
          {pdfUrl ? <iframe title="Vista previa de cotización" src={pdfUrl} className="h-[760px] w-full rounded-lg border border-border" /> : <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">Genera el PDF para verlo aquí.</div>}
        </div>
      ) : null}

      <Dialog open={captionOpen} onOpenChange={(open) => { if (!open) { setCaptionOpen(false); setCaptionFile(null); } }}>
        <DialogContent onPaste={handleImagePaste}>
          <DialogHeader>
            <DialogTitle>Comentario de la imagen</DialogTitle>
            <DialogDescription>Pega una imagen con Ctrl+V o selecciónala desde un archivo. Luego agrega un comentario opcional.</DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5 text-xs text-muted-foreground hover:bg-muted/40">
            <Upload className="size-4" />
            {captionFile ? captionFile.name : "Seleccionar imagen"}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setCaptionFile(file); }} />
          </label>
          <Textarea autoFocus rows={3} value={captionDraft} onChange={(event) => setCaptionDraft(event.target.value)} placeholder="Ej. Equipo instalado en el acceso principal" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCaptionOpen(false); setCaptionFile(null); }}>Cancelar</Button>
            <Button type="button" disabled={!captionFile} onClick={() => void confirmImageUpload()}>Subir imagen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar imagen</DialogTitle>
            <DialogDescription>¿Seguro que deseas eliminar esta imagen de la cotización?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDeleteImage()}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emitOpen} onOpenChange={setEmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              Emitir cotización
            </DialogTitle>
            <DialogDescription>
              Al emitir, esta cotización cambiará su estado a <strong>SENT</strong> y aparecerá automáticamente en el portal del cliente para su aceptación.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
              {quotation.cost_center_name ?? "Centro de costo"}
            </p>
            <p className="mt-1">Solo se mostrarán las cotizaciones emitidas; las borradores permanecen internas.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmitOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmEmit} disabled={isPending} className="gap-1.5">
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Confirmar emisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

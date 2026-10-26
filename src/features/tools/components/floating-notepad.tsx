"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  NotebookPen,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FloatingWidget } from "./floating-widget";
import { createNote, deleteNote, loadNotes, updateNote } from "../actions";
import type { UserNote } from "../types";

const AUTOSAVE_DELAY = 850;
const NOTE_COLORS = [
  "#ffffff",
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#ffe4e6",
  "#f3e8ff",
];

type SaveState = "idle" | "saving" | "saved" | "error";

interface NoteDraft {
  title: string;
  content: string;
  color: string;
}

interface FloatingNotepadProps {
  isOpen: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FloatingNotepad({
  isOpen,
  onClose,
  onFocus,
  zIndex,
}: FloatingNotepadProps) {
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  /** En ventanas angostas se ve la lista o la nota, no ambas. */
  const [pane, setPane] = useState<"list" | "editor">("list");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const loaded = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const draftRef = useRef<NoteDraft | null>(null);
  const dirtyRef = useRef(false);
  const versionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNote = useCallback(
    async (noteId: string, payload: NoteDraft, version: number) => {
      setSaveState("saving");
      const result = await updateNote({ id: noteId, ...payload });
      if (!result.success) {
        if (selectedIdRef.current === noteId) {
          dirtyRef.current = true;
          setSaveState("error");
        }
        toast.error(result.error);
        return;
      }

      setNotes((previous) =>
        previous.map((note) => (note.id === noteId ? result.data : note))
      );
      if (selectedIdRef.current !== noteId) return;

      if (versionRef.current === version) {
        dirtyRef.current = false;
        setSaveState("saved");
      } else {
        setSaveState("saving");
      }
    },
    []
  );

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const noteId = selectedIdRef.current;
    const payload = draftRef.current;
    if (!dirtyRef.current || !noteId || !payload) return;

    dirtyRef.current = false;
    const version = versionRef.current;
    void persistNote(noteId, payload, version);
  }, [persistNote]);

  const selectNote = useCallback(
    (note: UserNote | null) => {
      if (selectedIdRef.current !== (note?.id ?? null)) flushSave();
      selectedIdRef.current = note?.id ?? null;
      setSelectedId(note?.id ?? null);
      const nextDraft = note
        ? {
            title: note.title,
            content: note.content ?? "",
            color: note.color ?? "#ffffff",
          }
        : null;
      draftRef.current = nextDraft;
      setDraft(nextDraft);
      dirtyRef.current = false;
      versionRef.current = 0;
      setSaveState("idle");
      setConfirmingDelete(false);
    },
    [flushSave]
  );

  function openNote(note: UserNote) {
    selectNote(note);
    setPane("editor");
  }

  useEffect(() => {
    if (!isOpen || loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    let finished = false;

    loadNotes()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          loaded.current = false;
          setLoadError(result.error);
          return;
        }
        setLoadError(null);
        setNotes(result.data);
        selectNote(result.data[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudieron cargar las notas.");
      })
      .finally(() => {
        finished = true;
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      // Si se desmonta antes de responder (p. ej. StrictMode), se vuelve a pedir.
      if (!finished) loaded.current = false;
    };
  }, [isOpen, selectNote]);

  useEffect(() => {
    if (!isOpen || !selectedId || !draft) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushSave();
    }, AUTOSAVE_DELAY);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [draft, flushSave, isOpen, selectedId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function updateDraft(patch: Partial<NoteDraft>) {
    const previous = draftRef.current;
    if (!previous) return;
    const next = { ...previous, ...patch };
    draftRef.current = next;
    setDraft(next);
    dirtyRef.current = true;
    versionRef.current += 1;
  }

  async function handleCreate() {
    flushSave();
    setCreating(true);
    const result = await createNote();
    setCreating(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setNotes((previous) => [result.data, ...previous]);
    openNote(result.data);
    // Listo para escribir el título de inmediato.
    requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
  }

  async function handleDelete() {
    const noteId = selectedIdRef.current;
    if (!noteId || deleting) return;
    setConfirmingDelete(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    setDeleting(true);
    const result = await deleteNote(noteId);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    selectNote(nextNotes[0] ?? null);
    setPane("list");
    toast.success("Nota eliminada.");
  }

  const visibleNotes = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return notes.map((note) => {
      if (note.id !== selectedId || !draft) return note;
      return { ...note, ...draft };
    }).filter((note) => {
      if (!term) return true;
      return (
        note.title.toLocaleLowerCase("es").includes(term) ||
        (note.content ?? "").toLocaleLowerCase("es").includes(term)
      );
    });
  }, [draft, notes, search, selectedId]);

  return (
    <FloatingWidget
      title="Bloc de notas"
      icon={<NotebookPen className="size-4" />}
      isOpen={isOpen}
      onClose={() => {
        flushSave();
        onClose();
      }}
      onFocus={onFocus}
      zIndex={zIndex}
      defaultWidth={720}
      defaultHeight={500}
      minWidth={320}
      minHeight={300}
      offsetIndex={1}
    >
      <div
        className="flex min-h-0 flex-1"
        onKeyDown={(event) => {
          // Ctrl/Cmd + S guarda sin esperar al autoguardado.
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            flushSave();
          }
        }}
      >
        <aside
          className={`flex w-full shrink-0 flex-col bg-muted/20 @min-[520px]:w-56 @min-[520px]:border-r @min-[520px]:border-border ${
            pane === "editor" ? "@max-[519px]:hidden" : ""
          }`}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nota..."
                className="h-8 pl-8 text-xs"
                aria-label="Buscar notas"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Cargando...
              </div>
            ) : loadError ? (
              <p className="px-2 py-4 text-xs text-destructive">{loadError}</p>
            ) : visibleNotes.length === 0 ? (
              <p className="px-2 py-4 text-xs text-muted-foreground">
                {notes.length === 0
                  ? "Todavía no tienes notas."
                  : "No se encontraron notas."}
              </p>
            ) : (
              visibleNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => openNote(note)}
                  className={`mb-1 flex w-full items-start gap-2 rounded-md px-2 py-2.5 text-left transition-colors ${
                    note.id === selectedId
                      ? "bg-background shadow-xs ring-1 ring-border"
                      : "hover:bg-background/70"
                  }`}
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: note.color ?? "#ffffff" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {note.title.trim() || "Sin título"}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {note.content?.trim() || "Nota vacía"}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                      {formatDate(note.updatedAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              Nueva nota
            </Button>
          </div>
        </aside>

        <section
          className={`flex min-w-0 flex-1 flex-col ${pane === "list" ? "@max-[519px]:hidden" : ""}`}
        >
          {draft && selectedId ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-2 @min-[520px]:px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="@min-[520px]:hidden"
                  aria-label="Volver a la lista de notas"
                  onClick={() => {
                    flushSave();
                    setPane("list");
                  }}
                >
                  <ArrowLeft />
                </Button>
                <Input
                  ref={titleRef}
                  value={draft.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  placeholder="Título de la nota"
                  maxLength={200}
                  aria-label="Título de la nota"
                  className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title="Color de la nota"
                      aria-label={`Color ${color}`}
                      aria-pressed={draft.color === color}
                      onClick={() => updateDraft({ color })}
                      className={`size-5 rounded-full border transition-transform hover:scale-110 ${
                        draft.color === color
                          ? "border-foreground ring-2 ring-foreground/20"
                          : "border-black/15 dark:border-white/25"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Textarea
                value={draft.content}
                onChange={(event) => updateDraft({ content: event.target.value })}
                placeholder="Escribe aquí..."
                aria-label="Contenido de la nota"
                maxLength={50_000}
                className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed shadow-none focus-visible:ring-0"
              />

              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                  {saveState === "saving" ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Guardando...
                    </>
                  ) : saveState === "saved" ? (
                    <>
                      <Check className="size-3 text-emerald-600" />
                      Guardado
                    </>
                  ) : saveState === "error" ? (
                    <>
                      <TriangleAlert className="size-3 text-destructive" />
                      Error al guardar
                    </>
                  ) : (
                    <span>Autoguardado activo</span>
                  )}
                  <span className="hidden @min-[420px]:inline">
                    · {formatDate(
                      notes.find((note) => note.id === selectedId)?.updatedAt ?? null
                    )}
                  </span>
                </div>
                {confirmingDelete ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">¿Eliminar nota?</span>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
                      No
                    </Button>
                    <Button type="button" variant="destructive" size="xs" onClick={handleDelete}>
                      Sí, eliminar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Eliminar
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <NotebookPen className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">
                  {loading ? "Cargando notas..." : "Sin nota seleccionada"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Crea una nota rápida para tenerla siempre a mano.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                Nueva nota
              </Button>
            </div>
          )}
        </section>
      </div>
    </FloatingWidget>
  );
}

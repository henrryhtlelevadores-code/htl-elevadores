"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownLeft,
  Delete,
  History as HistoryIcon,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FloatingWidget, useCompactViewport } from "./floating-widget";
import {
  clearCalculatorHistory,
  deleteCalculation,
  loadCalculatorHistory,
  saveCalculation,
} from "../actions";
import type { CalculatorHistoryEntry } from "../types";

type MathModule = typeof import("mathjs");

let mathPromise: Promise<MathModule> | null = null;

/** mathjs pesa bastante: se descarga una sola vez y en cuanto se abre la calculadora. */
function loadMath(): Promise<MathModule> {
  mathPromise ??= import("mathjs");
  return mathPromise;
}

const MAX_EXPRESSION = 300;
const nowMs = () => Date.now();
const HISTORY_SIZE = 30;
const OPERATOR = /^[+\-×÷*/^−]/;

function normalizeExpression(expression: string): string {
  return expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .trim();
}

function formatValue(math: MathModule, value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return math.format(value, { precision: 14 });
}

/** Resultado para mostrar: con separador de miles si es un número simple. */
function displayNumber(raw: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  const [integer, decimals] = raw.split(".");
  const grouped = Number(integer).toLocaleString("es-PE");
  return decimals ? `${grouped}.${decimals}` : grouped;
}

type Evaluation = { ok: true; value: string } | { ok: false } | null;

function evaluate(math: MathModule | null, expression: string): Evaluation {
  const normalized = normalizeExpression(expression);
  if (!math || !normalized) return null;
  try {
    const value = math.evaluate(normalized);
    if (value === undefined || typeof value === "function") return { ok: false };
    return { ok: true, value: formatValue(math, value) };
  } catch {
    return { ok: false };
  }
}

type Key =
  | { label: string; insert: string; tone?: "operator" }
  | { label: string; action: "clear" | "backspace" | "equals" };

const KEYPAD: Key[] = [
  { label: "C", action: "clear" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "÷", insert: "÷", tone: "operator" },
  { label: "7", insert: "7" },
  { label: "8", insert: "8" },
  { label: "9", insert: "9" },
  { label: "×", insert: "×", tone: "operator" },
  { label: "4", insert: "4" },
  { label: "5", insert: "5" },
  { label: "6", insert: "6" },
  { label: "−", insert: "−", tone: "operator" },
  { label: "1", insert: "1" },
  { label: "2", insert: "2" },
  { label: "3", insert: "3" },
  { label: "+", insert: "+", tone: "operator" },
  { label: "0", insert: "0" },
  { label: ".", insert: "." },
  { label: "⌫", action: "backspace" },
  { label: "=", action: "equals" },
];

interface FloatingCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
}

export function FloatingCalculator({ isOpen, onClose, onFocus, zIndex }: FloatingCalculatorProps) {
  const compact = useCompactViewport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [math, setMath] = useState<MathModule | null>(null);
  const [expression, setExpression] = useState("");
  /** Tras "=": la siguiente cifra empieza de cero y un operador continúa desde el resultado. */
  const [evaluated, setEvaluated] = useState<{ expression: string; result: string } | null>(null);
  const [showError, setShowError] = useState(false);
  const [history, setHistory] = useState<CalculatorHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    loadMath()
      .then((module) => {
        if (!cancelled) setMath(() => module);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo cargar la calculadora.");
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || historyLoaded.current) return;
    historyLoaded.current = true;
    let cancelled = false;
    let finished = false;
    loadCalculatorHistory()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          historyLoaded.current = false;
          toast.error(result.error);
          return;
        }
        setHistory(result.data.slice(0, HISTORY_SIZE));
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo cargar el historial.");
      })
      .finally(() => {
        finished = true;
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
      // Si se desmonta antes de responder (p. ej. StrictMode), se vuelve a pedir.
      if (!finished) historyLoaded.current = false;
    };
  }, [isOpen]);

  // Vista previa en vivo: mathjs evalúa en microsegundos, no hace falta esperar.
  const live = useMemo(() => evaluate(math, expression), [math, expression]);

  /** Coloca el cursor en `position` después del próximo render. */
  const placeCaret = useCallback((position: number) => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(position, position);
    });
  }, []);

  /**
   * Texto, cursor y último "=" vigentes. El teclado en pantalla lee de aquí y no
   * del estado de React: así varias pulsaciones seguidas, antes de que se pinte,
   * nunca pierden cifras ni insertan en una posición vieja.
   */
  const editorRef = useRef({ expression: "", start: 0, end: 0 });
  const evaluatedRef = useRef<{ expression: string; result: string } | null>(null);

  function setEvaluatedBoth(value: { expression: string; result: string } | null) {
    evaluatedRef.current = value;
    setEvaluated(value);
  }

  function syncFromInput() {
    const input = inputRef.current;
    if (!input) return;
    editorRef.current = {
      expression: input.value,
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
  }

  function edit(next: string, caret: number) {
    const value = next.slice(0, MAX_EXPRESSION);
    const position = Math.min(caret, value.length);
    editorRef.current = { expression: value, start: position, end: position };
    setExpression(value);
    setEvaluatedBoth(null);
    setShowError(false);
    placeCaret(position);
  }

  /** Inserta en la posición del cursor (o reemplaza la selección). */
  function insert(text: string) {
    const done = evaluatedRef.current;
    if (done) {
      const next = OPERATOR.test(text) ? `${done.result}${text}` : text;
      return edit(next, next.length);
    }
    const { expression: current, start, end } = editorRef.current;
    edit(`${current.slice(0, start)}${text}${current.slice(end)}`, start + text.length);
  }

  function backspace() {
    const done = evaluatedRef.current;
    if (done) return edit(done.expression, done.expression.length);
    const { expression: current, start, end } = editorRef.current;
    if (start !== end) return edit(`${current.slice(0, start)}${current.slice(end)}`, start);
    if (start === 0) return;
    edit(`${current.slice(0, start - 1)}${current.slice(start)}`, start - 1);
  }

  function clear() {
    edit("", 0);
  }

  function equals() {
    const source = (evaluatedRef.current?.expression ?? editorRef.current.expression).trim();
    const outcome = evaluate(math, source);
    if (!outcome) return;
    if (!outcome.ok) {
      setShowError(true);
      return;
    }
    editorRef.current = { expression: source, start: source.length, end: source.length };
    setEvaluatedBoth({ expression: source, result: outcome.value });
    setExpression(source);
    setShowError(false);
    void remember(source, outcome.value);
  }

  /** El historial se actualiza al instante; el guardado va en segundo plano. */
  async function remember(source: string, result: string) {
    const latest = history[0];
    if (latest && latest.expression === source && latest.result === result) return;
    const tempId = `tmp-${nowMs()}`;
    const optimistic: CalculatorHistoryEntry = {
      id: tempId,
      userId: "",
      expression: source,
      result,
      createdAt: Math.floor(nowMs() / 1000),
    };
    setHistory((previous) => [optimistic, ...previous].slice(0, HISTORY_SIZE));
    const saved = await saveCalculation(source, result);
    setHistory((previous) =>
      saved.success
        ? previous.map((entry) => (entry.id === tempId ? saved.data : entry))
        : previous.filter((entry) => entry.id !== tempId)
    );
    if (!saved.success) toast.error(saved.error);
  }

  function pressKey(key: Key) {
    if ("insert" in key) return insert(key.insert);
    if (key.action === "clear") return clear();
    if (key.action === "backspace") return backspace();
    equals();
  }

  function editEntry(entry: CalculatorHistoryEntry) {
    edit(entry.expression, entry.expression.length);
  }

  function insertEntryResult(entry: CalculatorHistoryEntry) {
    insert(entry.result);
  }

  async function removeEntry(entry: CalculatorHistoryEntry) {
    setHistory((previous) => previous.filter((item) => item.id !== entry.id));
    if (entry.id.startsWith("tmp-")) return;
    const result = await deleteCalculation(entry.id);
    if (!result.success) {
      toast.error(result.error);
      setHistory((previous) =>
        [...previous, entry].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      );
    }
  }

  async function clearHistory() {
    if (history.length === 0) return;
    const previous = history;
    setHistory([]);
    const result = await clearCalculatorHistory();
    if (!result.success) {
      toast.error(result.error);
      setHistory(previous);
    }
  }

  async function copyResult(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Resultado copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const resultValue = evaluated?.result ?? (live?.ok ? live.value : "");
  const hasError = showError || (live !== null && !live.ok && !evaluated);

  return (
    <FloatingWidget
      title="Calculadora"
      icon={<Calculator className="size-4" />}
      isOpen={isOpen}
      onClose={onClose}
      onFocus={onFocus}
      zIndex={zIndex}
      defaultWidth={600}
      defaultHeight={520}
      minWidth={300}
      minHeight={440}
      offsetIndex={0}
    >
      <div className="flex min-h-0 flex-1 flex-col @min-[540px]:flex-row">
        {/* Calculadora */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-muted/20 px-4 py-3">
            <input
              ref={inputRef}
              value={expression}
              onChange={(event) => {
                setExpression(event.target.value.slice(0, MAX_EXPRESSION));
                syncFromInput();
                setEvaluatedBoth(null);
                setShowError(false);
              }}
              onSelect={syncFromInput}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "=") {
                  event.preventDefault();
                  equals();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  clear();
                } else if (evaluatedRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                  // Igual que con el teclado en pantalla: seguir desde el resultado o empezar de nuevo.
                  event.preventDefault();
                  insert(event.key === "*" ? "×" : event.key === "/" ? "÷" : event.key);
                }
              }}
              // En el teléfono se usa el teclado de la calculadora, no el del sistema.
              inputMode={compact ? "none" : "decimal"}
              autoComplete="off"
              spellCheck={false}
              placeholder="0"
              aria-label="Operación"
              className="w-full bg-transparent text-right font-mono text-base text-muted-foreground caret-primary outline-none placeholder:text-muted-foreground/50"
            />
            <div className="mt-1 flex min-h-9 items-center justify-end gap-2" aria-live="polite">
              {hasError ? (
                <span className="text-sm font-medium text-destructive">Operación incompleta o inválida</span>
              ) : resultValue ? (
                <>
                  <button
                    type="button"
                    onClick={() => void copyResult(resultValue)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Copiar resultado"
                    title="Copiar resultado"
                  >
                    <Copy className="size-3.5" />
                  </button>
                  <span
                    className={cn(
                      "min-w-0 truncate text-right text-3xl font-semibold tabular-nums tracking-tight",
                      !evaluated && "text-foreground/70"
                    )}
                    title={resultValue}
                  >
                    {evaluated ? "" : "= "}
                    {displayNumber(resultValue)}
                  </span>
                </>
              ) : !math && isOpen ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-4 gap-1.5 p-2.5">
            {KEYPAD.map((key) => {
              const isEquals = "action" in key && key.action === "equals";
              const isClear = "action" in key && key.action === "clear";
              const isOperator = "insert" in key && key.tone === "operator";
              return (
                <Button
                  key={key.label}
                  type="button"
                  variant={isEquals ? "default" : isOperator ? "secondary" : "ghost"}
                  // No roba el foco del campo: el cursor queda donde estaba.
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => pressKey(key)}
                  aria-label={
                    "action" in key && key.action === "backspace" ? "Borrar" : key.label
                  }
                  className={cn(
                    "h-full min-h-11 text-lg transition-transform active:scale-95",
                    isOperator && "text-primary",
                    isEquals && "font-bold",
                    isClear && "text-destructive hover:text-destructive"
                  )}
                >
                  {"action" in key && key.action === "backspace" ? (
                    <Delete className="size-5" />
                  ) : (
                    key.label
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Historial: columna lateral en ventanas anchas, plegable debajo en las angostas */}
        <aside className="flex min-h-0 shrink-0 flex-col border-t border-border @min-[540px]:w-60 @min-[540px]:border-t-0 @min-[540px]:border-l">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground @min-[540px]:pointer-events-none"
              aria-expanded={historyOpen}
            >
              <HistoryIcon className="size-3.5" />
              Historial
              <span className="@min-[540px]:hidden">
                {historyOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </span>
            </button>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="text-[11px] text-muted-foreground transition-colors hover:text-destructive"
              >
                Limpiar
              </button>
            )}
          </div>

          <div
            className={cn(
              "min-h-0 overflow-y-auto border-t border-border px-1.5 py-1.5",
              historyOpen ? "max-h-40 @min-[540px]:max-h-none @min-[540px]:flex-1" : "hidden @min-[540px]:block @min-[540px]:flex-1"
            )}
          >
            {historyLoading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Cargando historial...
              </div>
            ) : history.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                Tus operaciones aparecerán aquí. Puedes volver a editarlas o usar su resultado.
              </p>
            ) : (
              <ul className="space-y-1">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="group rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                  >
                    <button
                      type="button"
                      onClick={() => editEntry(entry)}
                      className="block w-full break-all text-right font-mono text-[11px] leading-snug text-muted-foreground hover:text-foreground"
                      title="Editar esta operación"
                    >
                      {entry.expression}
                    </button>
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <span className="flex items-center gap-0.5 opacity-100 transition-opacity @min-[540px]:opacity-0 @min-[540px]:group-hover:opacity-100 @min-[540px]:group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => editEntry(entry)}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Editar operación"
                          title="Editar operación"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertEntryResult(entry)}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label="Usar resultado en la operación actual"
                          title="Usar resultado"
                        >
                          <CornerDownLeft className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeEntry(entry)}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                          aria-label="Eliminar del historial"
                          title="Eliminar"
                        >
                          {entry.id.startsWith("tmp-") ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <X className="size-3" />
                          )}
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => insertEntryResult(entry)}
                        className="min-w-0 truncate text-right text-sm font-semibold tabular-nums"
                        title="Usar resultado"
                      >
                        = {displayNumber(entry.result)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="hidden border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground @min-[540px]:block">
            Enter calcula · Esc limpia
          </p>
        </aside>
      </div>
    </FloatingWidget>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Delete,
  History as HistoryIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FloatingWidget } from "./floating-widget";
import { loadCalculatorHistory, saveCalculation } from "../actions";
import type { CalculatorHistoryEntry } from "../types";

type MathModule = typeof import("mathjs");

let mathPromise: Promise<MathModule> | null = null;

function loadMath(): Promise<MathModule> {
  mathPromise ??= import("mathjs");
  return mathPromise;
}

function normalizeExpression(expression: string): string {
  return expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .trim();
}

function formatValue(math: MathModule, value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return String(value);
  }
  return math.format(value, { precision: 14 });
}

interface FloatingCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
}

const KEYPAD: Array<{
  label: string;
  value?: string;
  action?: "clear" | "backspace" | "equals";
  variant?: "default" | "secondary" | "ghost" | "destructive";
  className?: string;
  ariaLabel?: string;
}> = [
  { label: "C", action: "clear", variant: "destructive" },
  { label: "(", value: "(" },
  { label: ")", value: ")" },
  { label: "÷", value: "÷", variant: "secondary" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "×", variant: "secondary" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "−", value: "−", variant: "secondary" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+", variant: "secondary" },
  { label: "0", value: "0" },
  { label: ".", value: "." },
  { label: "⌫", action: "backspace", ariaLabel: "Borrar último carácter" },
  { label: "=", action: "equals" },
];

export function FloatingCalculator({
  isOpen,
  onClose,
  onFocus,
  zIndex,
}: FloatingCalculatorProps) {
  const [expression, setExpression] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<CalculatorHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen || historyLoaded.current) return;
    historyLoaded.current = true;
    let cancelled = false;

    loadCalculatorHistory()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          historyLoaded.current = false;
          toast.error(result.error);
          return;
        }
        setHistory(result.data.slice(0, 10));
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeExpression(expression);
    if (!normalized) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      loadMath()
        .then((math) => {
          if (cancelled) return;
          try {
            const value = math.evaluate(normalized);
            setPreview(formatValue(math, value));
          } catch {
            setPreview("");
          }
        })
        .catch(() => {
          if (!cancelled) setPreview("");
        });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [expression, isOpen]);

  function append(token: string) {
    setError(null);
    setPreview("");
    if (justEvaluated) {
      if (/^[+\-×÷)−]/.test(token)) {
        setExpression(`${preview || expression}${token}`);
      } else {
        setExpression(token);
      }
      setJustEvaluated(false);
      return;
    }
    setExpression((previous) => `${previous}${token}`.slice(0, 300));
  }

  function handleClear() {
    setExpression("");
    setPreview("");
    setError(null);
    setJustEvaluated(false);
  }

  function handleBackspace() {
    setExpression((previous) => previous.slice(0, -1));
    setPreview("");
    setError(null);
    setJustEvaluated(false);
  }

  async function handleEquals() {
    const normalized = normalizeExpression(expression);
    if (!normalized || saving) return;

    let formatted: string;
    try {
      const math = await loadMath();
      formatted = formatValue(math, math.evaluate(normalized));
    } catch {
      setError("Operación inválida");
      setPreview("");
      return;
    }

    setPreview(formatted);
    setError(null);
    setJustEvaluated(true);
    setSaving(true);

    try {
      const result = await saveCalculation(expression, formatted);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setHistory((previous) => [result.data, ...previous].slice(0, 10));
    } finally {
      setSaving(false);
    }
  }

  function handleKey(key: (typeof KEYPAD)[number]) {
    if (key.action === "clear") return handleClear();
    if (key.action === "backspace") return handleBackspace();
    if (key.action === "equals") return void handleEquals();
    if (key.value) append(key.value);
  }

  function loadHistoryEntry(entry: CalculatorHistoryEntry) {
    setExpression(entry.expression);
    setPreview(entry.result);
    setError(null);
    setJustEvaluated(false);
  }

  return (
    <FloatingWidget
      title="Calculadora"
      icon={<Calculator className="size-4" />}
      isOpen={isOpen}
      onClose={onClose}
      onFocus={onFocus}
      zIndex={zIndex}
      defaultWidth={420}
      defaultHeight={560}
      minWidth={300}
      minHeight={420}
      offsetIndex={0}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <div className="min-h-5 overflow-x-auto whitespace-nowrap text-right text-xs text-muted-foreground">
            {expression || "0"}
          </div>
          <div
            className="mt-1 min-h-8 overflow-x-auto whitespace-nowrap text-right text-2xl font-semibold tracking-tight"
            aria-live="polite"
          >
            {error ? (
              <span className="text-sm font-medium text-destructive">{error}</span>
            ) : (
              preview
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 p-3">
          {KEYPAD.map((key) => (
            <Button
              key={`${key.label}-${key.action ?? "value"}`}
              type="button"
              variant={key.variant ?? (key.action === "equals" ? "default" : "ghost")}
              className={`h-11 text-base ${
                key.variant === "secondary"
                  ? "text-primary"
                  : key.action === "equals"
                    ? "font-bold"
                    : ""
              }`}
              onClick={() => handleKey(key)}
              aria-label={key.ariaLabel ?? key.label}
              disabled={key.action === "equals" ? saving : false}
            >
              {key.action === "equals" && saving ? (
                <Loader2 className="animate-spin" />
              ) : key.action === "equals" ? (
                "="
              ) : key.action === "backspace" ? (
                <Delete className="size-4" />
              ) : (
                key.label
              )}
            </Button>
          ))}
        </div>

        <div className="mt-auto border-t border-border">
          <button
            type="button"
            onClick={() => setHistoryOpen((previous) => !previous)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            aria-expanded={historyOpen}
          >
            <span className="flex items-center gap-1.5">
              <HistoryIcon className="size-3.5" />
              Historial
            </span>
            {historyOpen ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>

          {historyOpen ? (
            <div className="max-h-36 overflow-y-auto border-t border-border px-2 py-1.5">
              {historyLoading ? (
                <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Cargando historial...
                </div>
              ) : history.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  Aún no hay operaciones guardadas.
                </p>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => loadHistoryEntry(entry)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {entry.expression}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      = {entry.result}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </FloatingWidget>
  );
}

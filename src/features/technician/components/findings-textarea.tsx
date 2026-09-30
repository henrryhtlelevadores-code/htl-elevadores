"use client";

import { toast } from "sonner";
import { Loader2, Mic, MicOff, StickyNote, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  useVoiceInput,
  type VoiceInputError,
} from "../hooks/use-voice-input";

const VOICE_ERRORS: Record<VoiceInputError, [string, string]> = {
  denied: [
    "Permiso de micrófono denegado",
    "Actívalo en la configuración del navegador para usar el dictado.",
  ],
  mic: ["Micrófono no disponible", "Permite el acceso e intenta nuevamente."],
  unsupported: [
    "Reconocimiento de voz no disponible",
    "Este dispositivo no puede ejecutar el dictado por voz.",
  ],
  transcribe: [
    "No se pudo transcribir el audio",
    "Intenta nuevamente y espera unos segundos.",
  ],
};

export function FindingsTextArea({
  value,
  onChange,
  onBlur,
  maxLength = 2000,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  maxLength?: number;
  disabled?: boolean;
}) {
  const voice = useVoiceInput({
    onTranscript: (text) => onChange(text.slice(0, maxLength)),
    onError: (code) => {
      const [title, description] = VOICE_ERRORS[code];
      toast.error(title, { description });
    },
  });

  function handleDictate() {
    if (disabled || voice.isBusy) return;
    if (voice.isListening) {
      voice.stop();
      return;
    }
    voice.start(value);
  }

  function handleClear() {
    if (window.confirm("¿Borrar todo el texto?")) {
      voice.stop();
      onChange("");
    }
  }

  function handleChange(raw: string) {
    if (voice.isListening) {
      voice.stop();
    }
    onChange(raw.slice(0, maxLength));
  }

  const remaining = maxLength - value.length;

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <StickyNote className="size-3.5" />
            Hallazgos del equipo
          </label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Observaciones o notas importantes durante la intervención
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-[10px]",
            remaining < 100
              ? "font-semibold text-red-500"
              : "text-muted-foreground"
          )}
        >
          {value.length}/{maxLength}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Ej: Se observa desgaste en la guía de cabina. Correa del operador con fisuras leves. Sistema de freno funciona correctamente..."
        disabled={disabled}
        rows={6}
        className={cn(
          "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 resize-y",
          voice.isListening
            ? "border-red-500/60 bg-red-500/5"
            : "border-border"
        )}
      />

      {(voice.isListening || voice.isBusy) && (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-red-600 dark:text-red-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          {voice.isBusy ? "Transcribiendo..." : "Escuchando..."}
        </div>
      )}

      <div className="flex items-center gap-2">
        {voice.isSupported ? (
          <Button
            type="button"
            variant={voice.isListening ? "destructive" : "outline"}
            size="sm"
            className="min-h-[40px]"
            onClick={handleDictate}
            disabled={disabled || voice.isBusy}
            aria-label={
              voice.isListening ? "Detener dictado" : "Iniciar dictado"
            }
          >
            {voice.isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : voice.isListening ? (
              <MicOff className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
            {voice.isBusy
              ? "Procesando..."
              : voice.isListening
                ? "Detener"
                : "Dictar"}
          </Button>
        ) : (
          <p className="text-[11px] italic text-muted-foreground/70">
            El dictado por voz no está disponible en este navegador.
          </p>
        )}
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[40px]"
            onClick={handleClear}
            disabled={disabled}
          >
            <Trash2 className="size-4" />
            Borrar todo
          </Button>
        )}
      </div>
    </div>
  );
}
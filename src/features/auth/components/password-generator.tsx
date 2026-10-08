"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generatePasswordAction, type GeneratePasswordInput } from "../password-generator-actions";

type Mode = "word" | "suggested" | "passphrase";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "word", label: "Palabra propia", hint: "Escribe una palabra fácil de recordar y se le añade una parte aleatoria." },
  { id: "suggested", label: "Palabra sugerida", hint: "El sistema elige la palabra y le añade una parte aleatoria." },
  { id: "passphrase", label: "Frase de 4 palabras", hint: "Cuatro palabras al azar más dos dígitos. Larga pero fácil de dictar." },
];

interface PasswordGeneratorProps {
  /** `staff` para personal, `portal` para la credencial de una sede. */
  profile: "staff" | "portal";
  /** Datos del titular: la palabra no puede coincidir con ellos. */
  fullName?: string;
  email?: string;
  /** Se llama cuando el usuario decide usar la contraseña generada. */
  onUse: (password: string) => void;
  className?: string;
}

/**
 * Generador asistido de contraseñas. La contraseña se muestra una sola vez:
 * no se guarda en ningún sitio, así que hay que anotarla antes de cerrar.
 */
export function PasswordGenerator({ profile, fullName, email, onUse, className }: PasswordGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("word");
  const [word, setWord] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setPassword(null);
    setError(null);
    setCopied(false);
  }

  function handleGenerate() {
    const input: GeneratePasswordInput =
      mode === "passphrase"
        ? { mode }
        : mode === "suggested"
          ? { mode, profile, fullName, email }
          : { mode, word: word.trim().toLowerCase(), profile, fullName, email };
    setCopied(false);
    startTransition(async () => {
      const res = await generatePasswordAction(input);
      if (res.success) {
        setPassword(res.password);
        setError(null);
        if (res.word && mode === "suggested") setWord(res.word);
      } else {
        setPassword(null);
        setError(res.error);
      }
    });
  }

  function handleCopy() {
    if (!password) return;
    navigator.clipboard
      .writeText(password)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("No se pudo copiar", { description: "Cópiala manualmente." }));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-[#0066CC] hover:underline", className)}
      >
        <Sparkles className="size-3.5" />
        Generar una contraseña segura
      </button>
    );
  }

  const activeMode = MODES.find((m) => m.id === mode);

  return (
    <div className={cn("space-y-3 rounded-lg border border-border bg-muted/30 p-3", className)}>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => reset(m.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              mode === m.id
                ? "border-[#0066CC] bg-[#0066CC] text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{activeMode?.hint}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {mode === "word" && (
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="Palabra de 4 a 12 letras"
            maxLength={12}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
          />
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleGenerate}
          disabled={isPending || (mode === "word" && word.trim().length < 4)}
          className="gap-2 bg-[#0066CC] text-xs text-white hover:bg-[#0055AA] shrink-0"
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {password ? "Generar otra" : "Generar"}
        </Button>
      </div>

      {error && <p className="text-[11px] font-medium text-red-600 dark:text-red-400">{error}</p>}

      {password && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-foreground">{password}</code>
            <Button type="button" variant="ghost" size="icon-xs" onClick={handleCopy} title="Copiar contraseña">
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            Guárdala ahora. No se puede recuperar.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUse(password)}
            className="w-full text-xs"
          >
            Usar esta contraseña
          </Button>
        </div>
      )}
    </div>
  );
}

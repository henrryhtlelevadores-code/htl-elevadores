"use client";

import * as React from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

/** Dominio corporativo que se completa automáticamente. */
export const EMAIL_DOMAIN = "@htl-elevadores.com";

/**
 * Normaliza lo que el usuario escribe a la parte local del correo: se corta
 * todo desde la primera `@` (así el dominio no se puede escribir a mano, ni
 * completo ni a medias), se quitan los espacios y se pasa a minúsculas.
 */
export function toEmailLocalPart(raw: string): string {
  const at = raw.indexOf("@");
  return (at === -1 ? raw : raw.slice(0, at))
    .replace(/\s/g, "")
    .toLowerCase();
}

/** Extrae la parte local de un correo completo (o de un valor sin dominio). */
export function toLocalPartFromEmail(email: string | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

export interface EmailInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Correo completo (con dominio). Es la única fuente de verdad. */
  value: string;
  /** Recibe el correo completo ya normalizado: `local@htl-elevadores.com` o `""`. */
  onChange: (email: string) => void;
  /** Notifica además la parte local, útil para previsualizaciones. */
  onLocalPartChange?: (localPart: string) => void;
  /** Icono superpuesto dentro del campo, a la izquierda. */
  leadingIcon?: React.ReactNode;
  /** Clases del contenedor (envuelve input + sufijo). */
  containerClassName?: string;
  /** Clases del sufijo con el dominio. */
  suffixClassName?: string;
}

/**
 * Campo de correo que solo muestra la parte local: el dominio
 * `@htl-elevadores.com` se añade siempre y no se puede escribir a mano.
 *
 * El valor que sale por `onChange` ya es el correo completo, por lo que el
 * backend, la validación de Zod y el esquema de `users` no cambian.
 */
export function EmailInput({
  className,
  containerClassName,
  suffixClassName,
  value,
  onChange,
  onLocalPartChange,
  leadingIcon,
  ...props
}: EmailInputProps) {
  const localPart = toLocalPartFromEmail(value);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = toEmailLocalPart(event.target.value);
    onChange(next ? `${next}${EMAIL_DOMAIN}` : "");
    onLocalPartChange?.(next);
  }

  return (
    <div className={cn("relative flex items-stretch", containerClassName)}>
      {leadingIcon ? (
        <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground">
          {leadingIcon}
        </span>
      ) : null}

      <Input
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={localPart}
        onChange={handleChange}
        className={cn(
          "h-11 min-w-0 flex-1 rounded-r-none border-r-0 bg-background font-mono dark:bg-background",
          "focus-visible:ring-1",
          leadingIcon ? "pl-9" : undefined,
          className
        )}
        {...props}
      />

      {/* En móvil el sufijo se oculta: el formulario muestra el correo completo. */}
      <span
        aria-hidden="true"
        className={cn(
          "hidden select-none items-center rounded-r-lg border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground sm:flex",
          suffixClassName
        )}
      >
        {EMAIL_DOMAIN}
      </span>
    </div>
  );
}
"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Calendar } from "@/components/ui/calendar";
import { formatLong, parseIso, toIso, type IsoDate } from "@/lib/date";

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: IsoDate;
  max?: IsoDate;
  locale?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
  name?: string;
}

function formatDisplay(iso: string, locale: string): string {
  const date = parseIso(iso);
  if (!date) return "";
  return formatLong(date, locale);
}

/**
 * Selector de fecha con popover y calendario en cascada (Año → Mes → Día),
 * mismo look & feel que el resto del formulario.
 *
 * Mantiene el contrato de `<Input type="date">`: `value` y `onChange` reciben
 * una cadena en formato `YYYY-MM-DD` (string vacío si se limpia).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled,
  min,
  max,
  locale = "es-PE",
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  name,
}: DatePickerProps) {
  const display = value ? formatDisplay(value, locale) : "";
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <Popover.Root>
      <div className="relative w-full">
        <Popover.Trigger
          ref={triggerRef}
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          name={name}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50",
            !display && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
            {display || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpiar fecha"
                title="Limpiar"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange("");
                  triggerRef.current?.focus();
                }}
                className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </span>
            ) : null}
            <CalendarIcon className="size-4 text-muted-foreground" />
          </div>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="isolate z-50">
          <Popover.Popup
            className="rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-md duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <Calendar
              value={value || null}
              onChange={(iso) => {
                onChange(iso);
                if (iso) triggerRef.current?.click();
              }}
              locale={locale}
              min={min}
              max={max}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { ClockIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { ClockHours } from "@/components/ui/clock-hours";
import {
  formatHourValue,
  isHourOfDay,
  parseHourInput,
  toHourValue,
  type IsoHour,
} from "@/lib/date";

export interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  locale?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  className?: string;
  name?: string;
}

function safeFormatHour(value: string): string {
  if (!value) return "";
  if (isHourOfDay(value)) return formatHourValue(value);
  // Compatibilidad: si vienen minutos distintos de :00, redondeamos hacia abajo.
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value);
  if (!match) return "";
  const hour = Number(match[1]);
  return toHourValue(hour);
}

/**
 * Selector de hora en punto (HH:00) con popover.
 * Mismo contrato que <input type="time">: value y onChange reciben string HH:MM.
 * Por ahora solo se aceptan horas en punto (HH:00) para coincidir con la regla de
 * negocio del cliente; el resto del flujo sigue funcionando cuando se agreguen
 * minutos, ya que el parse acepta HH:MM.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "HH:MM",
  disabled,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  name,
}: TimePickerProps) {
  const display = safeFormatHour(value);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [inputValue, setInputValue] = React.useState(display);

  React.useEffect(() => {
    setInputValue(display);
  }, [display]);

  function commitInput(raw: string) {
    const parsed = parseHourInput(raw);
    if (parsed) {
      onChange(parsed);
      setInputValue(formatHourValue(parsed));
    } else {
      setInputValue(display);
    }
  }

  function pickHour(iso: IsoHour) {
    onChange(iso);
    triggerRef.current?.click();
  }

  function pickNow() {
    const now = new Date().getHours();
    const iso = toHourValue(now);
    onChange(iso);
    setInputValue(formatHourValue(iso));
  }

  function clear() {
    onChange("");
    setInputValue("");
    triggerRef.current?.focus();
  }

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
          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left font-mono">
            {display || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpiar hora"
                title="Limpiar"
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  clear();
                }}
                className="flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </span>
            ) : null}
            <ClockIcon className="size-4 text-muted-foreground" />
          </div>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="isolate z-50">
          <Popover.Popup
            className="rounded-xl bg-popover text-popover-foreground ring-1 ring-foreground/10 shadow-md duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="w-[280px] p-2 select-none">
              <div className="animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 pt-1 pb-2 flex items-center gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hora
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onBlur={(event) => commitInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitInput(event.currentTarget.value);
                        triggerRef.current?.click();
                      }
                    }}
                    placeholder="HH:00"
                    className="ml-auto h-7 w-20 rounded-md border border-input bg-background px-2 text-xs font-mono font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40"
                  />
                </div>
                <div className="px-1 pb-2">
                  <ClockHours
                    value={isHourOfDay(value) ? value : null}
                    onChange={pickHour}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between px-2 pt-1 border-t border-border/60">
                  <button
                    type="button"
                    onClick={pickNow}
                    className="text-[10px] font-semibold uppercase tracking-wide text-[#0066CC] hover:underline"
                  >
                    Ahora
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

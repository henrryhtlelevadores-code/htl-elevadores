"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import {
  addMonths,
  addYears,
  formatMonthYear,
  getMonthMatrix,
  getYearRange,
  isBetween,
  isSameDay,
  parseIso,
  startOfMonth,
  toIso,
  weekDayHeaders,
  type IsoDate,
} from "@/lib/date";

type View = "days" | "months" | "years";

interface CalendarProps {
  value: IsoDate | null;
  onChange: (iso: IsoDate) => void;
  locale?: string;
  min?: IsoDate;
  max?: IsoDate;
  initialMonth?: Date;
}

function useFocusManagement(active: boolean) {
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!active) return;
    const grid = gridRef.current;
    if (!grid) return;
    const target =
      (grid.querySelector<HTMLElement>("[data-today='true']") as HTMLElement | null) ??
      (grid.querySelector<HTMLElement>("[data-selected='true']") as HTMLElement | null) ??
      (grid.querySelector<HTMLElement>("[data-in-month='true']") as HTMLElement | null);
    target?.focus();
  }, [active]);
  return gridRef;
}

function NavButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="size-7 inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40"
    >
      {label.includes("anterior") ? (
        <ChevronLeftIcon className="size-3.5" />
      ) : (
        <ChevronRightIcon className="size-3.5" />
      )}
    </button>
  );
}

export function Calendar({
  value,
  onChange,
  locale = "es-PE",
  min,
  max,
  initialMonth,
}: CalendarProps) {
  const selected = React.useMemo(() => parseIso(value), [value]);
  const today = React.useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [view, setView] = React.useState<View>("days");
  const [cursor, setCursor] = React.useState<Date>(
    () => initialMonth ?? selected ?? today
  );

  React.useEffect(() => {
    if (selected && !isSameDay(selected, cursor) && view === "days") {
      // sync only when the visible month is wrong.
      if (
        selected.getFullYear() !== cursor.getFullYear() ||
        selected.getMonth() !== cursor.getMonth()
      ) {
        setCursor(startOfMonth(selected.getFullYear(), selected.getMonth()));
      }
    }
  }, [selected, cursor, view]);

  const daysRef = useFocusManagement(view === "days");

  const weekdayHeaders = React.useMemo(() => weekDayHeaders(locale), [locale]);
  const monthMatrix = React.useMemo(
    () => getMonthMatrix(cursor.getFullYear(), cursor.getMonth(), today),
    [cursor, today]
  );
  const monthNames = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short" });
    return Array.from({ length: 12 }, (_, i) =>
      fmt
        .format(new Date(2024, i, 1))
        .replace(".", "")
        .replace(/^./, (c) => c.toUpperCase())
    );
  }, [locale]);

  const yearRange = React.useMemo(
    () => getYearRange(cursor.getFullYear(), 5),
    [cursor]
  );

  function pickDay(iso: IsoDate) {
    onChange(iso);
  }

  function handleDaysKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (view !== "days") return;
    const current = selected ?? new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    let next: Date | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = new Date(current.getTime() - 86_400_000);
        break;
      case "ArrowRight":
        next = new Date(current.getTime() + 86_400_000);
        break;
      case "ArrowUp":
        next = new Date(current.getTime() - 7 * 86_400_000);
        break;
      case "ArrowDown":
        next = new Date(current.getTime() + 7 * 86_400_000);
        break;
      case "PageUp":
        next = addMonths(current, -1);
        break;
      case "PageDown":
        next = addMonths(current, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (!next) return;
    setCursor(startOfMonth(next.getFullYear(), next.getMonth()));
    if (isBetween(next, min, max)) onChange(toIso(next));
  }

  return (
    <div className="w-[280px] p-2 select-none">
      <div className="flex items-center justify-between gap-1 px-1 pb-2">
        <NavButton label="Mes anterior" onClick={() => setCursor(addMonths(cursor, -1))} />
        <button
          type="button"
          onClick={() => setView(view === "days" ? "years" : "days")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40"
        >
          {formatMonthYear(cursor, locale)}
          <ChevronRightIcon
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              view !== "days" && "rotate-90"
            )}
          />
        </button>
        <NavButton label="Mes siguiente" onClick={() => setCursor(addMonths(cursor, 1))} />
      </div>

      {view === "days" ? (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-7 gap-0.5 px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {weekdayHeaders.map((label) => (
              <div key={label} className="py-1">
                {label.slice(0, 3)}
              </div>
            ))}
          </div>
          <div
            ref={daysRef}
            role="grid"
            tabIndex={0}
            onKeyDown={handleDaysKeyDown}
            className="grid grid-cols-7 gap-0.5 px-1 outline-none"
          >
            {monthMatrix.flat().map((cell) => {
              const isSelected = selected ? isSameDay(cell.date, selected) : false;
              const disabled = !isBetween(cell.date, min, max);
              return (
                <button
                  type="button"
                  key={cell.iso}
                  role="gridcell"
                  data-in-month={cell.inCurrentMonth}
                  data-selected={isSelected}
                  data-today={cell.isToday}
                  disabled={disabled}
                  onClick={() => !disabled && pickDay(cell.iso)}
                  className={cn(
                    "h-8 rounded-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40",
                    !cell.inCurrentMonth && "text-muted-foreground/60",
                    cell.inCurrentMonth && "text-foreground hover:bg-muted/60",
                    cell.isToday && !isSelected && "font-semibold text-[#0066CC]",
                    isSelected &&
                      "bg-[#0066CC] text-white font-semibold hover:bg-[#0055AA]",
                    disabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                if (!isBetween(today, min, max)) return;
                onChange(toIso(today));
                setCursor(today);
              }}
              className="text-[10px] font-semibold uppercase tracking-wide text-[#0066CC] hover:underline"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </button>
          </div>
        </div>
      ) : view === "months" ? (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-3 gap-1 p-1">
            {monthNames.map((name, idx) => {
              const target = new Date(cursor.getFullYear(), idx, 1);
              const disabled = !isBetween(target, min, max);
              const isSelected =
                !!selected &&
                selected.getFullYear() === cursor.getFullYear() &&
                selected.getMonth() === idx;
              return (
                <button
                  type="button"
                  key={name}
                  disabled={disabled}
                  onClick={() => {
                    setCursor(target);
                    setView("days");
                  }}
                  className={cn(
                    "h-9 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40",
                    !disabled && "hover:bg-muted/60 text-foreground",
                    isSelected && "bg-[#0066CC]/10 text-[#0066CC]",
                    disabled && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center px-1 pt-1">
            <button
              type="button"
              onClick={() => setView("years")}
              className="text-[10px] font-semibold uppercase tracking-wide text-[#0066CC] hover:underline"
            >
              {cursor.getFullYear()}
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-150">
          <div className="grid grid-cols-3 gap-1 p-1">
            {yearRange.map((year) => {
              const target = new Date(year, cursor.getMonth(), 1);
              const inRange = isBetween(target, min, max);
              const isSelected =
                !!selected && selected.getFullYear() === year;
              return (
                <button
                  type="button"
                  key={year}
                  disabled={!inRange}
                  onClick={() => {
                    setCursor(target);
                    setView("months");
                  }}
                  className={cn(
                    "h-9 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40",
                    inRange && "hover:bg-muted/60 text-foreground",
                    isSelected && "bg-[#0066CC]/10 text-[#0066CC]",
                    !inRange && "opacity-30 cursor-not-allowed"
                  )}
                >
                  {year}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-2 px-1 pt-1">
            <button
              type="button"
              onClick={() => setCursor(addYears(cursor, -10))}
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              −10 años
            </button>
            <button
              type="button"
              onClick={() => setCursor(addYears(cursor, 10))}
              className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              +10 años
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

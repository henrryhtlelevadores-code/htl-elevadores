"use client";

import * as React from "react";
import { cn } from "cn";
import { isHourOfDay, type IsoHour } from "@/lib/date";

interface ClockHoursProps {
  value: IsoHour | null;
  onChange: (value: IsoHour) => void;
  disabled?: boolean;
}

const COLUMNS = 4;
const ROWS = 6;

export function ClockHours({ value, onChange, disabled }: ClockHoursProps) {
  const hours = React.useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < 24; i++) list.push(i);
    return list;
  }, []);

  const currentHour = React.useMemo(() => new Date().getHours(), []);
  const selectedHour = React.useMemo(() => {
    if (!value || !isHourOfDay(value)) return null;
    return Number(value.split(":")[0]);
  }, [value]);

  const gridRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const target =
      (grid.querySelector<HTMLElement>("[data-selected='true']") as HTMLElement | null) ??
      (grid.querySelector<HTMLElement>(`[data-hour='${currentHour}']`) as HTMLElement | null);
    target?.focus();
  }, [currentHour]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const hourAttr = target.getAttribute("data-hour");
    if (hourAttr === null) return;
    const base = Number(hourAttr);
    let next = base;
    switch (event.key) {
      case "ArrowLeft":
        next = base - 1;
        break;
      case "ArrowRight":
        next = base + 1;
        break;
      case "ArrowUp":
        next = base - COLUMNS;
        break;
      case "ArrowDown":
        next = base + COLUMNS;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 23;
        break;
      default:
        return;
    }
    event.preventDefault();
    const wrapped = ((next % 24) + 24) % 24;
    const node = gridRef.current?.querySelector<HTMLElement>(
      `[data-hour='${wrapped}']`
    );
    node?.focus();
  }

  return (
    <div
      ref={gridRef}
      role="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Horas disponibles"
      className="grid grid-cols-4 gap-1.5 outline-none"
      style={{
        gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
      }}
    >
      {hours.map((hour) => {
        const iso = `${String(hour).padStart(2, "0")}:00` as IsoHour;
        const isSelected = selectedHour === hour;
        const isNow = hour === currentHour;
        return (
          <button
            type="button"
            key={hour}
            role="option"
            aria-selected={isSelected}
            data-hour={hour}
            data-selected={isSelected}
            disabled={disabled}
            onClick={() => onChange(iso)}
            className={cn(
              "h-10 rounded-md border border-transparent font-mono text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]/40",
              !isSelected && "text-foreground hover:bg-muted/60",
              isNow && !isSelected && "border-[#0066CC]/40 text-[#0066CC]",
              isSelected && "bg-[#0066CC] text-white hover:bg-[#0055AA]",
              disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
            )}
          >
            {String(hour).padStart(2, "0")}:00
          </button>
        );
      })}
    </div>
  );
}

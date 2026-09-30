import { dateFromISO, formatShortDay, isSameDay } from "../lib/dates";
import { Check } from "lucide-react";
import { cn } from "cn";

export function DateCarousel({
  days,
  selectedDate,
  counts,
  onSelect,
}: {
  days: string[];
  selectedDate: string | null;
  counts: Map<string, number>;
  onSelect: (iso: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Días con órdenes"
      className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory sm:-mx-6 sm:px-6"
    >
      <div className="flex w-max gap-2">
        {days.map((iso) => {
          const date = dateFromISO(iso);
          const count = counts.get(iso) ?? 0;
          const isSelected = selectedDate === iso;
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={iso}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelect(iso)}
              className={cn(
                "relative flex w-14 shrink-0 snap-center flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 transition-colors",
                isSelected
                  ? "border-transparent bg-[#0066CC] text-white shadow-md"
                  : isToday
                    ? "border-[#0066CC]/40 bg-[#0066CC]/5 text-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide",
                  isSelected
                    ? "text-white/80"
                    : isToday
                      ? "text-[#0066CC]"
                      : "text-muted-foreground"
                )}
              >
                {formatShortDay(date)}
              </span>
              <span className="text-base font-black leading-none">
                {date.getDate()}
              </span>

              {isToday && (
                <span className="text-[8px] font-black uppercase tracking-wider">
                  Hoy
                </span>
              )}

              {count > 0 ? (
                <span
                  className={cn(
                    "absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-black",
                    isSelected
                      ? "bg-white text-[#0066CC]"
                      : "bg-[#0066CC] text-white"
                  )}
                >
                  {count}
                </span>
              ) : (
                <span className="pt-3" aria-hidden />
              )}

              {isSelected && (
                <span className="mt-0.5 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide text-white/80">
                  <Check className="size-2.5" />
                  Ver
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
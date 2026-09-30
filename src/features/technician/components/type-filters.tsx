import { cn } from "cn";
import { X } from "lucide-react";

export type TypeFilterOption = {
  code: string;
  label: string;
};

const OPTION_STYLES: Record<string, string> = {
  PREV: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  CORR: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  EMERG: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

export function TypeFilters({
  options,
  selected,
  onToggle,
}: {
  options: TypeFilterOption[];
  selected: Set<string>;
  onToggle: (code: string) => void;
}) {
  if (options.length <= 1) return null;

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6">
      {options.map((option) => {
        const isSelected = selected.has(option.code);
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option.code)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
              isSelected
                ? OPTION_STYLES[option.code] ?? "border-[#0066CC]/40 bg-[#0066CC]/10 text-[#0066CC]"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {isSelected && <X className="size-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
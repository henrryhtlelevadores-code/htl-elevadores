"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { SearchIcon, XIcon } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValueTrigger,
} from "@/components/ui/combobox";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type CreateItemsData<Item> = Parameters<
  typeof ComboboxPrimitive.createItems<Item, string>
>[0];

export interface SearchableSelectProps<Item> {
  items: readonly Item[];
  value: string;
  onValueChange: (value: string) => void;
  getLabel: (item: Item) => string;
  getValue: (item: Item) => string;
  /** Texto adicional usado solo para buscar (RUC, dirección, cliente, etc.). */
  getKeywords?: (item: Item) => string | null | undefined;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  renderItem?: (item: Item) => React.ReactNode;
  /** Muestra botón para limpiar la selección. */
  allowClear?: boolean;
  /** Texto del trigger cuando no hay selección (solo con allowClear). */
  clearLabel?: string;
  /** Props del trigger; se rellenan automáticamente desde FormControl. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

/**
 * Select con búsqueda integrated. Usa el mismo patrón que el selector de ubigeos:
 * popup con input de búsqueda pegado arriba, filtro por todos los términos escritos
 * (sin distinguir mayúsculas ni acentos) y navegación por teclado.
 */
export function SearchableSelect<Item>({
  items,
  value,
  onValueChange,
  getLabel,
  getValue,
  getKeywords,
  placeholder = "Seleccionar",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  disabled,
  className,
  contentClassName,
  renderItem,
  allowClear,
  clearLabel,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SearchableSelectProps<Item>) {
  const collection = React.useMemo(
    () =>
      ComboboxPrimitive.createItems<Item, string>(items as CreateItemsData<Item>, {
        getValue,
        getLabel,
      }),
    [items, getValue, getLabel]
  );

  const getSearchableText = React.useCallback(
    (item: Item) => normalize([getLabel(item), getKeywords?.(item) ?? ""].join(" ")),
    [getLabel, getKeywords]
  );

  const filter = React.useCallback(
    (item: Item, query: string) => {
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      if (terms.length === 0) return true;
      const haystack = getSearchableText(item);
      return terms.every((term) => haystack.includes(term));
    },
    [getSearchableText]
  );

  const selected = React.useMemo(
    () => items.find((item) => getValue(item) === value) ?? null,
    [items, getValue, value]
  );

  const triggerLabel = selected ? getLabel(selected) : (clearLabel ?? null);

  return (
    <Combobox<string, false, Item>
      items={collection}
      value={value ? value : null}
      filter={filter}
      autoHighlight
      openOnInputClick
      disabled={disabled}
      onValueChange={(val) => onValueChange((val as string | null) ?? "")}
    >
      <div className="relative w-full min-w-0">
        <ComboboxValueTrigger
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={
            "w-full min-w-0 overflow-hidden bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC] aria-invalid:border-destructive" +
            (allowClear && value ? " pr-14" : " pr-8") +
            (className ? ` ${className}` : "")
          }
        >
          <span
            className={triggerLabel ? "min-w-0 truncate" : "min-w-0 truncate text-muted-foreground"}
            title={triggerLabel ?? undefined}
          >
            {triggerLabel ?? placeholder}
          </span>
        </ComboboxValueTrigger>
        {allowClear && value ? (
          <button
            type="button"
            aria-label="Limpiar selección"
            title="Limpiar selección"
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onValueChange("");
            }}
            className="absolute top-1/2 right-7 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </div>

      <ComboboxContent className={contentClassName ?? "max-w-[min(420px,calc(100vw-2rem))]"}>
        <div className="sticky top-0 z-10 border-b border-border bg-popover px-1.5 pt-1.5 pb-1.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <ComboboxInput
              placeholder={searchPlaceholder}
              className="h-7 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus-visible:ring-0"
            />
          </div>
        </div>
        <ComboboxList>
          {(item: Item) => (
            <ComboboxItem key={getValue(item)} value={getValue(item)} className="text-xs py-1.5">
              <span className="min-w-0 truncate">{renderItem ? renderItem(item) : getLabel(item)}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty className="px-2 py-4 text-center text-xs">{emptyText}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}

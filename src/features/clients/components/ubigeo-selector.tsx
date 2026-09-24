"use client";

import { useMemo, useState } from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { SearchIcon } from "lucide-react";
import { type Ubigeo } from "@/db";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValueTrigger,
} from "@/components/ui/combobox";

interface UbigeoSelectorProps {
  ubigeos: Ubigeo[];
  value: string | undefined;
  onChange: (id: string) => void;
}

interface Draft {
  departamento: string;
  provincia: string;
}

function SearchableList({
  placeholder,
  children,
}: {
  placeholder: string;
  children: React.ReactNode | ((item: string, index: number) => React.ReactNode);
}) {
  return (
    <ComboboxContent>
      <div className="sticky top-0 z-10 border-b border-border bg-popover px-1.5 pt-1.5 pb-1.5">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <ComboboxInput
            placeholder={placeholder}
            className="h-7 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus-visible:ring-0"
          />
        </div>
      </div>
      <ComboboxList>{children}</ComboboxList>
      <ComboboxEmpty>Sin resultados</ComboboxEmpty>
    </ComboboxContent>
  );
}

export function UbigeoSelector({ ubigeos, value, onChange }: UbigeoSelectorProps) {
  const effectiveValue = value ?? "";
  const selected = ubigeos.find((u) => u.id === effectiveValue) ?? null;

  const [draft, setDraft] = useState<Draft>({
    departamento: selected?.departamento ?? "",
    provincia: selected?.provincia ?? "",
  });
  const [lastValue, setLastValue] = useState(effectiveValue);

  if (lastValue !== effectiveValue) {
    setLastValue(effectiveValue);
    setDraft({
      departamento: selected?.departamento ?? "",
      provincia: selected?.provincia ?? "",
    });
  }

  const departamentos = useMemo(
    () => Array.from(new Set(ubigeos.map((u) => u.departamento))).sort(),
    [ubigeos]
  );

  const provincias = useMemo(() => {
    if (!draft.departamento) return [];
    return Array.from(
      new Set(
        ubigeos.filter((u) => u.departamento === draft.departamento).map((u) => u.provincia)
      )
    ).sort();
  }, [ubigeos, draft.departamento]);

  const distritos = useMemo(() => {
    if (!draft.departamento || !draft.provincia) return [];
    return ubigeos
      .filter((u) => u.departamento === draft.departamento && u.provincia === draft.provincia)
      .sort((a, b) => a.distrito.localeCompare(b.distrito));
  }, [ubigeos, draft.departamento, draft.provincia]);

  const distritoItems = useMemo(
    () => ComboboxPrimitive.createItems(distritos, { getValue: (u) => u.id, getLabel: (u) => u.distrito }),
    [distritos]
  );

  if (ubigeos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        No hay ubigeos registrados. Agrégalos desde la sección Tablas Maestras &rarr; Ubigeos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Departamento</label>
        <Combobox<string>
          items={departamentos}
          value={draft.departamento || null}
          defaultInputValue=""
          autoHighlight
          onValueChange={(val) => {
            setDraft({ departamento: val ?? "", provincia: "" });
            onChange("");
          }}
        >
          <ComboboxValueTrigger>{draft.departamento || "Seleccionar"}</ComboboxValueTrigger>
          <SearchableList placeholder="Buscar departamento...">
            {(d: string) => (
              <ComboboxItem key={d} value={d}>
                {d}
              </ComboboxItem>
            )}
          </SearchableList>
        </Combobox>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Provincia</label>
        <Combobox<string>
          items={provincias}
          value={draft.provincia || null}
          defaultInputValue=""
          autoHighlight
          disabled={!draft.departamento}
          onValueChange={(val) => {
            setDraft((prev) => ({ ...prev, provincia: val ?? "" }));
            onChange("");
          }}
        >
          <ComboboxValueTrigger>{draft.provincia || "Seleccionar"}</ComboboxValueTrigger>
          <SearchableList placeholder="Buscar provincia...">
            {(p: string) => (
              <ComboboxItem key={p} value={p}>
                {p}
              </ComboboxItem>
            )}
          </SearchableList>
        </Combobox>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Distrito</label>
        <Combobox<string, false, Ubigeo>
          items={distritoItems}
          value={distritos.some((u) => u.id === effectiveValue) ? effectiveValue : null}
          defaultInputValue=""
          autoHighlight
          disabled={!draft.provincia}
          onValueChange={(val) => onChange(val ?? "")}
        >
          <ComboboxValueTrigger>{selected?.distrito || "Seleccionar"}</ComboboxValueTrigger>
          <ComboboxContent>
            <div className="sticky top-0 z-10 border-b border-border bg-popover px-1.5 pt-1.5 pb-1.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <ComboboxInput
                  placeholder="Buscar distrito..."
                  className="h-7 rounded-md border border-input bg-background pl-7 pr-2 text-xs focus-visible:ring-0"
                />
              </div>
            </div>
            <ComboboxList>
              {(u: Ubigeo) => (
                <ComboboxItem key={u.id} value={u.id}>
                  {u.distrito}
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxEmpty>Sin resultados</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
}
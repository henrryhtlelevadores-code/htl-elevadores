"use client";

import { useMemo, useState } from "react";
import { type Ubigeo } from "@/db";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface UbigeoSelectorProps {
  ubigeos: Ubigeo[];
  value: string | undefined;
  onChange: (id: string) => void;
}

interface Draft {
  departamento: string;
  provincia: string;
}

interface FieldProps {
  label: string;
  items: string[];
  value: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}

function TextField({ label, items, value, disabled, placeholder, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">{label}</label>
      <SearchableSelect
        items={items}
        value={value}
        onValueChange={onChange}
        getValue={(item: string) => item}
        getLabel={(item: string) => item}
        placeholder={placeholder}
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        emptyText="Sin resultados"
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Selector estandar de ubicación (Departamento → Provincia → Distrito).
 * Devuelve el id del ubigeo (distrito) seleccionado.
 */
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

  if (ubigeos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
        No hay ubigeos registrados. Agrégalos desde la sección Tablas Maestras &rarr; Ubigeos.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <TextField
        label="Departamento"
        items={departamentos}
        value={draft.departamento}
        placeholder="Seleccionar"
        onChange={(val) => {
          setDraft({ departamento: val, provincia: "" });
          onChange("");
        }}
      />
      <TextField
        label="Provincia"
        items={provincias}
        value={draft.provincia}
        placeholder="Seleccionar"
        disabled={!draft.departamento}
        onChange={(val) => {
          setDraft((prev) => ({ ...prev, provincia: val }));
          onChange("");
        }}
      />
      <div className="space-y-1.5">
        <label className="text-xs font-semibold">Distrito</label>
        <SearchableSelect<Ubigeo>
          items={distritos}
          value={distritos.some((u) => u.id === effectiveValue) ? effectiveValue : ""}
          onValueChange={(id) => onChange(id ?? "")}
          getValue={(u) => u.id}
          getLabel={(u) => u.distrito}
          getKeywords={(u) => `${u.departamento} ${u.provincia} ${u.distrito}`}
          placeholder="Seleccionar"
          searchPlaceholder="Buscar distrito..."
          emptyText="Sin resultados"
          disabled={!draft.provincia}
        />
      </div>
    </div>
  );
}

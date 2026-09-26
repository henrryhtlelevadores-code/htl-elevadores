"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, Settings2, ShieldCheck, Wrench } from "lucide-react";
import { upsertPricingConfig, upsertLaborConfig } from "../actions";
import type { PricingRules } from "../calc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PricingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (next: PricingRules, nextHourlyCost: number) => void;
  currentRules: PricingRules;
  hourlyCost: number;
}

interface FormState {
  hourlyCost: string;
  overheadRateLaborPct: string;
  overheadRateQuotePct: string;
  commissionRatePct: string;
  profitRatePct: string;
  igvRatePct: string;
  allowPriceOverride: boolean;
  allowCostOverride: boolean;
}

function rulesToForm(rules: PricingRules, hourlyCost: number): FormState {
  return {
    hourlyCost: hourlyCost.toString(),
    overheadRateLaborPct: (rules.overheadRateLabor * 100).toString(),
    overheadRateQuotePct: (rules.overheadRateQuote * 100).toString(),
    commissionRatePct: (rules.commissionRate * 100).toString(),
    profitRatePct: (rules.profitRate * 100).toString(),
    igvRatePct: (rules.igvRate * 100).toString(),
    allowPriceOverride: rules.allowPriceOverride,
    allowCostOverride: rules.allowCostOverride,
  };
}

function formToRules(form: FormState): { rules: PricingRules; hourlyCost: number } {
  const num = (v: string) => (Number(v) || 0) / 100;
  return {
    rules: {
      overheadRateLabor: num(form.overheadRateLaborPct),
      overheadRateQuote: num(form.overheadRateQuotePct),
      commissionRate: num(form.commissionRatePct),
      profitRate: num(form.profitRatePct),
      igvRate: num(form.igvRatePct),
      allowPriceOverride: form.allowPriceOverride,
      allowCostOverride: form.allowCostOverride,
    },
    hourlyCost: Number(form.hourlyCost) || 0,
  };
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background border-border text-sm font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC] pr-9"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export function PricingConfigDialog({
  open,
  onOpenChange,
  onSaved,
  currentRules,
  hourlyCost: initialHourlyCost,
}: PricingConfigDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    rulesToForm(currentRules, initialHourlyCost)
  );
  const [isPending, startTransition] = useTransition();
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(rulesToForm(currentRules, initialHourlyCost));
  }

  function handleSave() {
    const { rules, hourlyCost } = formToRules(form);
    if (
      [rules.overheadRateLabor, rules.overheadRateQuote, rules.commissionRate, rules.profitRate, rules.igvRate].some(
        (v) => v < 0 || !Number.isFinite(v)
      )
    ) {
      toast.error("Ingresa valores numéricos válidos");
      return;
    }
    if (rules.igvRate > 1) {
      toast.error("El IGV debe estar entre 0% y 100%.");
      return;
    }
    if (!Number.isFinite(hourlyCost) || hourlyCost < 0) {
      toast.error("Ingresa un costo por hora válido");
      return;
    }
    startTransition(async () => {
      const [pricingRes, laborRes] = await Promise.all([
        upsertPricingConfig(rules),
        upsertLaborConfig(hourlyCost),
      ]);
      if (pricingRes.success && laborRes.success) {
        toast.success("Configuración del cotizador actualizada.");
        onSaved?.(rules, hourlyCost);
        onOpenChange(false);
      } else {
        const error = pricingRes.success ? laborRes.error : pricingRes.error;
        toast.error("Error al guardar", { description: error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[520px] text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Settings2 className="size-4 text-[#0066CC]" />
            Configuración del Cotizador
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define el costo por hora y los porcentajes aplicados al calcular el
            precio de venta de cada línea y el total de la cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <section className="space-y-3">
            <header className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Wrench className="size-3.5" />
              Mano de obra
            </header>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Costo hora"
                suffix="S/"
                value={form.hourlyCost}
                onChange={(v) => setForm((f) => ({ ...f, hourlyCost: v }))}
              />
              <NumberField
                label="Gastos administrativos"
                suffix="%"
                value={form.overheadRateLaborPct}
                onChange={(v) => setForm((f) => ({ ...f, overheadRateLaborPct: v }))}
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-3">
            <header className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Settings2 className="size-3.5" />
              Cotizador
            </header>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Carga estructura"
                suffix="%"
                value={form.overheadRateQuotePct}
                onChange={(v) => setForm((f) => ({ ...f, overheadRateQuotePct: v }))}
              />
              <NumberField
                label="Comisión vendedor"
                suffix="%"
                value={form.commissionRatePct}
                onChange={(v) => setForm((f) => ({ ...f, commissionRatePct: v }))}
              />
              <NumberField
                label="Utilidad"
                suffix="%"
                value={form.profitRatePct}
                onChange={(v) => setForm((f) => ({ ...f, profitRatePct: v }))}
              />
              <NumberField
                label="IGV"
                suffix="%"
                value={form.igvRatePct}
                onChange={(v) => setForm((f) => ({ ...f, igvRatePct: v }))}
              />
            </div>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <header className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Permisos
            </header>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={form.allowPriceOverride}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, allowPriceOverride: checked === true }))
                }
              />
              Permitir precio manual por línea
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={form.allowCostOverride}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, allowCostOverride: checked === true }))
                }
              />
              Permitir costo manual
            </label>
          </section>
        </div>

        <DialogFooter className="pt-3 gap-2 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

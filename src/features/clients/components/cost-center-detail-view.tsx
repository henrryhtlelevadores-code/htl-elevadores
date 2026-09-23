"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type Client, type CostCenter, type CostCenterContact } from "@/db";
import { updateCostCenter } from "../actions";
import { CredentialsManager } from "./credentials-manager";
import { ContactsTable } from "./contacts-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toTitleCase } from "@/lib/format";
import {
  IconArrowLeft,
  IconChevronRight,
  IconBuildingSkyscraper,
  IconMapPin,
  IconCopy,
  IconCheck,
  IconKey,
  IconUsers,
  IconSettings,
  IconLoader2,
} from "@tabler/icons-react";

export type VenueTab = "credentials" | "contacts" | "settings";

interface CostCenterDetailViewProps {
  client: Client;
  costCenter: CostCenter;
  contacts: CostCenterContact[];
  tab: VenueTab;
  onTabChange: (tab: VenueTab) => void;
  onBack: () => void;
  onBackToClients: () => void;
}

export function CostCenterDetailView({
  client,
  costCenter,
  contacts,
  tab,
  onTabChange,
  onBack,
  onBackToClients,
}: CostCenterDetailViewProps) {
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(costCenter.name);
  const [address, setAddress] = useState(costCenter.address || "");
  const [district, setDistrict] = useState(costCenter.district || "");
  const [isPending, startTransition] = useTransition();

  function handleCopyId() {
    navigator.clipboard.writeText(costCenter.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("ID de sistema copiado");
    });
  }

  function handleResetForm() {
    setName(costCenter.name);
    setAddress(costCenter.address || "");
    setDistrict(costCenter.district || "");
  }

  function handleSaveSettings() {
    if (!name.trim() || !address.trim()) {
      toast.error("Campos obligatorios", {
        description: "El nombre y la dirección son obligatorios.",
      });
      return;
    }
    startTransition(async () => {
      const res = await updateCostCenter(costCenter.id, { name, address, district });
      if (res.success) {
        toast.success("Sede actualizada", {
          description: "Los cambios de configuración se guardaron.",
        });
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Navegación contextual */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs border-border font-semibold shadow-2xs"
        >
          <IconArrowLeft className="size-3.5" />
          Volver a Sedes
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <span className="whitespace-nowrap">Gestión Comercial</span>
          <IconChevronRight className="size-3 shrink-0" />
          <button
            onClick={onBackToClients}
            className="hover:text-foreground hover:underline font-medium transition-colors whitespace-nowrap"
          >
            Clientes
          </button>
          <IconChevronRight className="size-3 shrink-0" />
          <button
            onClick={onBack}
            className="hover:text-foreground hover:underline font-medium transition-colors whitespace-nowrap hidden sm:inline"
          >
            {toTitleCase(client.legalName)}
          </button>
          <IconChevronRight className="size-3 shrink-0" />
          <span className="text-foreground font-semibold truncate max-w-[140px] sm:max-w-[240px]">
            {toTitleCase(costCenter.name)}
          </span>
        </div>
      </div>

      {/* Cabecera de la sede */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs shrink-0">
              <IconBuildingSkyscraper className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                {toTitleCase(costCenter.name)}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <IconMapPin className="size-3 text-[#0066CC] shrink-0" />
                <span>
                  {costCenter.address || "Sin dirección registrada"}
                  {costCenter.district ? `, ${costCenter.district}` : ""}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-start sm:justify-end">
            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[160px]">
              {costCenter.id.slice(0, 8)}&hellip;
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyId}
              className="text-xs border-border gap-1.5 font-semibold shrink-0"
              title="Copiar ID de sistema"
            >
              {copied ? <IconCheck className="size-3.5 text-green-600" /> : <IconCopy className="size-3.5" />}
              {copied ? "¡Copiado!" : "Copiar ID"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs internas de la sede */}
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as VenueTab)} className="space-y-4">
        <TabsList className="bg-card border border-border p-1 h-10 rounded-lg shadow-xs">
          <TabsTrigger
            value="credentials"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-3 gap-2 rounded-md"
          >
            <IconKey className="size-3.5" />
            <span>Credenciales y Acceso</span>
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-3 gap-2 rounded-md"
          >
            <IconUsers className="size-3.5" />
            <span>Contactos ({contacts.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-3 gap-2 rounded-md"
          >
            <IconSettings className="size-3.5" />
            <span>Configuración</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="outline-hidden focus:outline-none">
          <CredentialsManager costCenter={costCenter} />
        </TabsContent>

        <TabsContent value="contacts" className="outline-hidden focus:outline-none">
          <ContactsTable costCenterId={costCenter.id} contacts={contacts} />
        </TabsContent>

        <TabsContent value="settings" className="outline-hidden focus:outline-none max-w-lg">
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <IconSettings className="size-4 text-[#0066CC]" />
              Información General de la Sede
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre de la Sede</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">Dirección</label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Ej: Av. La Marina 1455, piso 8"
                className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">Distrito</label>
              <Input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Ej: San Miguel"
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                className="text-xs border-border"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleSaveSettings}
                className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
              >
                {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
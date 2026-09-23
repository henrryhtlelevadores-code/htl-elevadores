"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { type CostCenter } from "@/db";
import { type ClientWithStats } from "../actions";
import { ClientsTable } from "./clients-table";
import { CostCentersTable } from "./cost-centers-table";
import { CostCenterDetailView, type VenueTab } from "./cost-center-detail-view";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/lib/format";
import {
  IconBuilding,
  IconMapPin,
  IconArrowLeft,
  IconFileDescription,
  IconChevronRight,
  IconUsers,
  IconCopy,
  IconCheck,
  IconPlus,
} from "@tabler/icons-react";

interface ContactItem {
  id: string;
  costCenterId: string;
  userId: string | null;
  fullName: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  signatureUrl: string | null;
  isActive: boolean | null;
}

interface ClientUnifiedViewProps {
  initialClients: ClientWithStats[];
  initialCostCenters: CostCenter[];
  initialContacts: ContactItem[];
}

export function ClientUnifiedView({
  initialClients,
  initialCostCenters,
  initialContacts,
}: ClientUnifiedViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [venueTab, setVenueTab] = useState<VenueTab>("credentials");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedClient = initialClients.find((c) => c.id === selectedClientId);

  const clientCostCenters = useMemo(
    () =>
      selectedClientId
        ? initialCostCenters.filter((cc) => cc.clientId === selectedClientId)
        : [],
    [initialCostCenters, selectedClientId]
  );

  const selectedCostCenter = clientCostCenters.find((cc) => cc.id === selectedCostCenterId);

  const costCenterContacts = selectedCostCenterId
    ? initialContacts.filter((c) => c.costCenterId === selectedCostCenterId)
    : [];

  const clientContactsCount = clientCostCenters.reduce((acc, cc) => {
    return acc + initialContacts.filter((c) => c.costCenterId === cc.id).length;
  }, 0);

  const contactsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cc of clientCostCenters) {
      map[cc.id] = initialContacts.filter((c) => c.costCenterId === cc.id).length;
    }
    return map;
  }, [clientCostCenters, initialContacts]);

  function handleSelectClient(client: ClientWithStats) {
    setSelectedClientId(client.id);
    setSelectedCostCenterId("");
    setVenueTab("credentials");
  }

  function handleSelectCostCenter(center: CostCenter) {
    setSelectedCostCenterId(center.id);
    setVenueTab("credentials");
  }

  function handleManageCredential(center: CostCenter) {
    setSelectedCostCenterId(center.id);
    setVenueTab("credentials");
  }

  function handleBackToList() {
    setSelectedClientId(null);
    setSelectedCostCenterId("");
    setVenueTab("credentials");
  }

  function handleBackToVenues() {
    setSelectedCostCenterId("");
    setVenueTab("credentials");
  }

  function handleCopy(field: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  function handleAddContact() {
    const first = clientCostCenters[0];
    if (!first) {
      toast.error("No hay sedes registradas", {
        description: "Primero registra una sede para poder agregar contactos.",
      });
      return;
    }
    setSelectedCostCenterId(first.id);
    setVenueTab("contacts");
  }

  const header = (
    <div className="space-y-4">
      {selectedClient && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBackToList}
            className="gap-1.5 text-xs border-border font-semibold shadow-2xs"
          >
            <IconArrowLeft className="size-3.5" />
            Volver a Clientes
          </Button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="whitespace-nowrap">Gestión Comercial</span>
            <IconChevronRight className="size-3 shrink-0" />
            <button
              onClick={handleBackToList}
              className="hover:text-foreground hover:underline font-medium transition-colors whitespace-nowrap"
            >
              Clientes
            </button>
            <IconChevronRight className="size-3 shrink-0" />
            <span className="text-foreground font-semibold truncate max-w-[160px] sm:max-w-[320px]">
              {toTitleCase(selectedClient.legalName)}
            </span>
          </div>
        </div>
      )}

      <div className="border-b border-border pb-5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
            <IconBuilding className="size-4.5" />
          </div>
          {selectedClient ? toTitleCase(selectedClient.legalName) : "Clientes"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {selectedClient
            ? "Administración de sedes y personas de contacto."
            : "Directorio centralizado de clientes comerciales."}
        </p>
      </div>
    </div>
  );

  if (!selectedClient) {
    return (
      <div className="space-y-6">
        {header}
        <ClientsTable clients={initialClients} onSelectClient={handleSelectClient} />
      </div>
    );
  }

  if (selectedCostCenter) {
    return (
      <div className="space-y-6">
        <CostCenterDetailView
          client={selectedClient}
          costCenter={selectedCostCenter}
          contacts={costCenterContacts}
          tab={venueTab}
          onTabChange={setVenueTab}
          onBack={handleBackToVenues}
          onBackToClients={handleBackToList}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Client Summary Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              RUC / Identificación
            </span>
            <div className="flex items-center gap-1.5 text-sm text-foreground font-mono font-medium">
              <IconFileDescription className="size-3.5 text-[#0066CC] shrink-0" />
              <span className="truncate">{selectedClient.taxId || "No registrado"}</span>
              {selectedClient.taxId && (
                <button
                  type="button"
                  onClick={() => handleCopy("RUC", selectedClient.taxId ?? "")}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Copiar RUC"
                >
                  {copiedField === "RUC" ? (
                    <IconCheck className="size-3.5 text-green-600" />
                  ) : (
                    <IconCopy className="size-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Sedes / Centros de Costo
            </span>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0066CC] dark:text-blue-400">
              <IconMapPin className="size-3.5 shrink-0" />
              <span>
                {clientCostCenters.length}{" "}
                {clientCostCenters.length === 1 ? "centro de costo" : "centros de costo"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Contactos
            </span>
            <div
              className={`flex items-center gap-1.5 text-sm font-semibold ${
                clientContactsCount === 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-[#0066CC] dark:text-blue-400"
              }`}
            >
              <IconUsers className="size-3.5 shrink-0" />
              <span>
                {clientContactsCount} {clientContactsCount === 1 ? "contacto" : "contactos"}
              </span>
            </div>
            {clientContactsCount === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddContact}
                className="text-xs border-border gap-1.5 font-semibold text-[#0066CC] dark:text-blue-400"
              >
                <IconPlus className="size-3.5" />
                Agregar contacto
              </Button>
            )}
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              ID de Sistema
            </span>
            <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
              <span className="truncate">{selectedClient.id.slice(0, 8)}&hellip;</span>
              <button
                type="button"
                onClick={() => handleCopy("ID", selectedClient.id)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Copiar ID de sistema"
              >
                {copiedField === "ID" ? (
                  <IconCheck className="size-3.5 text-green-600" />
                ) : (
                  <IconCopy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de sedes (master) */}
      <CostCentersTable
        client={selectedClient}
        costCenters={clientCostCenters}
        contactsCount={contactsCountMap}
        onSelectCostCenter={handleSelectCostCenter}
        onManageCredential={handleManageCredential}
      />
    </div>
  );
}
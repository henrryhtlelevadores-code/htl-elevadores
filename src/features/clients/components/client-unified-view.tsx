"use client";

import { useState } from "react";
import { type CostCenter } from "@/db";
import { type ClientWithStats } from "../actions";
import { ClientsTable } from "./clients-table";
import { CostCentersTable } from "./cost-centers-table";
import { ContactsTable } from "./contacts-table";
import { CredentialsManager } from "./credentials-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Building2,
  MapPin,
  ArrowLeft,
  FileCheck2,
  ChevronRight,
  Users,
  UserRound,
  KeyRound,
} from "lucide-react";

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
  const [detailTab, setDetailTab] = useState<string>("centers");
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");

  const selectedClient = initialClients.find((c) => c.id === selectedClientId);

  const clientCostCenters = selectedClientId
    ? initialCostCenters.filter((cc) => cc.clientId === selectedClientId)
    : [];

  const costCenterContacts = selectedCostCenterId
    ? initialContacts.filter((c) => c.costCenterId === selectedCostCenterId)
    : [];

  const clientContactsCount = clientCostCenters.reduce((acc, cc) => {
    return acc + initialContacts.filter((c) => c.costCenterId === cc.id).length;
  }, 0);

  function handleSelectClient(client: ClientWithStats) {
    setSelectedClientId(client.id);
    setSelectedCostCenterId("");
    setDetailTab("centers");
  }

  function handleSelectCostCenter(center: CostCenter) {
    setSelectedCostCenterId(center.id);
    setDetailTab("contacts");
  }

  return (
    <div className="space-y-6">
      {/* Header and Breadcrumb navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>Gestión Comercial</span>
            <ChevronRight className="size-3" />
            <button
              onClick={() => {
                setSelectedClientId(null);
                setSelectedCostCenterId("");
                setDetailTab("centers");
              }}
              className="hover:text-foreground hover:underline font-medium transition-colors"
            >
              Clientes
            </button>
            {selectedClient && (
              <>
                <ChevronRight className="size-3" />
                <span className="text-foreground font-semibold">{selectedClient.legalName}</span>
              </>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <Building2 className="size-4.5" />
            </div>
            {selectedClient ? selectedClient.legalName : "Clientes"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {selectedClient
              ? `Administración de sedes y personas de contacto de ${selectedClient.legalName}.`
              : "Directorio centralizado de clientes comerciales."}
          </p>
        </div>
      </div>

      {/* Listado de Clientes */}
      {!selectedClient ? (
        <ClientsTable clients={initialClients} onSelectClient={handleSelectClient} />
      ) : (
        <div className="space-y-6">
          {/* Client Summary Card */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Razón Social / Cliente
                </span>
                <p className="text-sm font-bold text-foreground">{selectedClient.legalName}</p>
                <span className="font-mono text-xs text-muted-foreground">
                  ID: {selectedClient.id}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  RUC / Identificación
                </span>
                <div className="flex items-center gap-1.5 text-xs text-foreground font-mono font-medium">
                  <FileCheck2 className="size-3.5 text-[#0066CC]" />
                  <span>{selectedClient.taxId || "No registrado"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Sedes Registradas
                </span>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0066CC] dark:text-blue-400">
                  <MapPin className="size-3.5" />
                  <span>{clientCostCenters.length} centros de costo</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Contactos
                </span>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0066CC] dark:text-blue-400">
                  <Users className="size-3.5" />
                  <span>{clientContactsCount} contactos</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedClientId(null);
                    setSelectedCostCenterId("");
                    setDetailTab("centers");
                  }}
                  className="text-xs border-border gap-2 font-semibold shadow-2xs"
                >
                  <ArrowLeft className="size-3.5" />
                  Volver al listado
                </Button>
              </div>
            </div>
          </div>

          {/* Detail Tabs */}
          <Tabs value={detailTab} onValueChange={setDetailTab} className="space-y-4">
            <TabsList className="bg-card border border-border p-1 h-10 rounded-lg shadow-xs">
              <TabsTrigger
                value="centers"
                className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
              >
                <MapPin className="size-3.5" />
                <span>Centros de Costo ({clientCostCenters.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="contacts"
                className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
              >
                <UserRound className="size-3.5" />
                <span>Contactos ({clientContactsCount})</span>
              </TabsTrigger>
              <TabsTrigger
                value="credentials"
                className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
              >
                <KeyRound className="size-3.5" />
                <span>Credenciales</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="centers" className="outline-hidden focus:outline-none">
              <CostCentersTable
                client={selectedClient}
                costCenters={clientCostCenters}
                onSelectCostCenter={handleSelectCostCenter}
              />
            </TabsContent>

            <TabsContent value="contacts" className="outline-hidden focus:outline-none space-y-4">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <label className="text-xs font-semibold text-foreground">
                  Centro de Costo
                </label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                  Selecciona la sede a la que pertenecen los contactos.
                </p>
                <div className="max-w-sm">
                  <Select
                    value={selectedCostCenterId}
                    onValueChange={(v) => setSelectedCostCenterId(v ?? "")}
                  >
                    <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                      <SelectValue placeholder="Selecciona un centro de costo">
                        {clientCostCenters.find((cc) => cc.id === selectedCostCenterId)?.name ??
                          null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {clientCostCenters.map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCostCenterId ? (
                <ContactsTable
                  costCenterId={selectedCostCenterId}
                  contacts={costCenterContacts}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                  <Users className="mx-auto size-6 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {clientCostCenters.length === 0
                      ? "Este cliente aún no tiene centros de costo"
                      : "Elige un centro de costo"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientCostCenters.length === 0
                      ? "Registra una sede en el tab Centros de Costo para poder asignar contactos."
                      : "Selecciona arriba la sede para ver o agregar sus contactos."}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials" className="outline-hidden focus:outline-none">
              <CredentialsManager costCenters={clientCostCenters} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { type Brand, type ElevatorType, type ServiceType } from "@/db";
import { type ModelWithBrand } from "../actions";
import { BrandsModelsTab } from "./brands-models-tab";
import { TypesTab } from "./types-tab";
import { ServiceTypesTab } from "./service-types-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag, Cpu, Layers, Database, Wrench } from "lucide-react";

interface MastersViewProps {
  brands: Brand[];
  types: ElevatorType[];
  models: ModelWithBrand[];
  serviceTypes: ServiceType[];
}

export function MastersView({ brands, types, models, serviceTypes }: MastersViewProps) {
  const [activeTab, setActiveTab] = useState("brands-models");

  return (
    <div className="space-y-6">
      {/* Header and Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <Database className="size-4.5" />
            </div>
            Tablas Maestras
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Catálogos homologados para Marcas, sus Modelos y Tipos de Equipo de Transporte Vertical.
          </p>
        </div>

        {/* Global Statistics Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-xs font-mono shadow-xs">
            <Tag className="size-3 text-[#0066CC]" />
            <span className="text-muted-foreground">Marcas:</span>
            <span className="text-foreground font-bold">{brands.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-xs font-mono shadow-xs">
            <Layers className="size-3 text-[#0066CC]" />
            <span className="text-muted-foreground">Modelos:</span>
            <span className="text-foreground font-bold">{models.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-xs font-mono shadow-xs">
            <Cpu className="size-3 text-[#0066CC]" />
            <span className="text-muted-foreground">Tipos:</span>
            <span className="text-foreground font-bold">{types.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-card border border-border text-xs font-mono shadow-xs">
            <Wrench className="size-3 text-[#0066CC]" />
            <span className="text-muted-foreground">Servicios:</span>
            <span className="text-foreground font-bold">{serviceTypes.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card border border-border p-1 h-10 rounded-lg shadow-xs">
          <TabsTrigger
            value="brands-models"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
          >
            <Tag className="size-3.5" />
            <span>Marcas y Modelos</span>
          </TabsTrigger>
          <TabsTrigger
            value="types"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
          >
            <Cpu className="size-3.5" />
            <span>Tipos de Equipos ({types.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="service-types"
            className="data-active:bg-[#0066CC] data-active:text-white text-muted-foreground text-xs font-semibold px-4 gap-2 rounded-md"
          >
            <Wrench className="size-3.5" />
            <span>Tipos de Servicio ({serviceTypes.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands-models" className="outline-hidden focus:outline-none">
          <BrandsModelsTab initialBrands={brands} initialModels={models} />
        </TabsContent>

        <TabsContent value="types" className="outline-hidden focus:outline-none">
          <TypesTab initialTypes={types} />
        </TabsContent>

        <TabsContent value="service-types" className="outline-hidden focus:outline-none">
          <ServiceTypesTab initialServiceTypes={serviceTypes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
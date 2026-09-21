"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Brand } from "@/db";
import { type ModelWithBrand } from "../actions";
import {
  brandFormSchema,
  modelFormSchema,
  type BrandFormValues,
  type ModelFormValues,
} from "../schema";
import {
  createBrand,
  updateBrand,
  deleteBrand,
  createModel,
  updateModel,
  deleteModel,
} from "../actions";
import { DataTable } from "@/components/ui/data-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Layers,
  ArrowLeft,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

interface BrandsModelsTabProps {
  initialBrands: Brand[];
  initialModels: ModelWithBrand[];
}

export function BrandsModelsTab({ initialBrands, initialModels }: BrandsModelsTabProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  const selectedBrand = initialBrands.find((b) => b.id === selectedBrandId);
  const brandModels = selectedBrandId
    ? initialModels.filter((m) => m.brandId === selectedBrandId)
    : [];

  return (
    <div className="space-y-6">
      {!selectedBrand ? (
        <BrandsTable
          brands={initialBrands}
          models={initialModels}
          onSelectBrand={(b) => setSelectedBrandId(b.id)}
        />
      ) : (
        <ModelsPanel brand={selectedBrand} models={brandModels} onBack={() => setSelectedBrandId(null)} />
      )}
    </div>
  );
}

// ==========================================
// Brands section
// ==========================================

interface BrandsTableProps {
  brands: Brand[];
  models: ModelWithBrand[];
  onSelectBrand: (brand: Brand) => void;
}

function BrandsTable({ brands, models, onSelectBrand }: BrandsTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: "",
      country: "",
    },
  });

  const editForm = useForm<{ name: string; country: string }>({
    defaultValues: {
      name: "",
      country: "",
    },
  });

  function handleOpenCreate() {
    createForm.reset({ name: "", country: "" });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(brand: Brand) {
    setEditingBrand(brand);
    editForm.reset({
      name: brand.name,
      country: brand.country ?? "",
    });
  }

  function handleCreateSubmit(values: BrandFormValues) {
    startTransition(async () => {
      const res = await createBrand(values);
      if (res.success) {
        toast.success("Marca agregada", {
          description: `La marca "${values.name}" ha sido registrada.`,
        });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear marca", {
          description: res.error,
        });
      }
    });
  }

  function handleEditSubmit(values: { name: string; country: string }) {
    if (!editingBrand) return;
    startTransition(async () => {
      const res = await updateBrand(editingBrand.id, {
        name: values.name,
        country: values.country,
      });
      if (res.success) {
        toast.success("Marca actualizada", {
          description: `Los cambios para "${values.name}" se guardaron exitosamente.`,
        });
        setEditingBrand(null);
      } else {
        toast.error("Error al actualizar", {
          description: res.error,
        });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingBrand) return;
    startTransition(async () => {
      const res = await deleteBrand(deletingBrand.id);
      if (res.success) {
        toast.success("Marca eliminada", {
          description: `Se ha retirado la marca "${deletingBrand.name}".`,
        });
        setDeletingBrand(null);
      } else {
        toast.error("Error al eliminar", {
          description: res.error,
        });
      }
    });
  }

  const columns = useMemo<ColumnDef<Brand>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Marca
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Tag className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "country",
        header: "País de Origen",
        cell: ({ row }) => {
          const country = row.getValue<string | null>("country");
          return <span className="text-muted-foreground">{country || "—"}</span>;
        },
      },
      {
        id: "modelCount",
        header: "Modelos",
        cell: ({ row }) => {
          const brand = row.original;
          const count = models.filter((m) => m.brandId === brand.id).length;
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0066CC]/20 bg-[#0066CC]/5 text-[#0066CC] dark:text-blue-400">
              <Layers className="size-3" />
              {count} modelo{count !== 1 ? "s" : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => {
          const active = row.getValue<boolean>("isActive");
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted/50">
              <span
                className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`}
              />
              {active ? "Activa" : "Inactiva"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const brand = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onSelectBrand(brand)}
                className="text-[#0066CC] hover:bg-[#0066CC]/10"
                title="Crear y administrar modelos de esta marca"
              >
                <Layers className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(brand)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar marca"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingBrand(brand)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar marca"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [models, onSelectBrand]
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={brands}
        searchPlaceholder="Buscar por nombre o país..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nueva Marca
          </Button>
        }
      />

      {/* Modal: Crear Marca */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nueva Marca
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra una nueva marca de transporte vertical.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(handleCreateSubmit)}
              className="space-y-4 pt-2"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre Comercial</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Otis, KONE, Mitsubishi"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">País de Origen</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Suiza, Finlandia, Japón"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs border-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar Marca
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Marca */}
      <Dialog open={!!editingBrand} onOpenChange={(open) => !open && setEditingBrand(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Marca
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica el nombre comercial o país de origen.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubmit({
                name: editForm.getValues("name"),
                country: editForm.getValues("country"),
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre Comercial</label>
              <Input
                defaultValue={editingBrand?.name}
                onChange={(e) => editForm.setValue("name", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">País de Origen</label>
              <Input
                defaultValue={editingBrand?.country ?? ""}
                onChange={(e) => editForm.setValue("country", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingBrand(null)}
                className="text-xs border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingBrand} onOpenChange={(open) => !open && setDeletingBrand(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Marca
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas eliminar la marca{" "}
              <strong className="text-foreground">{deletingBrand?.name}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingBrand(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// Models section (nested per brand)
// ==========================================

interface ModelsPanelProps {
  brand: Brand;
  models: ModelWithBrand[];
  onBack: () => void;
}

function ModelsPanel({ brand, models, onBack }: ModelsPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelWithBrand | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelWithBrand | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: { brandId: brand.id, name: "", techSpecs: "" },
  });

  const editForm = useForm<{ name: string; techSpecs: string }>({
    defaultValues: { name: "", techSpecs: "" },
  });

  function handleOpenCreate() {
    createForm.reset({ brandId: brand.id, name: "", techSpecs: "" });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(model: ModelWithBrand) {
    setEditingModel(model);
    editForm.reset({
      name: model.name,
      techSpecs: typeof model.techSpecs === "string" ? model.techSpecs : "",
    });
  }

  function handleCreateSubmit(values: ModelFormValues) {
    startTransition(async () => {
      const res = await createModel(values);
      if (res.success) {
        toast.success("Modelo registrado", {
          description: `El modelo "${values.name}" ha sido creado para ${brand.name}.`,
        });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear modelo", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: { name: string; techSpecs: string }) {
    if (!editingModel) return;
    startTransition(async () => {
      const res = await updateModel(editingModel.id, { ...values, brandId: brand.id });
      if (res.success) {
        toast.success("Modelo actualizado", {
          description: "Los cambios se guardaron exitosamente.",
        });
        setEditingModel(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingModel) return;
    startTransition(async () => {
      const res = await deleteModel(deletingModel.id);
      if (res.success) {
        toast.success("Modelo eliminado", {
          description: `Se ha retirado "${deletingModel.name}".`,
        });
        setDeletingModel(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ModelWithBrand>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Modelo
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Layers className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "techSpecs",
        header: "Especificaciones",
        cell: ({ row }) => {
          const specs = row.getValue<string | null>("techSpecs");
          return (
            <span className="text-muted-foreground max-w-[280px] truncate block">
              {specs || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => {
          const active = row.getValue<boolean>("isActive");
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted/50">
              <span
                className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`}
              />
              {active ? "Activo" : "Inactivo"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const model = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(model)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar modelo"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingModel(model)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar modelo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Brand Header / Breadcrumb */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400">
            <Tag className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Modelos de la Marca
            </p>
            <h2 className="text-base sm:text-lg font-bold text-foreground truncate">{brand.name}</h2>
            <span className="text-[11px] text-muted-foreground">
              {models.length} modelo{models.length !== 1 ? "s" : ""} registrado
              {models.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="text-xs border-border gap-2 font-semibold shadow-2xs shrink-0"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Marcas
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={models}
        searchPlaceholder="Buscar modelo..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nuevo Modelo
          </Button>
        }
      />

      {/* Modal: Crear Modelo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nuevo Modelo de {brand.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              El modelo quedará asociado automáticamente a la marca {brand.name}.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre del Modelo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Gen2, S8, NPEV"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="techSpecs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Especificaciones</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Capacidad 630kg, 8 paradas"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs border-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar Modelo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Modelo */}
      <Dialog open={!!editingModel} onOpenChange={(open) => !open && setEditingModel(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Modelo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica el modelo o sus especificaciones para la marca {brand.name}.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubmit({
                name: editForm.getValues("name"),
                techSpecs: editForm.getValues("techSpecs"),
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre del Modelo</label>
              <Input
                defaultValue={editingModel?.name}
                onChange={(e) => editForm.setValue("name", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold">Especificaciones</label>
              <Input
                defaultValue={
                  typeof editingModel?.techSpecs === "string" ? editingModel.techSpecs : ""
                }
                onChange={(e) => editForm.setValue("techSpecs", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingModel(null)}
                className="text-xs border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingModel} onOpenChange={(open) => !open && setDeletingModel(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Modelo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el modelo{" "}
              <strong className="text-foreground">{deletingModel?.name}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingModel(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Ubigeo } from "@/db";
import { ubigeoFormSchema, ubigeoBulkImportSchema, type UbigeoFormValues } from "../schema";
import { createUbigeo, updateUbigeo, deleteUbigeo, importUbigeosBulk } from "../actions";
import { DataTable } from "@/components/ui/data-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  MapPin,
  AlertTriangle,
  ArrowUpDown,
  FileJson,
} from "lucide-react";

interface UbigeosTabProps {
  initialUbigeos: Ubigeo[];
}

const createDefaultValues = (): UbigeoFormValues => ({
  id: "",
  departamento: "",
  provincia: "",
  distrito: "",
  latitud: "",
  longitud: "",
});

export function UbigeosTab({ initialUbigeos }: UbigeosTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [editingUbigeo, setEditingUbigeo] = useState<Ubigeo | null>(null);
  const [deletingUbigeo, setDeletingUbigeo] = useState<Ubigeo | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<UbigeoFormValues>({
    resolver: zodResolver(ubigeoFormSchema),
    defaultValues: createDefaultValues(),
  });

  function handleOpenCreate() {
    createForm.reset(createDefaultValues());
    setIsCreateOpen(true);
  }

  function handleOpenEdit(ubigeo: Ubigeo) {
    setEditingUbigeo(ubigeo);
    createForm.reset({
      id: ubigeo.id,
      departamento: ubigeo.departamento,
      provincia: ubigeo.provincia,
      distrito: ubigeo.distrito,
      latitud: ubigeo.latitud != null ? ubigeo.latitud : "",
      longitud: ubigeo.longitud != null ? ubigeo.longitud : "",
    });
  }

  function handleCreateSubmit(values: UbigeoFormValues) {
    startTransition(async () => {
      const res = await createUbigeo(values);
      if (res.success) {
        toast.success("Ubigeo registrado", {
          description: `El distrito "${values.distrito}" ha sido creado.`,
        });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear ubigeo", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: UbigeoFormValues) {
    if (!editingUbigeo) return;
    startTransition(async () => {
      const res = await updateUbigeo(editingUbigeo.id, values);
      if (res.success) {
        toast.success("Ubigeo actualizado", {
          description: "Los cambios se guardaron exitosamente.",
        });
        setEditingUbigeo(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingUbigeo) return;
    startTransition(async () => {
      const res = await deleteUbigeo(deletingUbigeo.id);
      if (res.success) {
        toast.success("Ubigeo eliminado", {
          description: `Se ha retirado "${deletingUbigeo.distrito}".`,
        });
        setDeletingUbigeo(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  function handleOpenImport() {
    setJsonText("");
    setIsImportOpen(true);
  }

  function handleImportSubmit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      toast.error("JSON inválido", {
        description: "Revisa el formato del JSON pegado.",
      });
      return;
    }

    const result = ubigeoBulkImportSchema.safeParse(parsed);
    if (!result.success) {
      toast.error("Formato inválido", {
        description:
          "El JSON debe ser un arreglo de objetos con las claves: Ubigeo, Departamento, Provincia, Distrito, Latitud (opcional) y Longitud (opcional).",
      });
      return;
    }

    startTransition(async () => {
      const res = await importUbigeosBulk(result.data);
      if (res.success) {
        toast.success("Ubigeos importados", { description: res.message });
        setIsImportOpen(false);
        setJsonText("");
      } else {
        toast.error("Error al importar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<Ubigeo>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Código
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
            {row.getValue("id")}
          </span>
        ),
      },
      {
        accessorKey: "departamento",
        header: "Departamento",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.getValue("departamento")}</span>
        ),
      },
      {
        accessorKey: "provincia",
        header: "Provincia",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.getValue("provincia")}</span>
        ),
      },
      {
        accessorKey: "distrito",
        header: "Distrito",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <MapPin className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("distrito")}</span>
          </div>
        ),
      },
      {
        accessorKey: "latitud",
        header: "Latitud",
        cell: ({ row }) => {
          const lat = row.getValue<number | null>("latitud");
          return <span className="text-xs font-mono text-muted-foreground">{lat ?? "—"}</span>;
        },
      },
      {
        accessorKey: "longitud",
        header: "Longitud",
        cell: ({ row }) => {
          const lon = row.getValue<number | null>("longitud");
          return <span className="text-xs font-mono text-muted-foreground">{lon ?? "—"}</span>;
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const ubigeo = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(ubigeo)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar ubigeo"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingUbigeo(ubigeo)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar ubigeo"
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
      <DataTable
        columns={columns}
        data={initialUbigeos}
        searchPlaceholder="Buscar por código, departamento, provincia o distrito..."
        extraActions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleOpenImport}
              className="text-[#0066CC] dark:text-blue-400 border-border font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
            >
              <FileJson className="size-4" />
              Importar en Lote
            </Button>
            <Button
              onClick={handleOpenCreate}
              className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
            >
              <Plus className="size-4" />
              Nuevo Ubigeo
            </Button>
          </div>
        }
      />

      {/* Modal: Crear Ubigeo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nuevo Ubigeo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra una ubicación con códigos de ubigeo (INEI), departamento, provincia y distrito.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Código</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: 150101"
                        {...field}
                        className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="departamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Departamento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: LIMA"
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
                  name="provincia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Provincia</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: LIMA"
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="distrito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Distrito</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: LIMA"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="latitud"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Latitud</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: -12.046374"
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
                  name="longitud"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Longitud</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: -77.042793"
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                  Guardar Ubigeo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Importar Ubigeos en Lote (JSON) */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[620px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileJson className="size-4 text-[#0066CC]" />
              Importar Ubigeos en Lote
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pega un arreglo JSON para insertar varios ubigeos de una sola vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-[11px] text-muted-foreground font-mono leading-relaxed">
              <pre className="whitespace-pre-wrap">{`[
  { "Ubigeo": "150101", "Departamento": "LIMA", "Provincia": "LIMA", "Distrito": "LIMA", "Latitud": -12.046374, "Longitud": -77.042793 },
  { "Ubigeo": "150102", "Departamento": "LIMA", "Provincia": "LIMA", "Distrito": "ANCON", "Latitud": -11.775, "Longitud": -77.17 }
]`}</pre>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ubigeo-json" className="text-xs font-semibold">
                Contenido JSON
              </Label>
              <Textarea
                id="ubigeo-json"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={10}
                placeholder={JSON.stringify(
                  [
                    {
                      Ubigeo: "150101",
                      Departamento: "LIMA",
                      Provincia: "LIMA",
                      Distrito: "LIMA",
                      Latitud: -12.046374,
                      Longitud: -77.042793,
                    },
                  ],
                  null,
                  2
                )}
                className="resize-none bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
              <p className="text-[11px] text-muted-foreground">
                Claves requeridas: <span className="font-semibold">Ubigeo</span>,{" "}
                <span className="font-semibold">Departamento</span>,{" "}
                <span className="font-semibold">Provincia</span> y{" "}
                <span className="font-semibold">Distrito</span>.{" "}
                <span className="font-semibold">Latitud</span> y{" "}
                <span className="font-semibold">Longitud</span> son opcionales (decimales).
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending || !jsonText.trim()}
              onClick={handleImportSubmit}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Importar Ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Ubigeo */}
      <Dialog open={!!editingUbigeo} onOpenChange={(open) => !open && setEditingUbigeo(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[500px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Ubigeo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica los datos del ubigeo.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Código</FormLabel>
                    <FormControl>
                      <Input
                        disabled
                        {...field}
                        className="bg-muted border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="departamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Departamento</FormLabel>
                      <FormControl>
                        <Input
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
                  name="provincia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Provincia</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="distrito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Distrito</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="latitud"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Latitud</FormLabel>
                      <FormControl>
                        <Input
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
                  name="longitud"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Longitud</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUbigeo(null)}
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
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingUbigeo} onOpenChange={(open) => !open && setDeletingUbigeo(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Ubigeo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el distrito{" "}
              <strong className="text-foreground">{deletingUbigeo?.distrito}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingUbigeo(null)}
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
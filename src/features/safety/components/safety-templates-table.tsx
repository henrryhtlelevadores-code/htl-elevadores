"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  type SafetyTemplateWithType,
  createSafetyTemplate,
  updateSafetyTemplate,
  deleteSafetyTemplate,
} from "../actions";
import { safetyTemplateFormSchema, type SafetyTemplateFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";
import { ChecklistItemsEditor } from "./checklist-items-editor";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  HardHat,
} from "lucide-react";

interface SafetyTemplatesTableProps {
  initialTemplates: SafetyTemplateWithType[];
  elevatorTypes: Array<{ id: string; name: string }>;
}

const TYPE_STYLES: Record<string, string> = {
  CHECKLIST: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  PROTOCOL: "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  HANDBOOK: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const TYPE_LABELS: Record<string, string> = {
  CHECKLIST: "Checklist",
  PROTOCOL: "Protocolo",
  HANDBOOK: "Manual",
};

const emptyValues = {
  type: "CHECKLIST",
  equipmentTypeId: "",
  name: "",
  version: "v1.0",
  content: "",
};

const SAMPLE_CONTENT = JSON.stringify(
  [
    { id: "t1", label: "Verificar paracaídas y limitador de velocidad", isCritical: true },
    { id: "t2", label: "Revisar frenos y puertas", isCritical: true },
    { id: "t3", label: "Comprobar luces y alarma de emergencia", isCritical: false },
  ],
  null,
  2
);

export function SafetyTemplatesTable({ initialTemplates, elevatorTypes }: SafetyTemplatesTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SafetyTemplateWithType | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<SafetyTemplateWithType | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<SafetyTemplateFormValues>({
    resolver: zodResolver(safetyTemplateFormSchema),
    defaultValues: emptyValues,
  });

  function handleOpenCreate() {
    setEditingTemplate(null);
    form.reset({
      ...emptyValues,
      content: SAMPLE_CONTENT,
    });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(template: SafetyTemplateWithType) {
    setEditingTemplate(template);
    form.reset({
      type: template.type,
      equipmentTypeId: template.equipmentTypeId || "",
      name: template.name,
      version: template.version || "v1.0",
      content:
        typeof template.content === "string"
          ? template.content
          : JSON.stringify(template.content ?? []),
    });
    setIsCreateOpen(true);
  }

  function handleSubmit(values: SafetyTemplateFormValues) {
    startTransition(async () => {
      const res = editingTemplate
        ? await updateSafetyTemplate(editingTemplate.id, values)
        : await createSafetyTemplate(values);
      if (res.success) {
        toast.success(
          editingTemplate ? "Plantilla actualizada" : "Plantilla creada",
          { description: res.message }
        );
        setIsCreateOpen(false);
        setEditingTemplate(null);
        form.reset();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingTemplate) return;
    startTransition(async () => {
      const res = await deleteSafetyTemplate(deletingTemplate.id);
      if (res.success) {
        toast.success("Plantilla eliminada", { description: `Se eliminó "${deletingTemplate.name}".` });
        setDeletingTemplate(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<SafetyTemplateWithType>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => {
          const type = row.getValue<string>("type");
          const style = TYPE_STYLES[type] || "";
          return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
              {TYPE_LABELS[type] ?? type}
            </span>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-foreground">
            <HardHat className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "elevator_type_name",
        header: "Tipo de Equipo",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.getValue("elevator_type_name") || "Todos"}
          </span>
        ),
      },
      {
        accessorKey: "version",
        header: "Versión",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.getValue("version")}</span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Activa",
        cell: ({ row }) => {
          const active = row.getValue<boolean>("isActive");
          return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
            }`}>
              {active ? "Sí" : "No"}
            </span>
          );
        },
      },
      {
        accessorKey: "content",
        header: "Contenido",
        cell: ({ row }) => {
          const content = row.getValue<unknown>("content");
          let preview = "";
          if (Array.isArray(content)) {
            preview = `${content.length} ítems`;
          } else if (typeof content === "string") {
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) preview = `${parsed.length} ítems`;
            } catch {
              preview = content;
            }
          }
          return (
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px] block">
              {preview}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(template)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar plantilla"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingTemplate(template)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar plantilla"
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
        data={initialTemplates}
        searchPlaceholder="Buscar por tipo, nombre o versión..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nueva Plantilla
          </Button>
        }
      />

      {/* Modal: Crear / Editar Plantilla */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) setEditingTemplate(null);
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[560px] text-foreground shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#0066CC]" />
              {editingTemplate ? "Editar Plantilla de Seguridad" : "Nueva Plantilla de Seguridad"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define el checklist o protocolo que se usará en campo.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Tipo</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue>
                              {(value: string | null) =>
                                value ? (TYPE_LABELS[value] ?? value) : "Selecciona un tipo"
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {["CHECKLIST", "PROTOCOL", "HANDBOOK"].map((t) => (
                              <SelectItem key={t} value={t}>
                                {TYPE_LABELS[t] ?? t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Versión</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: v2.0" {...field} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Checklist de seguridad mensual" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipmentTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Tipo de Equipo</FormLabel>
                    <FormControl>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue>
                            {(value: string | null) => {
                              if (!value) return "Aplica a todos";
                              return (
                                elevatorTypes.find((t) => t.id === value)?.name ??
                                "Tipo de equipo"
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {elevatorTypes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Contenido (Checklist)</FormLabel>
                    <FormControl>
                      <ChecklistItemsEditor value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setIsCreateOpen(false); setEditingTemplate(null); }} className="text-xs border-border">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {editingTemplate ? "Guardar Cambios" : "Crear Plantilla"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Plantilla
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Confirmas la eliminación de la plantilla{" "}
              <strong className="text-foreground">&ldquo;{deletingTemplate?.name}&rdquo;</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingTemplate(null)} className="text-xs border-border">
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={handleDeleteConfirm} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
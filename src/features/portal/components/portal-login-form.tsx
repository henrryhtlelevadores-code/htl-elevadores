"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { portalLoginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Building2,
  KeyRound,
  Loader2,
  LogIn,
  ChevronRight,
  AlertTriangle,
  MapPin,
} from "lucide-react";

const portalLoginSchema = z.object({
  password: z.string().min(1, "Ingresa la contraseña de acceso"),
});

type PortalLoginValues = z.infer<typeof portalLoginSchema>;

interface PortalLoginFormProps {
  costCenterId: string;
  costCenterName: string;
  address: string | null;
  district: string | null;
  hasPassword: boolean;
}

export function PortalLoginForm({
  costCenterId,
  costCenterName,
  address,
  district,
  hasPassword,
}: PortalLoginFormProps) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PortalLoginValues>({
    resolver: zodResolver(portalLoginSchema),
    defaultValues: { password: "" },
  });

  function onSubmit(values: PortalLoginValues) {
    setSubmitError(null);
    startTransition(async () => {
      const res = await portalLoginAction({
        costCenterId,
        password: values.password,
      });
      if (res.success) {
        toast.success("Bienvenido", {
          description: "Acceso correcto al portal del edificio.",
        });
        router.push(res.redirectTo);
        router.refresh();
      } else {
        setSubmitError(res.error);
        toast.error("No se pudo ingresar", { description: res.error });
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mt-4 text-center">
            Portal del Edificio
          </h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">{costCenterName}</p>
          {(address || district) && (
            <p className="text-xs mt-1 text-center flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{[address, district].filter(Boolean).join(", ")}</span>
            </p>
          )}
        </div>

        {!hasPassword ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              Este edificio aún no tiene credenciales configuradas. Contacta a tu
              administrador de HTL para habilitar el acceso al portal.
            </div>
            <button
              onClick={() => router.refresh()}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {submitError && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Código del Edificio
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      readOnly
                      value={costCenterId}
                      className="bg-muted/50 border-border text-muted-foreground pl-10 h-11 font-mono text-xs focus-visible:ring-1 focus-visible:ring-primary"
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">
                        Contraseña de Acceso
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="bg-background border-border text-foreground pl-10 pr-9 h-11 font-mono focus-visible:ring-1 focus-visible:ring-primary"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-600 dark:text-red-400" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-semibold gap-2"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  {isPending ? "Verificando..." : "Ingresar al Portal"}
                  {!isPending && <ChevronRight className="size-4" />}
                </Button>
              </form>
            </Form>
          </>
        )}

        <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} HTL Elevadores · Portal de mantenimiento
        </p>
      </div>
    </div>
  );
}
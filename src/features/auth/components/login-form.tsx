"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { loginAction } from "../actions";
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
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  ShieldCheck,
  Building2,
  Wrench,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && next !== "/login" ? next : "/";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginValues) {
    setSubmitError(null);
    startTransition(async () => {
      const res = await loginAction(values);
      if (res.success) {
        toast.success("Sesión iniciada", {
          description: "Bienvenido al portal de HTL Elevadores.",
        });
        router.push(res.redirectTo ?? safeNext);
        router.refresh();
      } else {
        setSubmitError(res.error);
        toast.error("No se pudo iniciar sesión", { description: res.error });
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      {/* Panel de marca (solo desktop) */}
      <aside className="hidden lg:flex w-[44%] max-w-xl flex-col justify-between overflow-hidden relative bg-gradient-to-br from-[#0055AA] via-[#0066CC] to-[#003D7A] p-10 text-white select-none">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-black/20 blur-2xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white text-[#0066CC] font-extrabold shadow-lg">
            <span className="text-lg tracking-tighter">H</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight">HTL Elevadores</span>
            <span className="text-[11px] text-white/70 font-medium uppercase tracking-wider">
              Portal Privado
            </span>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            Gestión técnica de transporte vertical.
          </h1>
          <p className="text-sm text-white/80 leading-relaxed max-w-sm">
            Órdenes de trabajo, contratos, catálogos de equipos y seguridad operativa en un solo
            lugar.
          </p>
          <ul className="space-y-3 pt-1">
            <li className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                <Wrench className="size-4" />
              </span>
              Órdenes de trabajo y mantenimiento
            </li>
            <li className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                <Building2 className="size-4" />
              </span>
              Clientes, contratos y centros de costo
            </li>
            <li className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
                <ShieldCheck className="size-4" />
              </span>
              Seguridad con cifrado Argon2id
            </li>
          </ul>
        </div>

        <p className="relative text-[11px] text-white/50 font-medium">
          © {new Date().getFullYear()} HTL Elevadores · Uso exclusivo del personal autorizado.
        </p>
      </aside>

      {/* Panel del formulario */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          {/* Marca compacta (móvil) */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#0066CC] text-white font-extrabold shadow-md">
              <span className="text-lg tracking-tighter">H</span>
            </div>
            <div className="text-center">
              <p className="text-base font-bold tracking-tight">HTL Elevadores</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Portal Privado
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Accede con tu correo y contraseña corporativos.
            </p>
          </div>

          {submitError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Correo electrónico</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="usuario@htl.com.pe"
                          className="bg-background border-border text-sm pl-9 h-11 focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="bg-background border-border text-sm pl-9 pr-9 h-11 font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="w-full h-11 mt-2 bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2 shadow-md"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {isPending ? "Verificando..." : "Ingresar"}
                {!isPending && <ChevronRight className="size-4" />}
              </Button>
            </form>
          </Form>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            ¿No puedes acceder? Contacta al administrador del sistema.
          </p>
        </div>
      </main>
    </div>
  );
}
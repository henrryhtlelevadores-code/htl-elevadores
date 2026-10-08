import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { getSessionUser } from "@/features/auth/server";

export const metadata = {
  title: "Iniciar Sesión | HTL Elevadores",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Se valida contra la base (no solo la firma) para no entrar en bucle con
  // el layout cuando la sesión fue revocada.
  if (await getSessionUser()) {
    redirect("/");
  }

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return <LoginForm next={next} />;
}
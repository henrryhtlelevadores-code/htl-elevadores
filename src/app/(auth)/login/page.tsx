import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Iniciar Sesión | HTL Elevadores",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return <LoginForm next={next} />;
}
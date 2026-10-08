import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/features/auth/server";

export const dynamic = "force-dynamic";

const TECHNICIAN_ROLE = "TECNICO DE CAMPO";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  if (user.roleName === TECHNICIAN_ROLE) {
    redirect("/technician/work-orders");
  }

  return (
    <DashboardShell
      userName={user.fullName}
      roleName={user.roleName ?? "Sin rol"}
      permissions={user.permissions}
    >
      {children}
    </DashboardShell>
  );
}

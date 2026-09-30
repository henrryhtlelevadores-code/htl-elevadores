import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUserId } from "@/features/auth/server";
import { getUserSummary } from "@/features/users/actions";

export const dynamic = "force-dynamic";

const TECHNICIAN_ROLE = "TECNICO DE CAMPO";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const summary = await getUserSummary(userId);
  if (summary?.roleName === TECHNICIAN_ROLE) {
    redirect("/technician/work-orders");
  }

  return (
    <DashboardShell
      userName={summary?.fullName ?? "Usuario"}
      roleName={summary?.roleName ?? "Sin rol"}
    >
      {children}
    </DashboardShell>
  );
}

import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
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
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <DashboardTopbar
          userName={summary?.fullName ?? "Usuario"}
          roleName={summary?.roleName ?? "Sin rol"}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
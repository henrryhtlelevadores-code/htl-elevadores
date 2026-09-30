"use client";

import { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";

export function DashboardShell({
  children,
  userName,
  roleName,
}: {
  children: React.ReactNode;
  userName: string;
  roleName: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-background text-foreground transition-colors duration-200">
      <DashboardSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          userName={userName}
          roleName={roleName}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTechnicianContext } from "@/features/technician/queries";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getTechnicianContext();
  if (!context) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground transition-colors duration-200">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4 pt-[env(safe-area-inset-top)] sm:max-w-2xl sm:px-6 lg:max-w-5xl">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0066CC] text-[10px] font-black text-white">
              HTL
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">
                Técnico de Campo
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {context.fullName}
              </p>
            </div>
          </div>
          <ThemeToggle
            size="icon-sm"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
          />
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:max-w-2xl sm:px-6 lg:max-w-5xl">
        {children}
      </main>
    </div>
  );
}
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 h-14">
          <div className="flex min-w-0 items-center gap-2 flex-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0066CC] text-[10px] font-black text-white">
              HTL
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate">
                Técnico de Campo
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {context.fullName}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-10">
        {children}
      </main>
    </div>
  );
}
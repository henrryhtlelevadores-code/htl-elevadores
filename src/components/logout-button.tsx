"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logoutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      toast.success("Sesión cerrada", {
        description: "Vuelve pronto.",
      });
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleLogout}
      disabled={isPending}
      title="Cerrar sesión"
      className="text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
    </Button>
  );
}
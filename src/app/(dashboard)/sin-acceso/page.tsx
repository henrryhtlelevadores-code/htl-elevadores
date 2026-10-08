import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Sin acceso | HTL Elevadores",
};

export default function NoAccessPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-xs">
      <ShieldAlert className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-bold tracking-tight text-foreground">Sin acceso</h1>
      <p className="text-xs text-muted-foreground">
        Tu rol no tiene permiso para ver esta sección. Si necesitas acceso, pídeselo a un
        administrador.
      </p>
      <Link href="/" className="mt-2 text-xs font-semibold text-[#0066CC] hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}

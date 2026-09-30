"use client";

import { Cloud, CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { cn } from "cn";
import { useSyncStatus } from "../lib/sync-client";

export function SyncStatus() {
  const { online, pendingCount, syncing } = useSyncStatus();

  let label: string;
  let className: string;
  let icon: React.ReactNode;

  if (!online) {
    label = `Sin conexión (${pendingCount} pendientes)`;
    className =
      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    icon = <CloudOff className="size-3.5 shrink-0" />;
  } else if (syncing) {
    label = "Sincronizando...";
    className =
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    icon = <Loader2 className="size-3.5 shrink-0 animate-spin" />;
  } else if (pendingCount > 0) {
    label = `${pendingCount} en cola`;
    className =
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    icon = <CloudUpload className="size-3.5 shrink-0" />;
  } else {
    label = "Guardado";
    className =
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    icon = <Cloud className="size-3.5 shrink-0" />;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold",
        className
      )}
    >
      {icon}
      {label}
    </div>
  );
}
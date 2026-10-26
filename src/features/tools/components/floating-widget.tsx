"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Rnd = dynamic(() => import("react-rnd").then((mod) => mod.Rnd), {
  ssr: false,
});

const TITLEBAR_HEIGHT = 40;
const VIEWPORT_MARGIN = 16;
const TOPBAR_HEIGHT = 64;
/** Debajo de este ancho la ventana deja de ser arrastrable y se muestra como panel. */
const COMPACT_QUERY = "(max-width: 639px)";

function subscribeCompact(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** true en pantallas de teléfono. */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false
  );
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingWidgetProps {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onFocus: () => void;
  zIndex: number;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  offsetIndex?: number;
  children: ReactNode;
}

/** Ajusta la ventana para que quepa completa en la pantalla actual. */
function clampBounds(bounds: Bounds, minWidth: number, minHeight: number): Bounds {
  const maxWidth = Math.max(minWidth, window.innerWidth - VIEWPORT_MARGIN);
  const maxHeight = Math.max(minHeight, window.innerHeight - TOPBAR_HEIGHT - VIEWPORT_MARGIN);
  const width = Math.min(bounds.width, maxWidth);
  const height = Math.min(bounds.height, maxHeight);
  return {
    width,
    height,
    x: Math.min(Math.max(8, bounds.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(
      Math.max(TOPBAR_HEIGHT, bounds.y),
      Math.max(TOPBAR_HEIGHT, window.innerHeight - height - 8)
    ),
  };
}

function initialBounds(
  width: number,
  height: number,
  minWidth: number,
  minHeight: number,
  offsetIndex: number
): Bounds {
  return clampBounds(
    {
      width,
      height,
      x: window.innerWidth - width - VIEWPORT_MARGIN - offsetIndex * 24,
      y: window.innerHeight - height - VIEWPORT_MARGIN - offsetIndex * 24,
    },
    minWidth,
    minHeight
  );
}

function TitleBar({
  title,
  icon,
  minimized,
  draggable,
  onToggleMinimize,
  onClose,
}: {
  title: string;
  icon?: ReactNode;
  minimized: boolean;
  draggable: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-3",
        draggable && "htl-floating-drag-handle cursor-move"
      )}
    >
      {icon ? (
        <span className="text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
      <div className="htl-floating-no-drag flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={minimized ? "Restaurar ventana" : "Minimizar ventana"}
          title={minimized ? "Restaurar" : "Minimizar"}
          onClick={onToggleMinimize}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar ventana"
          title="Cerrar"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/**
 * Ventana flotante de las herramientas. En escritorio se arrastra y se
 * redimensiona; en teléfono ocupa el ancho de la pantalla como un panel inferior.
 * El contenido es un contenedor (`@container`) para adaptarse al tamaño de la
 * ventana, no al de la pantalla.
 */
export function FloatingWidget({
  title,
  icon,
  isOpen,
  onClose,
  onFocus,
  zIndex,
  defaultWidth = 680,
  defaultHeight = 480,
  minWidth = 360,
  minHeight = 280,
  offsetIndex = 0,
  children,
}: FloatingWidgetProps) {
  const compact = useCompactViewport();
  const [bounds, setBounds] = useState<Bounds | null>(() =>
    typeof window === "undefined"
      ? null
      : initialBounds(defaultWidth, defaultHeight, minWidth, minHeight, offsetIndex)
  );
  const [minimized, setMinimized] = useState(false);
  const [restoreHeight, setRestoreHeight] = useState(defaultHeight);

  // Si la pantalla se achica, la ventana vuelve a quedar visible completa.
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () =>
      setBounds((previous) => (previous ? clampBounds(previous, minWidth, minHeight) : previous));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, minWidth, minHeight]);

  if (!isOpen || !bounds || typeof window === "undefined") return null;

  function toggleMinimize() {
    if (!bounds) return;
    if (minimized) {
      setBounds({ ...bounds, height: Math.max(TITLEBAR_HEIGHT, restoreHeight) });
      setMinimized(false);
    } else {
      setRestoreHeight(bounds.height);
      setMinimized(true);
    }
  }

  const body = (
    <div className="@container flex min-h-0 flex-1 flex-col">{children}</div>
  );

  if (compact) {
    return (
      <div
        role="dialog"
        aria-label={title}
        onPointerDown={onFocus}
        style={{ zIndex }}
        className={cn(
          "fixed inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-card text-card-foreground shadow-2xl",
          minimized
            ? "h-[calc(2.5rem+env(safe-area-inset-bottom))]"
            : "top-[max(4rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]"
        )}
      >
        <TitleBar
          title={title}
          icon={icon}
          minimized={minimized}
          draggable={false}
          onToggleMinimize={() => setMinimized((value) => !value)}
          onClose={onClose}
        />
        {minimized ? null : body}
      </div>
    );
  }

  const effectiveMinWidth = Math.min(minWidth, window.innerWidth - 16);
  const effectiveMinHeight = Math.min(minHeight, window.innerHeight - TOPBAR_HEIGHT - 16);

  return (
    <Rnd
      position={{ x: bounds.x, y: bounds.y }}
      size={{ width: bounds.width, height: minimized ? TITLEBAR_HEIGHT : bounds.height }}
      minWidth={effectiveMinWidth}
      minHeight={minimized ? TITLEBAR_HEIGHT : effectiveMinHeight}
      bounds="window"
      dragHandleClassName="htl-floating-drag-handle"
      cancel=".htl-floating-no-drag"
      enableResizing={!minimized}
      onDragStop={(_event, data) => {
        setBounds((previous) => (previous ? { ...previous, x: data.x, y: data.y } : previous));
      }}
      onResizeStop={(_event, _direction, element, _delta, position) => {
        const width = Number.parseInt(element.style.width, 10);
        const height = Number.parseInt(element.style.height, 10);
        setBounds({
          x: position.x,
          y: position.y,
          width: Number.isFinite(width) ? width : bounds.width,
          height: Number.isFinite(height) ? height : bounds.height,
        });
      }}
      style={{ zIndex }}
      resizeHandleStyles={{
        bottomRight: { width: 16, height: 16, right: 2, bottom: 2, cursor: "nwse-resize" },
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        onPointerDown={onFocus}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <TitleBar
          title={title}
          icon={icon}
          minimized={minimized}
          draggable
          onToggleMinimize={toggleMinimize}
          onClose={onClose}
        />
        {minimized ? null : body}
      </div>
    </Rnd>
  );
}

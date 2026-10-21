"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const Rnd = dynamic(() => import("react-rnd").then((mod) => mod.Rnd), {
  ssr: false,
});

const TITLEBAR_HEIGHT = 40;
const VIEWPORT_MARGIN = 16;

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

function initialBounds(
  width: number,
  height: number,
  offsetIndex: number
): { x: number; y: number; width: number; height: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const safeWidth = Math.min(width, Math.max(300, viewportWidth - 24));
  const safeHeight = Math.min(height, Math.max(280, viewportHeight - 96));
  return {
    width: safeWidth,
    height: safeHeight,
    x: Math.max(
      8,
      viewportWidth - safeWidth - VIEWPORT_MARGIN - offsetIndex * 24
    ),
    y: Math.max(
      72,
      viewportHeight - safeHeight - VIEWPORT_MARGIN - offsetIndex * 24
    ),
  };
}

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
  const [bounds, setBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(() =>
    typeof window === "undefined"
      ? null
      : initialBounds(
          Math.min(defaultWidth, Math.max(minWidth, window.innerWidth - 24)),
          defaultHeight,
          offsetIndex
        )
  );
  const [minimized, setMinimized] = useState(false);
  const [restoreHeight, setRestoreHeight] = useState(defaultHeight);

  if (!isOpen || !bounds || typeof window === "undefined") return null;

  const currentSize = minimized
    ? { width: bounds.width, height: TITLEBAR_HEIGHT }
    : { width: bounds.width, height: bounds.height };
  const effectiveMinWidth = Math.min(minWidth, window.innerWidth - 16);
  const effectiveMinHeight = Math.min(minHeight, window.innerHeight - 96);

  return (
    <Rnd
      position={{ x: bounds.x, y: bounds.y }}
      size={currentSize}
      minWidth={effectiveMinWidth}
      minHeight={minimized ? TITLEBAR_HEIGHT : effectiveMinHeight}
      bounds="window"
      dragHandleClassName="htl-floating-drag-handle"
      cancel=".htl-floating-no-drag"
      enableResizing={!minimized}
      onDragStop={(_event, data) => {
        setBounds((previous) =>
          previous ? { ...previous, x: data.x, y: data.y } : previous
        );
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
        bottomRight: {
          width: 16,
          height: 16,
          right: 2,
          bottom: 2,
          cursor: "nwse-resize",
        },
      }}
    >
      <div
        role="region"
        aria-label={title}
        onPointerDown={onFocus}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
      >
        <div className="htl-floating-drag-handle flex h-10 shrink-0 cursor-move items-center gap-2 border-b border-border bg-muted/60 px-3">
          {icon ? (
            <span className="text-muted-foreground" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {title}
          </span>
          <div className="htl-floating-no-drag flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={minimized ? "Restaurar ventana" : "Minimizar ventana"}
              title={minimized ? "Restaurar" : "Minimizar"}
              onClick={() => {
                if (minimized) {
                  setBounds((previous) =>
                    previous
                      ? {
                          ...previous,
                          height: Math.max(TITLEBAR_HEIGHT, restoreHeight),
                        }
                      : previous
                  );
                  setMinimized(false);
                } else {
                  setRestoreHeight(bounds.height);
                  setMinimized(true);
                }
              }}
            >
              <Minus />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Cerrar ventana"
              title="Cerrar"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </Rnd>
  );
}

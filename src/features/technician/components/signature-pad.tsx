"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "cn";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  className?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    const sizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(240 * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#000000";
    }, []);

    useEffect(() => {
      sizeCanvas();
      const onResize = () => sizeCanvas();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [sizeCanvas]);

    const getPoint = (event: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const start = (event: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawingRef.current = true;
      lastPointRef.current = getPoint(event);
      canvas.setPointerCapture(event.pointerId);
    };

    const move = (event: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!drawingRef.current || !canvas) return;
      const point = getPoint(event);
      const last = lastPointRef.current;
      if (!point || !last) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      if (!hasInk) setHasInk(true);
    };

    const end = (event: React.PointerEvent) => {
      drawingRef.current = false;
      lastPointRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      sizeCanvas();
      setHasInk(false);
    }, [sizeCanvas]);

    useImperativeHandle(
      ref,
      () => ({
        getDataUrl: () => {
          const canvas = canvasRef.current;
          if (!canvas || !hasInk) return null;
          return canvas.toDataURL("image/png");
        },
        clear,
      }),
      [clear, hasInk]
    );

    return (
      <div>
        <div
          ref={containerRef}
          className={cn(
            "relative w-full rounded-xl border border-border bg-white overflow-hidden",
            className
          )}
        >
          <canvas
            ref={canvasRef}
            className="block h-[240px] w-full touch-none cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-black/30 pb-16 select-none">
                Firma aquí
              </span>
            </div>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clear}
            disabled={!hasInk}
            className="min-h-[44px]"
          >
            <Eraser className="size-4" />
            Repetir
          </Button>
        </div>
      </div>
    );
  }
);

export { SignaturePad };
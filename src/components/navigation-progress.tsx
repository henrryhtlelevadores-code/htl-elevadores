"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { subscribeNavigationStart } from "@/lib/navigation-progress";

// Las navegaciones más rápidas que esto no muestran la barra, para no parpadear.
const SHOW_DELAY_MS = 120;
// Si la navegación nunca termina (error, cancelación), la barra se retira sola.
const MAX_DURATION_MS = 15_000;

function isNavigationClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  // Solo cambia el #hash o es la misma página: no hay carga.
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const finishRef = useRef<() => void>(undefined);

  useEffect(() => {
    let active = false;
    let shown = false;
    const timers: { show?: number; trickle?: number; max?: number; hide?: number } = {};

    const clearTimers = () => {
      window.clearTimeout(timers.show);
      window.clearInterval(timers.trickle);
      window.clearTimeout(timers.max);
      window.clearTimeout(timers.hide);
    };

    const finish = () => {
      if (!active) return;
      active = false;
      clearTimers();
      if (!shown) return;
      setProgress(100);
      timers.hide = window.setTimeout(() => {
        shown = false;
        setVisible(false);
        setProgress(0);
      }, 250);
    };

    const start = () => {
      clearTimers();
      active = true;
      timers.show = window.setTimeout(() => {
        shown = true;
        setVisible(true);
        setProgress(15);
        // Avanza cada vez más lento hacia el 90 % hasta que llegue la página.
        timers.trickle = window.setInterval(() => {
          setProgress((p) => p + (90 - p) * 0.1);
        }, 200);
      }, SHOW_DELAY_MS);
      timers.max = window.setTimeout(finish, MAX_DURATION_MS);
    };

    const onClick = (event: MouseEvent) => {
      if (isNavigationClick(event)) start();
    };
    // En captura: corre antes que el onClick de <Link>, que llama a preventDefault.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    const unsubscribe = subscribeNavigationStart(start);
    finishRef.current = finish;
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      unsubscribe();
      clearTimers();
      finishRef.current = undefined;
    };
  }, []);

  // La URL cambió: la nueva página ya se está mostrando.
  useEffect(() => {
    finishRef.current?.();
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms ease" }}
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--primary)]"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? "none" : "width 200ms ease-out",
        }}
      />
    </div>
  );
}

/** Barra fina en el borde superior mientras se carga una página nueva. */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}

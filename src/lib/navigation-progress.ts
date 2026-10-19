"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

/**
 * Señal global de "hay una navegación en curso". La barra superior
 * (`NavigationProgress`) se suscribe; los clics en enlaces la disparan solos
 * y las navegaciones por código usan `useProgressRouter`.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function startNavigationProgress() {
  listeners.forEach((listener) => listener());
}

export function subscribeNavigationStart(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Igual que `useRouter`, pero `push` y `replace` encienden la barra de carga. */
export function useProgressRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      ...router,
      push: (...args: Parameters<typeof router.push>) => {
        startNavigationProgress();
        router.push(...args);
      },
      replace: (...args: Parameters<typeof router.replace>) => {
        startNavigationProgress();
        router.replace(...args);
      },
    }),
    [router],
  );
}

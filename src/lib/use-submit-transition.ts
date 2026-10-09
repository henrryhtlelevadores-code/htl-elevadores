"use client";

import { useCallback, useRef, useTransition } from "react";

/**
 * `useTransition` que ignora un segundo envío mientras el primero sigue en
 * curso.
 *
 * Bloquear el botón con `isPending` no alcanza: `form.handleSubmit` valida de
 * forma asíncrona antes de llamar al handler, y en ese intervalo el botón
 * sigue habilitado, así que un doble clic o un Enter repetido llegaban a
 * crear dos registros. El candado es una ref, que cambia en el acto, sin
 * esperar a que React vuelva a pintar.
 *
 * Se usa igual que `useTransition`: `const [isPending, startTransition] = useSubmitTransition();`
 */
export function useSubmitTransition(): [boolean, (action: () => Promise<void>) => void] {
  const [isPending, startTransition] = useTransition();
  const busy = useRef(false);

  const start = useCallback((action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        await action();
      } finally {
        busy.current = false;
      }
    });
  }, []);

  return [isPending, start];
}

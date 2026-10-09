"use client";

import { useCallback, useEffect, useRef } from "react";

/** Tiempo tras cambiar de paso en el que se ignoran clics en el pie. */
const SETTLE_MS = 600;

/**
 * Protege los asistentes por pasos de los dobles clics.
 *
 * "Siguiente" y el botón final ocupan el mismo lugar: con un doble clic, el
 * segundo clic caía en el botón del paso siguiente y saltaba un paso o
 * guardaba sin que el usuario viera la última pantalla. Además, como
 * "Siguiente" valida de forma asíncrona, dos clics seguidos avanzaban dos
 * pasos.
 *
 * - `next(advance)`: ejecuta el avance una sola vez a la vez.
 * - `justArrived()`: true justo después de cambiar de paso; el envío final
 *   debe ignorarse en ese caso.
 */
export function useStepGuard(step: number) {
  const advancing = useRef(false);
  const enteredAt = useRef(0);
  const previousStep = useRef(step);

  useEffect(() => {
    // Solo cuenta un cambio de paso, no el montaje.
    if (previousStep.current === step) return;
    previousStep.current = step;
    enteredAt.current = Date.now();
  }, [step]);

  const justArrived = useCallback(() => Date.now() - enteredAt.current < SETTLE_MS, []);

  const next = useCallback(
    async (advance: () => Promise<void> | void) => {
      if (advancing.current || justArrived()) return;
      advancing.current = true;
      try {
        await advance();
      } finally {
        advancing.current = false;
      }
    },
    [justArrived]
  );

  return { next, justArrived };
}

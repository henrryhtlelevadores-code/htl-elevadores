"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_SRC = {
  blue: "/logos/fortex-azul.png",
  white: "/logos/fortex-blanco.png",
} as const;

/**
 * `blue` y `white` fijan la variante (útiles sobre fondos oscuros o claros
 * conocidos). `auto` alterna según el tema: azul en claro, blanco en oscuro.
 *
 * En `auto` se renderizan ambas imágenes y se alternan con `dark:`, igual que
 * `theme-toggle`, para evitar desajustes de hidratación.
 */
export type FortexLogoVariant = "auto" | keyof typeof LOGO_SRC;

export interface FortexLogoProps {
  variant?: FortexLogoVariant;
  className?: string;
  priority?: boolean;
  alt?: string;
  /** Ancho máximo del logo. Por defecto 180px. */
  maxWidth?: number;
}

/** Proporción intrínseca de los PNG (2555x1011) para no deformarlos. */
const INTRINSIC_SIZE = { width: 253, height: 100 };

export function FortexLogo({
  variant = "auto",
  className,
  priority = false,
  alt = "Fortex Digital Solutions",
  maxWidth = 180,
}: FortexLogoProps) {
  // El ancho máximo va en `style` porque una clase arbitraria construida en
  // runtime (`max-w-[${n}px]`) no la detectaría el escáner de Tailwind.
  // `h-auto` deja que la altura derive del ancho para mantener la proporción,
  // y `object-contain` evita recortes si el contenedor es menor.
  const style = { maxWidth: `${maxWidth}px` };
  const base = cn("h-auto w-auto object-contain", className);

  if (variant !== "auto") {
    return (
      <Image
        src={LOGO_SRC[variant]}
        alt={alt}
        priority={priority}
        className={base}
        style={style}
        {...INTRINSIC_SIZE}
      />
    );
  }

  return (
    <>
      <Image
        src={LOGO_SRC.blue}
        alt={alt}
        priority={priority}
        className={cn(base, "dark:hidden")}
        style={style}
        {...INTRINSIC_SIZE}
      />
      <Image
        src={LOGO_SRC.white}
        alt={alt}
        priority={priority}
        className={cn(base, "hidden dark:block")}
        style={style}
        {...INTRINSIC_SIZE}
      />
    </>
  );
}

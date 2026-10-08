import "server-only";
import { headers } from "next/headers";

/** Valor usado cuando no hay una IP en la que se pueda confiar. */
export const UNKNOWN_IP = "unknown";

/**
 * IP del cliente para el rate limit.
 *
 * Solo se confía en las cabeceras que fija la plataforma: en Vercel,
 * `x-real-ip` y `x-vercel-forwarded-for` las escribe el borde y el cliente no
 * puede falsificarlas. `X-Forwarded-For` crudo NO se usa: lo controla el
 * cliente y rotarlo permitiría esquivar el bloqueo.
 *
 * Fuera de Vercel se devuelve "unknown", con lo que el límite pasa a contar
 * solo por identificador (correo o sede). Si se despliega detrás de otro
 * proxy de confianza, añade aquí la cabecera que ese proxy garantice.
 */
export async function getClientIp(): Promise<string> {
  if (!process.env.VERCEL) return UNKNOWN_IP;
  const list = await headers();
  const candidate =
    list.get("x-real-ip") ?? list.get("x-vercel-forwarded-for")?.split(",")[0];
  const ip = candidate?.trim();
  return ip && ip.length <= 64 ? ip : UNKNOWN_IP;
}

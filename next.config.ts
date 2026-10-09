import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** Origen (esquema + host) de una URL de entorno, o `null` si no es válida. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const unique = (values: (string | null)[]) => [...new Set(values.filter(Boolean))] as string[];

// Bucket público de R2: logos, firmas, fotos de evidencia e imágenes.
const r2PublicOrigins = unique([
  originOf(process.env.R2_PUBLIC_URL),
  originOf(process.env.NEXT_PUBLIC_R2_PUBLIC_URL),
  originOf(process.env.NEXT_PUBLIC_R2_HEADER_URL),
  originOf(process.env.NEXT_PUBLIC_R2_FOOTER_URL),
  originOf(process.env.NEXT_PUBLIC_R2_LOGO_URL),
  originOf(process.env.NEXT_PUBLIC_R2_FIRM_URL),
  "https://*.r2.dev",
]);

// URLs firmadas del bucket privado (PDFs en <iframe>). El host no cambia
// entre firmas; solo la query.
const r2SignedOrigins = ["https://*.r2.cloudflarestorage.com"];

// Dictado por voz del técnico en Safari/Firefox (Whisper local con
// @huggingface/transformers): descarga el modelo y el runtime WASM.
const voiceModelOrigins = [
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
  "https://cdn.jsdelivr.net",
];

/**
 * Política estática (sin nonce). `script-src` conserva 'unsafe-inline'
 * porque Next inserta scripts en línea para la hidratación; quitarlo exige
 * nonces generados en el proxy. Ver SECURITY.md.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${r2PublicOrigins.join(" ")}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${[...r2PublicOrigins, ...voiceModelOrigins].join(" ")}${isDev ? " ws: wss:" : ""}`,
  `frame-src 'self' data: blob: ${r2SignedOrigins.join(" ")}`,
  `media-src 'self' blob: ${r2SignedOrigins.join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  {
    // CSP_REPORT_ONLY=true la despliega sin bloquear, para observar antes.
    key:
      process.env.CSP_REPORT_ONLY === "true"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // La app del técnico usa cámara (fotos), micrófono (dictado) y ubicación.
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=(self)",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "serial=()",
      "midi=()",
      "browsing-topics=()",
    ].join(", "),
  },
  // HSTS solo tiene sentido sobre HTTPS; en desarrollo (http) se omite.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@aws-sdk/client-s3"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

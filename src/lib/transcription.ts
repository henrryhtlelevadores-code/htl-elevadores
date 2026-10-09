import "server-only";

/**
 * Transcripción de notas de voz con Whisper en Cloudflare Workers AI.
 *
 * Variables (no se incluyen en el código):
 *   CLOUDFLARE_ACCOUNT_ID  ID de la cuenta de Cloudflare
 *   CLOUDFLARE_AI_TOKEN    token de API con permiso de Workers AI
 *   WHISPER_MODEL          opcional; por defecto @cf/openai/whisper-large-v3-turbo
 */

const DEFAULT_MODEL = "@cf/openai/whisper-large-v3-turbo";
const TIMEOUT_MS = 60_000;

/** Vocabulario del rubro para que Whisper escriba bien los términos técnicos. */
const CONTEXT_PROMPT =
  "Nota de un técnico de mantenimiento de ascensores en Perú: cabina, guías, freno, " +
  "foso, cuarto de máquinas, polea, cables de tracción, operador de puertas, botonera.";

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN);
}

export class TranscriptionError extends Error {}

/** Transcribe un audio (M4A/AAC, MP3, WAV…) en español y devuelve el texto. */
export async function transcribeAudio(bytes: Uint8Array): Promise<string> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!account || !token) throw new TranscriptionError("La transcripción no está configurada.");
  const model = process.env.WHISPER_MODEL || DEFAULT_MODEL;

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: Buffer.from(bytes).toString("base64"),
      task: "transcribe",
      language: "es",
      vad_filter: true,
      initial_prompt: CONTEXT_PROMPT,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: { text?: string };
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok || !body?.success) {
    const detail = body?.errors?.map((e) => e.message).filter(Boolean).join("; ");
    throw new TranscriptionError(`Workers AI respondió ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return (body.result?.text ?? "").trim();
}

/**
 * Prueba la transcripción con Whisper (Cloudflare Workers AI) sobre un
 * archivo de audio local. No toca la base de datos ni R2.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/test-transcription.ts ruta/a/nota.m4a
 */
import { readFileSync } from "node:fs";
import { isTranscriptionConfigured, transcribeAudio } from "../src/lib/transcription";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Indica la ruta de un audio (m4a, mp3 o wav).");
  if (!isTranscriptionConfigured()) {
    throw new Error("Faltan CLOUDFLARE_ACCOUNT_ID y/o CLOUDFLARE_AI_TOKEN en el entorno.");
  }
  const started = Date.now();
  const text = await transcribeAudio(new Uint8Array(readFileSync(file)));
  console.log(`Transcripción (${((Date.now() - started) / 1000).toFixed(1)} s):`);
  console.log(text || "(sin voz detectada)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

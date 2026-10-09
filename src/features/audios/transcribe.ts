import "server-only";

import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, workOrderElevatorAudios } from "@/db/index";
import { readPrivateObject } from "@/lib/r2";
import { isTranscriptionConfigured, transcribeAudio } from "@/lib/transcription";

export type TranscriptionOutcome =
  | { status: "DONE"; transcript: string | null }
  | { status: "FAILED"; error: string }
  | { status: "SKIPPED"; reason: string };

/**
 * Transcribe una nota de voz guardada en el bucket privado y deja el texto
 * en `work_order_elevator_audios`. Estados: PENDING mientras trabaja, DONE
 * con el texto (vacío si no se entendió nada) o FAILED.
 *
 * Sin `overwrite` no toca una transcripción que ya existe: puede ser una que
 * el administrador corrigió a mano.
 */
export async function transcribeStoredAudio(
  audioId: string,
  { overwrite = false }: { overwrite?: boolean } = {}
): Promise<TranscriptionOutcome> {
  if (!isTranscriptionConfigured()) return { status: "SKIPPED", reason: "La transcripción no está configurada." };

  const [audio] = await db
    .select({ key: workOrderElevatorAudios.key, transcript: workOrderElevatorAudios.transcript })
    .from(workOrderElevatorAudios)
    .where(eq(workOrderElevatorAudios.id, audioId))
    .limit(1);
  if (!audio) return { status: "SKIPPED", reason: "La nota de voz ya no existe." };
  if (audio.transcript && !overwrite) return { status: "SKIPPED", reason: "Ya tiene transcripción." };

  await db
    .update(workOrderElevatorAudios)
    .set({ transcriptStatus: "PENDING" })
    .where(eq(workOrderElevatorAudios.id, audioId));

  try {
    const bytes = await readPrivateObject(audio.key);
    if (!bytes) throw new Error("El archivo de audio no está en el almacenamiento.");
    const text = await transcribeAudio(bytes);
    await db
      .update(workOrderElevatorAudios)
      .set({ transcript: text || null, transcriptStatus: "DONE" })
      .where(eq(workOrderElevatorAudios.id, audioId));
    return { status: "DONE", transcript: text || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error al transcribir la nota de voz:", audioId, message);
    await db
      .update(workOrderElevatorAudios)
      .set({ transcriptStatus: "FAILED" })
      .where(eq(workOrderElevatorAudios.id, audioId));
    return { status: "FAILED", error: message };
  }
}

/**
 * Transcribe después de responder a la app, para que subir el audio no
 * espere a Whisper. Fuera de una petición de Next (scripts, tests) corre en
 * segundo plano sin bloquear.
 */
export function transcribeAfterResponse(audioId: string): void {
  if (!isTranscriptionConfigured()) return;
  const run = () => transcribeStoredAudio(audioId).then(() => undefined);
  try {
    after(run);
  } catch {
    void run().catch(() => undefined);
  }
}

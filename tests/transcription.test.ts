import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  return {
    ...actual,
    readPrivateObject: async () => new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 1, 2, 3, 4]),
  };
});

import { eq } from "drizzle-orm";
import {
  db,
  elevatorTypes,
  elevatorUnities,
  workOrderElevatorAudios,
  workOrderElevators,
  workOrders,
} from "@/db";
import { transcribeStoredAudio } from "@/features/audios/transcribe";
import { createCostCenter } from "./helpers/fixtures";

const id = () => randomUUID().toUpperCase();

async function audioRow(transcript: string | null = null) {
  const center = await createCostCenter();
  const typeId = id();
  await db.insert(elevatorTypes).values({ id: typeId, name: `Tipo ${typeId.slice(0, 8)}` });
  const unityId = id();
  await db.insert(elevatorUnities).values({
    id: unityId,
    costCenterId: center.id,
    elevatorTypeId: typeId,
    internalCode: `ASC-${unityId.slice(0, 6)}`,
    name: "Ascensor 1",
  });
  const workOrderId = id();
  await db.insert(workOrders).values({ id: workOrderId, otNumber: `OT-${workOrderId.slice(0, 8)}`, costCenterId: center.id });
  const elevatorId = id();
  await db.insert(workOrderElevators).values({ id: elevatorId, workOrderId, elevatorUnityId: unityId });
  const audioId = id();
  await db.insert(workOrderElevatorAudios).values({
    id: audioId,
    workOrderElevatorId: elevatorId,
    key: `work-orders/x/y/audio-${audioId.toLowerCase()}.m4a`,
    durationMs: 5000,
    transcript,
    createdAt: Math.floor(Date.now() / 1000),
  });
  return audioId;
}

const row = async (audioId: string) =>
  (await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId)))[0];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "cuenta-de-prueba";
  process.env.CLOUDFLARE_AI_TOKEN = "token-de-prueba";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_AI_TOKEN;
  vi.unstubAllGlobals();
});

describe("transcripción con Whisper (Workers AI)", () => {
  it("envía el audio en base64 en español y guarda el texto", async () => {
    const audioId = await audioRow();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: { text: " Se cambió el freno. " } }), { status: 200 })
    );

    const outcome = await transcribeStoredAudio(audioId);
    expect(outcome).toEqual({ status: "DONE", transcript: "Se cambió el freno." });
    expect(await row(audioId)).toMatchObject({ transcript: "Se cambió el freno.", transcriptStatus: "DONE" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/cuenta-de-prueba/ai/run/@cf/openai/whisper-large-v3-turbo"
    );
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ language: "es", task: "transcribe" });
    expect(Buffer.from(body.audio, "base64")[4]).toBe(0x66);
  });

  it("marca FAILED si Workers AI responde con error", async () => {
    const audioId = await audioRow();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false, errors: [{ message: "Formato no soportado" }] }), { status: 400 })
    );

    const outcome = await transcribeStoredAudio(audioId);
    expect(outcome).toMatchObject({ status: "FAILED" });
    expect(outcome.status === "FAILED" && outcome.error).toContain("Formato no soportado");
    expect(await row(audioId)).toMatchObject({ transcript: null, transcriptStatus: "FAILED" });
  });

  it("no pisa una transcripción existente salvo que se pida", async () => {
    const audioId = await audioRow("Texto corregido por el administrador");
    expect(await transcribeStoredAudio(audioId)).toMatchObject({ status: "SKIPPED" });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, result: { text: "Nuevo" } })));
    expect(await transcribeStoredAudio(audioId, { overwrite: true })).toEqual({ status: "DONE", transcript: "Nuevo" });
  });

  it("sin variables configuradas no hace nada", async () => {
    delete process.env.CLOUDFLARE_AI_TOKEN;
    const audioId = await audioRow();
    expect(await transcribeStoredAudio(audioId)).toMatchObject({ status: "SKIPPED" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await row(audioId)).toMatchObject({ transcriptStatus: "NONE" });
  });
});

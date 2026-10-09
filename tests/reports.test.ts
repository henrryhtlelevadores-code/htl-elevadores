import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  return {
    ...actual,
    isPrivatePdfStorageConfigured: () => true,
    getSignedPrivateUrl: async (key: string) => `https://signed.example/${key}?sig=1`,
  };
});

import {
  db,
  elevatorTypes,
  elevatorUnities,
  workOrderElevatorAudios,
  workOrderElevatorPhotos,
  workOrderElevators,
  workOrders,
} from "@/db";
import { eq } from "drizzle-orm";
import { getCompletedWorkOrders, updateAudioTranscript } from "@/features/reports/actions";
import { getPortalWorkOrderDocument } from "@/features/portal/queries";
import { resetRequest } from "./helpers/request";
import { createCostCenter, createUser, loginAs } from "./helpers/fixtures";

const id = () => randomUUID().toUpperCase();

async function completedOrderWithEvidence() {
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
  await db.insert(workOrders).values({
    id: workOrderId,
    otNumber: `OT-${workOrderId.slice(0, 8)}`,
    costCenterId: center.id,
    status: "COMPLETED",
    completedAt: Math.floor(Date.now() / 1000),
  });
  const elevatorId = id();
  await db.insert(workOrderElevators).values({ id: elevatorId, workOrderId, elevatorUnityId: unityId });
  await db.insert(workOrderElevatorPhotos).values({
    id: id(),
    workOrderElevatorId: elevatorId,
    url: "https://public.example/foto.jpg",
    tag: "POINT",
    description: "Desgaste en la guía de cabina",
  });
  const audioId = id();
  await db.insert(workOrderElevatorAudios).values({
    id: audioId,
    workOrderElevatorId: elevatorId,
    key: `work-orders/x/y/audio-${audioId.toLowerCase()}.m4a`,
    durationMs: 12_000,
    createdAt: Math.floor(Date.now() / 1000),
  });
  return { workOrderId, audioId, costCenterId: center.id };
}

beforeEach(async () => {
  resetRequest();
  const admin = await createUser({ permissions: ["reports"] });
  await loginAs(admin.id);
});

describe("informes", () => {
  it("incluye los comentarios de las fotos y las notas de voz con URL firmada", async () => {
    const { workOrderId, audioId } = await completedOrderWithEvidence();
    const report = (await getCompletedWorkOrders()).find((wo) => wo.id === workOrderId);
    const elevator = report?.elevators[0];

    expect(elevator?.photos[0]?.description).toBe("Desgaste en la guía de cabina");
    expect(elevator?.audios).toHaveLength(1);
    expect(elevator?.audios[0]).toMatchObject({ id: audioId, durationMs: 12_000, transcriptStatus: "NONE" });
    expect(elevator?.audios[0]?.url).toMatch(/^https:\/\/signed\.example\/work-orders\//);
  });

  it("el administrador corrige la transcripción", async () => {
    const { audioId } = await completedOrderWithEvidence();
    expect(await updateAudioTranscript(audioId, "  Se cambió el freno  ")).toMatchObject({ success: true });
    const [row] = await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId));
    expect(row).toMatchObject({ transcript: "Se cambió el freno", transcriptStatus: "DONE" });

    expect(await updateAudioTranscript(audioId, "   ")).toMatchObject({ success: true });
    const [cleared] = await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId));
    expect(cleared).toMatchObject({ transcript: null, transcriptStatus: "NONE" });
  });

  it("el portal del cliente nunca recibe audios ni transcripciones", async () => {
    const { workOrderId, audioId, costCenterId } = await completedOrderWithEvidence();
    await updateAudioTranscript(audioId, "TEXTO-INTERNO-DEL-AUDIO");
    await db.update(workOrders).set({ approvalStatus: "APPROVED" }).where(eq(workOrders.id, workOrderId));

    const doc = await getPortalWorkOrderDocument(costCenterId, workOrderId);
    expect(doc).not.toBeNull();
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/audio/i);
    expect(json).not.toContain("TEXTO-INTERNO-DEL-AUDIO");
    expect(json).toContain("Desgaste en la guía de cabina");
  });
});

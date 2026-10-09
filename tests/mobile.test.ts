import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// R2 no existe en los tests: se sustituyen las subidas y las URLs firmadas.
const r2 = vi.hoisted(() => ({ uploads: [] as string[], privateUploads: [] as string[] }));
vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  return {
    ...actual,
    uploadToR2: async (key: string) => {
      r2.uploads.push(key);
      return `https://public.example/${key}`;
    },
    deleteR2ObjectByUrl: async () => {},
    isPrivatePdfStorageConfigured: () => true,
    uploadPrivateObject: async (key: string) => {
      r2.privateUploads.push(key);
    },
    deletePrivatePdf: async () => {},
    getSignedPrivateUrl: async (key: string) => `https://signed.example/${key}?sig=1`,
  };
});

import { eq } from "drizzle-orm";
import {
  db,
  elevatorTypes,
  elevatorUnities,
  safetyTemplates,
  serviceTypes,
  users,
  workOrderElevatorAudios,
  workOrderElevatorPhotos,
  workOrderElevatorSafetyItems,
  workOrderElevators,
  workOrderTasks,
  workOrders,
} from "@/db";
import { POST as login } from "@/app/api/mobile/v1/auth/login/route";
import { POST as refresh } from "@/app/api/mobile/v1/auth/refresh/route";
import { GET as listOrders } from "@/app/api/mobile/v1/work-orders/route";
import { GET as getOrder } from "@/app/api/mobile/v1/work-orders/[id]/route";
import { POST as startOrder } from "@/app/api/mobile/v1/work-orders/[id]/start/route";
import { POST as completeOrder } from "@/app/api/mobile/v1/work-orders/[id]/complete/route";
import { POST as safetyItems } from "@/app/api/mobile/v1/elevators/[id]/safety/items/route";
import { POST as safetyComplete } from "@/app/api/mobile/v1/elevators/[id]/safety/complete/route";
import { POST as saveTasks } from "@/app/api/mobile/v1/elevators/[id]/tasks/route";
import { POST as saveFindings } from "@/app/api/mobile/v1/elevators/[id]/findings/route";
import { POST as completeElevator } from "@/app/api/mobile/v1/elevators/[id]/complete/route";
import { POST as addPhoto } from "@/app/api/mobile/v1/elevators/[id]/photos/route";
import { POST as addAudio } from "@/app/api/mobile/v1/elevators/[id]/audios/route";
import { DELETE as deletePhoto } from "@/app/api/mobile/v1/photos/[id]/route";
import { DELETE as deleteAudio } from "@/app/api/mobile/v1/audios/[id]/route";
import { getSessionUser } from "@/features/auth/server";
import { SESSION_COOKIE } from "@/features/auth/session";
import { changeUserPassword } from "@/features/users/actions";
import { createSessionToken } from "@/lib/session-token";
import { setRateLimitStore } from "@/lib/rate-limit";
import { MemoryRateLimitStore } from "@/lib/rate-limit/store";
import { cookieJar, requestHeaders, resetRequest } from "./helpers/request";
import { STAFF_PASSWORD, createCostCenter, createUser, loginAs } from "./helpers/fixtures";

const id = () => randomUUID().toUpperCase();
const params = (value: string) => ({ params: Promise.resolve({ id: value }) });
const url = "http://localhost/api/mobile/v1/x";

const jsonRequest = (body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const M4A = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0, 0]);

function formRequest(fields: Record<string, string>, file: Uint8Array, filename: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("file", new File([file as BlobPart], filename));
  return new Request(url, { method: "POST", body: form });
}

/** Deja la petición autenticada con el token Bearer de ese técnico. */
async function signIn(email: string, password = STAFF_PASSWORD) {
  resetRequest();
  const response = await login(jsonRequest({ email, password }));
  const body = await response.json();
  if (body.token) requestHeaders.set("authorization", `Bearer ${body.token}`);
  return { response, body };
}

const TECHNICIAN = ["work_orders:field", "safety"];

/** Una OT asignada al técnico con un equipo, su plantilla de seguridad y dos tareas. */
async function createWorkOrder(technicianId: string, serviceCode: string) {
  const costCenter = await createCostCenter();
  const typeId = id();
  await db.insert(elevatorTypes).values({ id: typeId, name: `Tipo ${typeId.slice(0, 8)}` });
  await db.insert(safetyTemplates).values({
    id: id(),
    type: "SAFETY",
    equipmentTypeId: typeId,
    name: "Checklist",
    content: ["¿Usa EPP?", "¿Área señalizada?", "¿Energía bloqueada?"],
  });
  const unityId = id();
  await db.insert(elevatorUnities).values({
    id: unityId,
    costCenterId: costCenter.id,
    elevatorTypeId: typeId,
    internalCode: `ASC-${unityId.slice(0, 6)}`,
    name: "Ascensor 1",
  });
  const serviceTypeId = id();
  await db.insert(serviceTypes).values({ id: serviceTypeId, code: serviceCode, name: serviceCode, category: "X" });
  const workOrderId = id();
  await db.insert(workOrders).values({
    id: workOrderId,
    otNumber: `OT-${workOrderId.slice(0, 8)}`,
    costCenterId: costCenter.id,
    technicianId,
    serviceTypeId,
  });
  const elevatorId = id();
  await db.insert(workOrderElevators).values({ id: elevatorId, workOrderId, elevatorUnityId: unityId });
  const taskIds = [id(), id()];
  await db.insert(workOrderTasks).values(
    taskIds.map((taskId, index) => ({ id: taskId, workOrderElevatorId: elevatorId, taskDescription: `Tarea ${index + 1}` }))
  );
  return { workOrderId, elevatorId, unityId, taskIds };
}

/** IDs de los ítems de seguridad tal como los generaría la app. */
const appSafetyItems = () => [0, 1, 2].map((orderIndex) => ({ id: randomUUID(), question: "x", orderIndex }));

beforeEach(() => {
  resetRequest();
  setRateLimitStore(new MemoryRateLimitStore());
  r2.uploads.length = 0;
  r2.privateUploads.length = 0;
});

describe("login de la app", () => {
  it("devuelve un token de tipo mobile y los datos del técnico", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    const { response, body } = await signIn(technician.email);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, user: { id: technician.id, email: technician.email } });
    expect(body.token.split(".").slice(0, 3)).toEqual(["v2", "mobile", technician.id]);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rechaza credenciales inválidas con 401 y a un usuario inactivo", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    expect((await signIn(technician.email, "incorrecta")).response.status).toBe(401);
    const inactive = await createUser({ permissions: TECHNICIAN, status: "INACTIVE" });
    expect((await signIn(inactive.email)).response.status).toBe(401);
  });

  it("no deja entrar a un rol sin permiso para la app", async () => {
    const office = await createUser({ permissions: ["work_orders:panel:read", "reports"] });
    const { response, body } = await signIn(office.email);
    expect(response.status).toBe(403);
    expect(body.token).toBeUndefined();
  });

  it("bloquea tras 5 intentos fallidos (429)", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    for (let i = 0; i < 5; i++) await signIn(technician.email, "incorrecta");
    expect((await signIn(technician.email)).response.status).toBe(429);
  });
});

describe("token de la app", () => {
  it("sin token, con token inventado o con formato antiguo responde 401", async () => {
    expect((await listOrders()).status).toBe(401);
    requestHeaders.set("authorization", "Bearer USER.9999999999.deadbeef");
    expect((await listOrders()).status).toBe(401);
  });

  it("el token del panel no sirve como Bearer, ni el de la app como cookie", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    requestHeaders.set("authorization", `Bearer ${createSessionToken("staff", technician.id, 0, 3600)}`);
    expect((await listOrders()).status).toBe(401);

    const { body } = await signIn(technician.email);
    resetRequest();
    cookieJar.set(SESSION_COOKIE, body.token);
    expect(await getSessionUser()).toBeNull();
  });

  it("la cookie del panel no autentica la API móvil", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    await loginAs(technician.id);
    expect((await listOrders()).status).toBe(401);
  });

  it("cambiar la contraseña o desactivar al técnico revoca su token", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const technician = await createUser({ permissions: TECHNICIAN });
    const { body } = await signIn(technician.email);
    expect((await listOrders()).status).toBe(200);

    await loginAs(admin.id);
    await changeUserPassword(technician.id, { password: "Otra-Clave-7391", confirmPassword: "Otra-Clave-7391" });
    resetRequest();
    requestHeaders.set("authorization", `Bearer ${body.token}`);
    expect((await listOrders()).status).toBe(401);

    const second = await signIn(technician.email, "Otra-Clave-7391");
    expect(second.response.status).toBe(200);
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, technician.id));
    expect((await listOrders()).status).toBe(401);
  });

  it("refresh entrega un token nuevo", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    await signIn(technician.email);
    const response = await refresh();
    expect(response.status).toBe(200);
    expect((await response.json()).token.split(".")[1]).toBe("mobile");
  });
});

describe("flujo completo de una orden", () => {
  it("un correctivo se trabaja de inicio a cierre", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    const order = await createWorkOrder(technician.id, "CORR");
    await signIn(technician.email);

    const list = await (await listOrders()).json();
    expect(list.workOrders.map((o: { id: string }) => o.id)).toContain(order.workOrderId);

    // Antes de iniciar: la plantilla viaja para armar el checklist sin señal.
    let detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    expect(detail.elevators[0]).toMatchObject({ safety: null, photosRequired: false, audios: [] });
    expect(detail.elevators[0].safetyTemplate).toEqual([
      { question: "¿Usa EPP?", orderIndex: 0 },
      { question: "¿Área señalizada?", orderIndex: 1 },
      { question: "¿Energía bloqueada?", orderIndex: 2 },
    ]);

    const items = appSafetyItems();
    const startedAt = Date.now() - 60_000;
    const start = () =>
      startOrder(
        jsonRequest({ startedAt, elevators: [{ id: order.elevatorId, safetyItems: items }] }),
        params(order.workOrderId)
      );
    expect((await start()).status).toBe(200);
    expect((await start()).status).toBe(200); // reintento: no duplica

    detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    expect(detail).toMatchObject({ status: "IN_PROGRESS", startedAt });
    // Conserva los IDs de la app y las preguntas del servidor.
    expect(detail.elevators[0].safety.items.map((i: { id: string }) => i.id)).toEqual(items.map((i) => i.id));
    expect(detail.elevators[0].safety.items[0].question).toBe("¿Usa EPP?");

    // No se puede aprobar la seguridad con preguntas sin responder.
    expect((await safetyComplete(jsonRequest({}), params(order.elevatorId))).status).toBe(422);

    const answeredAt = Date.now() - 30_000;
    const answers = [
      { id: items[0].id, response: "SI", answeredAt },
      { id: items[1].id, response: "NO", observations: "Falta cinta", answeredAt },
      { id: items[2].id, response: "NA", observations: "se ignora", answeredAt },
    ];
    expect((await safetyItems(jsonRequest({ items: answers }), params(order.elevatorId))).status).toBe(200);
    const stored = await db
      .select()
      .from(workOrderElevatorSafetyItems)
      .where(eq(workOrderElevatorSafetyItems.id, items[1].id));
    expect(stored[0]).toMatchObject({ response: "NO", observations: "Falta cinta", answeredAt });

    const geolocation = { latitude: -12.05, longitude: -77.04 };
    expect(
      (await safetyComplete(jsonRequest({ completedAt: Date.now(), geolocation }), params(order.elevatorId))).status
    ).toBe(200);

    expect(
      (
        await saveTasks(
          jsonRequest({
            tasks: [
              { id: order.taskIds[0], status: "COMPLETED", isCompleted: true, completedAt: Date.now() },
              { id: order.taskIds[1], status: "SKIPPED", observations: "Sin acceso" },
            ],
          }),
          params(order.elevatorId)
        )
      ).status
    ).toBe(200);
    expect((await saveFindings(jsonRequest({ findings: "Polea gastada" }), params(order.elevatorId))).status).toBe(200);

    // No se puede cerrar la orden con equipos sin finalizar.
    const close = () =>
      completeOrder(
        jsonRequest({
          clientName: "María Receptora",
          signatureDataUrl: `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`,
          elevatorStatuses: { [order.elevatorId]: "OPERATIVE" },
          completedAt: Date.now(),
        }),
        params(order.workOrderId)
      );
    expect((await close()).status).toBe(422);

    expect((await completeElevator(jsonRequest({ mode: "partial" }), params(order.elevatorId))).status).toBe(200);
    expect((await close()).status).toBe(200);
    expect((await close()).status).toBe(200); // reintento

    detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    expect(detail).toMatchObject({ status: "COMPLETED", clientSignerName: "María Receptora" });
    expect(detail.elevators[0]).toMatchObject({ status: "COMPLETED", finding: "Polea gastada" });
    expect(detail.elevators[0].tasks.map((t: { status: string }) => t.status).sort()).toEqual(["COMPLETED", "SKIPPED"]);
    const [unity] = await db.select().from(elevatorUnities).where(eq(elevatorUnities.id, order.unityId));
    expect(unity.status).toBe("OPERATIVE");
    // La firma se sube una sola vez aunque el cierre se reintente.
    expect(r2.uploads.filter((key) => key.includes("client-signature"))).toHaveLength(1);
  });

  it("un preventivo exige 4 fotos para finalizar el equipo; un correctivo no", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    const order = await createWorkOrder(technician.id, "PREV");
    await signIn(technician.email);

    const items = appSafetyItems();
    await startOrder(jsonRequest({ elevators: [{ id: order.elevatorId, safetyItems: items }] }), params(order.workOrderId));
    await safetyItems(
      jsonRequest({ items: items.map((item) => ({ id: item.id, response: "SI" })) }),
      params(order.elevatorId)
    );
    await safetyComplete(jsonRequest({}), params(order.elevatorId));

    const detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    expect(detail.elevators[0].photosRequired).toBe(true);

    const finish = () => completeElevator(jsonRequest({ mode: "all_completed" }), params(order.elevatorId));
    const blocked = await finish();
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).message).toMatch(/al menos 4 fotos/);

    for (let i = 0; i < 4; i++) {
      const response = await addPhoto(
        formRequest({ id: randomUUID(), tag: i < 2 ? "BEFORE" : "AFTER" }, JPEG, "foto.jpg"),
        params(order.elevatorId)
      );
      expect(response.status).toBe(200);
    }
    expect((await finish()).status).toBe(200);
    const tasks = await db.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderElevatorId, order.elevatorId));
    expect(tasks.every((task) => task.status === "COMPLETED")).toBe(true);
  });
});

describe("fotos y audios", () => {
  async function startedOrder() {
    const technician = await createUser({ permissions: TECHNICIAN });
    const order = await createWorkOrder(technician.id, "CORR");
    await signIn(technician.email);
    await startOrder(jsonRequest({ elevators: [] }), params(order.workOrderId));
    return order;
  }

  it("guarda la foto con el ID de la app y no la duplica al reintentar", async () => {
    const order = await startedOrder();
    const photoId = randomUUID();
    const upload = () =>
      addPhoto(
        formRequest({ id: photoId, tag: "POINT", description: "Cable", taskId: order.taskIds[0] }, JPEG, "x.jpg"),
        params(order.elevatorId)
      );
    expect((await upload()).status).toBe(200);
    expect((await upload()).status).toBe(200);
    const rows = await db.select().from(workOrderElevatorPhotos).where(eq(workOrderElevatorPhotos.workOrderElevatorId, order.elevatorId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: photoId, tag: "POINT", description: "Cable", workOrderTaskId: order.taskIds[0] });
    expect(r2.uploads).toHaveLength(1);

    expect((await deletePhoto(new Request(url), params(photoId))).status).toBe(200);
    expect((await deletePhoto(new Request(url), params(photoId))).status).toBe(200); // ya no existe
  });

  it("rechaza un archivo que no es una imagen aunque se llame .jpg", async () => {
    const order = await startedOrder();
    const fake = new TextEncoder().encode("<svg><script>alert(1)</script></svg>");
    const response = await addPhoto(formRequest({ id: randomUUID(), tag: "BEFORE" }, fake, "foto.jpg"), params(order.elevatorId));
    expect(response.status).toBe(422);
    expect(r2.uploads).toHaveLength(0);
  });

  it("rechaza IDs que no son UUID", async () => {
    const order = await startedOrder();
    const response = await addPhoto(formRequest({ id: "../../etc", tag: "BEFORE" }, JPEG, "x.jpg"), params(order.elevatorId));
    expect(response.status).toBe(422);
  });

  it("guarda la nota de voz en el bucket privado y la devuelve con URL firmada", async () => {
    const order = await startedOrder();
    const audioId = randomUUID();
    const upload = () =>
      addAudio(formRequest({ id: audioId, durationMs: "4200" }, M4A, "nota.m4a"), params(order.elevatorId));
    expect((await upload()).status).toBe(200);
    expect((await upload()).status).toBe(200);
    expect(await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId))).toHaveLength(1);
    expect(r2.privateUploads).toHaveLength(1);
    expect(r2.uploads).toHaveLength(0);

    const detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    expect(detail.elevators[0].audios[0]).toMatchObject({ id: audioId, durationMs: 4200, transcriptStatus: "NONE" });
    expect(detail.elevators[0].audios[0].url).toMatch(/^https:\/\/signed\.example\//);

    const notAudio = await addAudio(formRequest({ id: randomUUID() }, JPEG, "nota.m4a"), params(order.elevatorId));
    expect(notAudio.status).toBe(422);
  });

  it("guarda de qué foto viene la nota de voz (o null si es de Hallazgos)", async () => {
    const order = await startedOrder();
    const photoId = randomUUID();
    await addPhoto(formRequest({ id: photoId, tag: "POINT" }, JPEG, "foto.jpg"), params(order.elevatorId));
    const fromPhoto = randomUUID();
    const fromFindings = randomUUID();
    await addAudio(formRequest({ id: fromPhoto, durationMs: "900", photoId }, M4A, "a.m4a"), params(order.elevatorId));
    await addAudio(formRequest({ id: fromFindings, durationMs: "900" }, M4A, "b.m4a"), params(order.elevatorId));

    const detail = await (await getOrder(new Request(url), params(order.workOrderId))).json();
    const byId = Object.fromEntries(detail.elevators[0].audios.map((a: { id: string }) => [a.id, a]));
    expect(byId[fromPhoto].photoId).toBe(photoId);
    expect(byId[fromFindings].photoId).toBeNull();

    const bad = await addAudio(formRequest({ id: randomUUID(), photoId: "../x" }, M4A, "c.m4a"), params(order.elevatorId));
    expect(bad.status).toBe(422);
  });

  it("elimina una nota de voz y da por bueno el borrado repetido", async () => {
    const order = await startedOrder();
    const audioId = randomUUID();
    await addAudio(formRequest({ id: audioId, durationMs: "1500" }, M4A, "nota.m4a"), params(order.elevatorId));

    expect((await deleteAudio(new Request(url), params(audioId))).status).toBe(200);
    expect(await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId))).toHaveLength(0);
    expect((await deleteAudio(new Request(url), params(audioId))).status).toBe(200); // ya no existe
    expect((await deleteAudio(new Request(url), params("no-es-uuid"))).status).toBe(422);
  });

  it("no deja borrar la nota de voz de otro técnico", async () => {
    const order = await startedOrder();
    const audioId = randomUUID();
    await addAudio(formRequest({ id: audioId, durationMs: "1500" }, M4A, "nota.m4a"), params(order.elevatorId));

    const other = await createUser({ permissions: TECHNICIAN });
    await signIn(other.email);
    expect((await deleteAudio(new Request(url), params(audioId))).status).toBe(404);
    expect(await db.select().from(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audioId))).toHaveLength(1);
  });
});

describe("pertenencia", () => {
  it("un técnico no ve ni modifica la orden de otro", async () => {
    const owner = await createUser({ permissions: TECHNICIAN });
    const other = await createUser({ permissions: TECHNICIAN });
    const order = await createWorkOrder(owner.id, "CORR");

    await signIn(other.email);
    const list = await (await listOrders()).json();
    expect(list.workOrders).toEqual([]);
    expect((await getOrder(new Request(url), params(order.workOrderId))).status).toBe(404);
    expect((await startOrder(jsonRequest({}), params(order.workOrderId))).status).toBe(404);
    expect((await saveFindings(jsonRequest({ findings: "x" }), params(order.elevatorId))).status).toBe(404);
    expect((await saveTasks(jsonRequest({ tasks: [{ id: order.taskIds[0], status: "COMPLETED" }] }), params(order.elevatorId))).status).toBe(404);
    expect((await addPhoto(formRequest({ id: randomUUID(), tag: "BEFORE" }, JPEG, "x.jpg"), params(order.elevatorId))).status).toBe(404);

    const [untouched] = await db.select().from(workOrders).where(eq(workOrders.id, order.workOrderId));
    expect(untouched.status).toBe("PENDING");
  });

  it("no se puede tocar la tarea de otro equipo usando un equipo propio", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    const other = await createUser({ permissions: TECHNICIAN });
    const mine = await createWorkOrder(technician.id, "CORR");
    const foreign = await createWorkOrder(other.id, "CORR");

    await signIn(technician.email);
    const response = await saveTasks(
      jsonRequest({ tasks: [{ id: foreign.taskIds[0], status: "COMPLETED" }] }),
      params(mine.elevatorId)
    );
    expect(response.status).toBe(200); // no encuentra la tarea en su equipo: no cambia nada
    const [task] = await db.select().from(workOrderTasks).where(eq(workOrderTasks.id, foreign.taskIds[0]));
    expect(task.status).not.toBe("COMPLETED");
  });
});

describe("hora del teléfono", () => {
  it("se respeta si es razonable y se ignora si está en el futuro", async () => {
    const technician = await createUser({ permissions: TECHNICIAN });
    const order = await createWorkOrder(technician.id, "CORR");
    await signIn(technician.email);

    const future = Date.now() + 10 * 24 * 60 * 60 * 1000;
    const before = Date.now();
    await startOrder(jsonRequest({ startedAt: future, elevators: [] }), params(order.workOrderId));
    const [row] = await db.select().from(workOrders).where(eq(workOrders.id, order.workOrderId));
    expect(row.startedAt).toBeGreaterThanOrEqual(before);
    expect(row.startedAt).toBeLessThan(future);
  });
});

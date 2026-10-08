import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, clients, costCenters, quotations, roles, users } from "@/db";
import { hashPassword } from "@/features/users/password";
import { createSession } from "@/features/auth/server";
import { createPortalSession } from "@/features/portal/server";
import { resetRequest } from "./request";

const id = () => randomUUID().toUpperCase();

export const STAFF_PASSWORD = "Clave-Segura-2026";

export async function createRole(name: string, permissions: string[]) {
  const roleId = id();
  await db.insert(roles).values({ id: roleId, name: `${name}-${roleId.slice(0, 8)}`, permissions });
  return roleId;
}

export async function createUser(options: {
  permissions: string[];
  status?: "ACTIVE" | "INACTIVE";
  password?: string;
}) {
  const roleId = await createRole("ROL", options.permissions);
  const userId = id();
  const email = `user-${userId.slice(0, 8).toLowerCase()}@example.test`;
  await db.insert(users).values({
    id: userId,
    email,
    fullName: "Usuario De Prueba",
    roleId,
    status: options.status ?? "ACTIVE",
    passwordHash: await hashPassword(options.password ?? STAFF_PASSWORD),
  });
  return { id: userId, email, roleId };
}

/** Deja la petición autenticada como ese usuario (cookie de personal). */
export async function loginAs(userId: string) {
  resetRequest();
  const [row] = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId));
  await createSession(userId, row.sessionVersion);
}

export async function createCostCenter(options: { password?: string } = {}) {
  const clientId = id();
  await db.insert(clients).values({ id: clientId, legalName: `Cliente ${clientId.slice(0, 8)}` });
  const costCenterId = id();
  await db.insert(costCenters).values({
    id: costCenterId,
    clientId,
    name: `Sede ${costCenterId.slice(0, 8)}`,
    address: "Av. Siempre Viva 123",
    passwordHash: await hashPassword(options.password ?? "Portal-4821"),
  });
  return { id: costCenterId, clientId };
}

/** Deja la petición autenticada como esa sede (cookie del portal). */
export async function loginPortal(costCenterId: string) {
  resetRequest();
  const [row] = await db
    .select({ version: costCenters.portalSessionVersion })
    .from(costCenters)
    .where(eq(costCenters.id, costCenterId));
  await createPortalSession(costCenterId, row.version);
}

export async function createQuotation(costCenter: { id: string; clientId: string }, status = "SENT") {
  const quotationId = id();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(quotations).values({
    id: quotationId,
    quotationNumber: `COT-${quotationId.slice(0, 8)}`,
    clientId: costCenter.clientId,
    costCenterId: costCenter.id,
    issueDate: now,
    validUntil: now + 15 * 86400,
    status,
  });
  return quotationId;
}

"use server";

import { and, desc, eq } from "drizzle-orm";
import {
  calculatorHistory,
  db,
  userNotes,
  type CalculatorHistoryEntry,
  type UserNote,
} from "@/db";
import { requireStaffSession } from "@/features/auth/server";
import { generateUuid } from "@/lib/uuid";
import type { NoteInput, ToolsResult } from "./types";

const MAX_TITLE_LENGTH = 200;
const MAX_NOTE_CONTENT_LENGTH = 50_000;
const MAX_EXPRESSION_LENGTH = 500;
const MAX_RESULT_LENGTH = 500;
const HISTORY_LIMIT = 30;
const DEFAULT_NOTE_COLOR = "#ffffff";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function authError(error: unknown): string {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  return "";
}

export async function loadNotes(): Promise<ToolsResult<UserNote[]>> {
  try {
    const user = await requireStaffSession();
    const notes = await db
      .select()
      .from(userNotes)
      .where(eq(userNotes.userId, user.id))
      .orderBy(desc(userNotes.updatedAt));
    return { success: true, data: notes };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al cargar notas:", error);
    return { success: false, error: "No se pudieron cargar las notas." };
  }
}

export async function createNote(): Promise<ToolsResult<UserNote>> {
  try {
    const user = await requireStaffSession();
    const timestamp = nowSeconds();
    const [created] = await db
      .insert(userNotes)
      .values({
        id: generateUuid(),
        userId: user.id,
        title: "Nueva nota",
        content: "",
        color: DEFAULT_NOTE_COLOR,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();
    return { success: true, data: created };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al crear nota:", error);
    return { success: false, error: "No se pudo crear la nota." };
  }
}

export async function updateNote(input: NoteInput): Promise<ToolsResult<UserNote>> {
  try {
    const user = await requireStaffSession();
    const title = String(input.title ?? "").slice(0, MAX_TITLE_LENGTH);
    const content = String(input.content ?? "").slice(0, MAX_NOTE_CONTENT_LENGTH);
    const color = /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color
      : DEFAULT_NOTE_COLOR;

    const [updated] = await db
      .update(userNotes)
      .set({ title, content, color, updatedAt: nowSeconds() })
      .where(and(eq(userNotes.id, input.id), eq(userNotes.userId, user.id)))
      .returning();

    if (!updated) {
      return { success: false, error: "La nota ya no existe." };
    }
    return { success: true, data: updated };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al guardar nota:", error);
    return { success: false, error: "No se pudo guardar la nota." };
  }
}

export async function deleteNote(id: string): Promise<ToolsResult<{ id: string }>> {
  try {
    const user = await requireStaffSession();
    const [deleted] = await db
      .delete(userNotes)
      .where(and(eq(userNotes.id, id), eq(userNotes.userId, user.id)))
      .returning({ id: userNotes.id });

    if (!deleted) {
      return { success: false, error: "La nota ya no existe." };
    }
    return { success: true, data: deleted };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al eliminar nota:", error);
    return { success: false, error: "No se pudo eliminar la nota." };
  }
}

export async function loadCalculatorHistory(): Promise<
  ToolsResult<CalculatorHistoryEntry[]>
> {
  try {
    const user = await requireStaffSession();
    const history = await db
      .select()
      .from(calculatorHistory)
      .where(eq(calculatorHistory.userId, user.id))
      .orderBy(desc(calculatorHistory.createdAt))
      .limit(HISTORY_LIMIT);
    return { success: true, data: history };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al cargar historial de calculadora:", error);
    return {
      success: false,
      error: "No se pudo cargar el historial de la calculadora.",
    };
  }
}

export async function saveCalculation(
  expression: string,
  result: string
): Promise<ToolsResult<CalculatorHistoryEntry>> {
  try {
    const user = await requireStaffSession();
    const cleanExpression = String(expression ?? "").trim().slice(0, MAX_EXPRESSION_LENGTH);
    const cleanResult = String(result ?? "").trim().slice(0, MAX_RESULT_LENGTH);
    if (!cleanExpression || !cleanResult) {
      return { success: false, error: "La operación está vacía." };
    }

    const [created] = await db
      .insert(calculatorHistory)
      .values({
        id: generateUuid(),
        userId: user.id,
        expression: cleanExpression,
        result: cleanResult,
        createdAt: nowSeconds(),
      })
      .returning();
    return { success: true, data: created };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al guardar operación:", error);
    return { success: false, error: "No se pudo guardar la operación." };
  }
}

export async function deleteCalculation(id: string): Promise<ToolsResult<{ id: string }>> {
  try {
    const user = await requireStaffSession();
    await db
      .delete(calculatorHistory)
      .where(and(eq(calculatorHistory.id, id), eq(calculatorHistory.userId, user.id)));
    return { success: true, data: { id } };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al eliminar operación:", error);
    return { success: false, error: "No se pudo eliminar la operación." };
  }
}

export async function clearCalculatorHistory(): Promise<ToolsResult<null>> {
  try {
    const user = await requireStaffSession();
    await db.delete(calculatorHistory).where(eq(calculatorHistory.userId, user.id));
    return { success: true, data: null };
  } catch (error) {
    const message = authError(error);
    if (message) return { success: false, error: message };
    console.error("Error al limpiar historial de calculadora:", error);
    return { success: false, error: "No se pudo limpiar el historial." };
  }
}

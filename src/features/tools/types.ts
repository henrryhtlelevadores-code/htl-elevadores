export interface UserNote {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  color: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface CalculatorHistoryEntry {
  id: string;
  userId: string;
  expression: string;
  result: string;
  createdAt: number | null;
}

export type ToolsResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface NoteInput {
  id: string;
  title: string;
  content: string;
  color: string;
}

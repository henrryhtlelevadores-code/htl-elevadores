declare module "mictext" {
  export type TranscriberState =
    | "idle"
    | "loading-model"
    | "transcribing"
    | "unsupported";
  export type TranscriberMode = "device" | "server" | "unsupported";

  export interface CreateTranscriberOptions {
    model?: string;
    modelBaseUrl?: string | null;
    onProgress?: ((progress: unknown) => void) | null;
    slowDevice?: "disable" | "server";
    fallbackUrl?: string | null;
    fallbackApiKey?: string | null;
    slowThresholdMs?: number;
    createWorker?: () => Worker;
  }

  export interface Transcriber {
    state: TranscriberState;
    mode: TranscriberMode;
    load: () => Promise<void>;
    transcribeBlob: (blob: Blob) => Promise<{ text: string }>;
    dispose: () => void;
  }

  export function createTranscriber(
    options?: CreateTranscriberOptions
  ): Transcriber;
}
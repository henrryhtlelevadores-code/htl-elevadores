"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTranscriber, type Transcriber } from "mictext";

export type VoiceInputError =
  | "denied"
  | "mic"
  | "unsupported"
  | "transcribe";

type VoiceEngine = "webspeech" | "mictext" | null;

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionError = { error: string };

type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Chrome/Edge -> Web Speech API; Safari (macOS e iOS) y Firefox -> mictext (Whisper local).
function detectEngine(): "webspeech" | "mictext" {
  if (typeof navigator === "undefined") return "mictext";
  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isChrome = !isEdge && /Chrome\//.test(ua);
  const isIOS = /iP(ad|hone|od)/.test(ua);
  const isSafari = !isChrome && /Safari\//.test(ua);

  if (isIOS || isSafari || isFirefox) return "mictext";
  if (getSpeechRecognitionCtor()) return "webspeech";
  return "mictext";
}

async function checkMicrophonePermission(): Promise<
  "granted" | "denied" | "prompt"
> {
  try {
    const result = await navigator.permissions.query({
      name: "microphone",
    });
    return result.state as "granted" | "denied" | "prompt";
  } catch {
    return "prompt";
  }
}

function createWebSpeechRecognition(
  Ctor: new () => RecognitionLike,
  lang: string,
  handlers: {
    onResult: (event: RecognitionEvent) => void;
    onError: (event: RecognitionError) => void;
    onEnd: () => void;
  }
): RecognitionLike {
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;
  recognition.onresult = handlers.onResult;
  recognition.onerror = handlers.onError;
  recognition.onend = handlers.onEnd;
  return recognition;
}

function pickMimeType(): { type?: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return { type: candidate };
    }
  }
  return { type: undefined };
}

// Multilingüe (no '.en'): transcribe español. Modelo alojado en onnx-community.
const MICTEXT_MODEL = "onnx-community/whisper-tiny";

export function useVoiceInput({
  onTranscript,
  onError,
  lang = "es-PE",
}: {
  onTranscript: (text: string) => void;
  onError?: (code: VoiceInputError) => void;
  lang?: string;
}) {
  const [engine, setEngine] = useState<VoiceEngine>(null);
  const [isListening, setIsListening] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEngine(detectEngine()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const disposedRef = useRef(false);

  // --- Web Speech API (Chrome / Edge) ---
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const sessionTextRef = useRef("");
  const baseTextRef = useRef("");

  const emitText = useCallback((sessionText: string) => {
    const base = baseTextRef.current.trim();
    const full = base ? `${base} ${sessionText}` : sessionText;
    onTranscriptRef.current(full);
  }, []);

  const handleRecognitionError = useCallback((event: RecognitionError) => {
    try {
      recognitionRef.current?.abort();
    } catch {
      // ya abortada
    }
    setIsListening(false);
    if (event.error === "not-allowed") {
      onErrorRef.current?.("denied");
    } else if (event.error === "no-speech") {
      sessionTextRef.current = "";
    } else {
      onErrorRef.current?.("transcribe");
    }
  }, []);

  const handleRecognitionResult = useCallback(
    (event: RecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) final += ` ${transcript}`;
        else interim += transcript;
      }
      const current = sessionTextRef.current;
      if (final) {
        const next = `${current}${final}`.replace(/\s+/g, " ").trim();
        sessionTextRef.current = next;
        emitText(next);
      } else if (interim) {
        emitText(`${current}${interim ? ` ${interim}` : ""}`.trim());
      }
    },
    [emitText]
  );

  // --- mictext con Whisper local (Safari / Firefox) ---
  const transcriberRef = useRef<Transcriber | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mediaTypeRef = useRef("audio/webm");
  const mediaBaseRef = useRef("");

  const ensureTranscriber = useCallback(async (): Promise<Transcriber | null> => {
    if (transcriberRef.current) return transcriberRef.current;
    try {
      setIsBusy(true);
      const transcriber = createTranscriber({
        model: MICTEXT_MODEL,
        slowDevice: "disable",
      });
      transcriberRef.current = transcriber;
      await transcriber.load();
      if (transcriber.mode === "unsupported") {
        onErrorRef.current?.("unsupported");
        return null;
      }
      return transcriber;
    } catch {
      onErrorRef.current?.("unsupported");
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const transcribeChunks = useCallback(async () => {
    if (disposedRef.current) return;
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mediaTypeRef.current });
    try {
      const transcriber = await ensureTranscriber();
      if (!transcriber || disposedRef.current) return;
      setIsBusy(true);
      const { text } = await transcriber.transcribeBlob(blob);
      if (disposedRef.current) return;
      const clean = (text ?? "").trim();
      if (clean) {
        const base = mediaBaseRef.current.trim();
        onTranscriptRef.current(base ? `${base} ${clean}` : clean);
      }
    } catch {
      onErrorRef.current?.("transcribe");
    } finally {
      if (!disposedRef.current) setIsBusy(false);
    }
  }, [ensureTranscriber]);

  const startRecording = useCallback(async () => {
    if (disposedRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (disposedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mime = pickMimeType();
      mediaTypeRef.current = mime?.type ?? "audio/webm";
      const recorder = new MediaRecorder(
        stream,
        mime?.type ? { mimeType: mime.type } : undefined
      );
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        void transcribeChunks();
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setIsListening(true);
    } catch {
      onErrorRef.current?.("mic");
    }
  }, [transcribeChunks]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    setIsListening(false);
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(
    (baseText: string) => {
      if (engine === "webspeech") {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) return;
        const recognition =
          recognitionRef.current ??
          createWebSpeechRecognition(Ctor, lang, {
            onResult: handleRecognitionResult,
            onError: handleRecognitionError,
            onEnd: () => setIsListening(false),
          });
        recognitionRef.current = recognition;
        baseTextRef.current = baseText;
        sessionTextRef.current = "";
        void checkMicrophonePermission().then((state) => {
          if (state === "denied") {
            onErrorRef.current?.("denied");
            return;
          }
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            setIsListening(false);
          }
        });
      } else if (engine === "mictext") {
        mediaBaseRef.current = baseText;
        void startRecording();
      }
    },
    [engine, lang, handleRecognitionResult, handleRecognitionError, startRecording]
  );

  const stop = useCallback(() => {
    if (engine === "webspeech") {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ya detenida
      }
      setIsListening(false);
    } else if (engine === "mictext") {
      stopRecording();
    }
  }, [engine, stopRecording]);

  const ready = engine === "webspeech" || engine === "mictext";

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        // ya abortada
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      transcriberRef.current?.dispose();
    };
  }, []);

  return {
    engine: ready ? engine : null,
    isSupported: ready,
    isListening,
    isBusy,
    isDictating: isListening || isBusy,
    start,
    stop,
  };
}
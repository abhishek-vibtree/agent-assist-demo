"use client";

import { useState, useRef, useCallback } from "react";

export interface TranscriptEntry {
  id: number;
  speaker: "local" | "remote";
  text: string;
  isFinal: boolean;
  timestamp: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function fetchDeepgramKey(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/deepgram-token`);
  if (!res.ok) throw new Error("Failed to fetch Deepgram key");
  const data = await res.json();
  return data.key;
}

function createDeepgramSocket(
  apiKey: string,
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (err: string) => void
): WebSocket {
  const params = new URLSearchParams({
    model: "nova-3",
    language: "en",
    smart_format: "true",
    interim_results: "true",
    utterance_end_ms: "1000",
    vad_events: "true",
  });

  const ws = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params}`,
    ["token", apiKey]
  );

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "Results") {
        const transcript =
          data.channel?.alternatives?.[0]?.transcript || "";
        if (transcript) {
          onTranscript(transcript, data.is_final === true);
        }
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onerror = () => {
    onError("Deepgram connection error");
  };

  ws.onclose = () => {
    // Connection closed
  };

  return ws;
}

function startMediaRecorder(
  stream: MediaStream,
  ws: WebSocket
): MediaRecorder | null {
  try {
    // Try opus in webm container first (Chrome), fall back to default
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : undefined;

    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    recorder.start(250); // Send audio every 250ms
    return recorder;
  } catch {
    return null;
  }
}

export function useTranscription() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localWsRef = useRef<WebSocket | null>(null);
  const remoteWsRef = useRef<WebSocket | null>(null);
  const localRecorderRef = useRef<MediaRecorder | null>(null);
  const remoteRecorderRef = useRef<MediaRecorder | null>(null);
  const entryIdRef = useRef(0);
  // Track the current interim entry id for each speaker so we can update it
  const localInterimIdRef = useRef<number | null>(null);
  const remoteInterimIdRef = useRef<number | null>(null);

  const stopTranscription = useCallback(() => {
    // Stop recorders
    [localRecorderRef, remoteRecorderRef].forEach((ref) => {
      if (ref.current && ref.current.state !== "inactive") {
        try {
          ref.current.stop();
        } catch {
          // ignore
        }
      }
      ref.current = null;
    });

    // Close WebSockets
    [localWsRef, remoteWsRef].forEach((ref) => {
      if (ref.current && ref.current.readyState === WebSocket.OPEN) {
        try {
          ref.current.send(JSON.stringify({ type: "CloseStream" }));
          ref.current.close();
        } catch {
          // ignore
        }
      }
      ref.current = null;
    });

    setIsTranscribing(false);
  }, []);

  const startTranscription = useCallback(
    async (localStream: MediaStream | null, remoteStream: MediaStream | null) => {
      if (!localStream && !remoteStream) {
        setError("No audio streams available");
        return;
      }

      try {
        setError(null);
        setTranscript([]);
        localInterimIdRef.current = null;
        remoteInterimIdRef.current = null;

        const apiKey = await fetchDeepgramKey();

        // Helper to handle transcript updates for a speaker
        const makeHandler = (speaker: "local" | "remote") => {
          const interimIdRef =
            speaker === "local" ? localInterimIdRef : remoteInterimIdRef;

          return (text: string, isFinal: boolean) => {
            if (isFinal) {
              // Replace interim with final, or add new final entry
              const finalId = entryIdRef.current++;
              setTranscript((prev) => {
                const filtered =
                  interimIdRef.current !== null
                    ? prev.filter((e) => e.id !== interimIdRef.current)
                    : prev;
                return [
                  ...filtered,
                  {
                    id: finalId,
                    speaker,
                    text,
                    isFinal: true,
                    timestamp: Date.now(),
                  },
                ];
              });
              interimIdRef.current = null;
            } else {
              // Update or create interim entry
              if (interimIdRef.current !== null) {
                const currentId = interimIdRef.current;
                setTranscript((prev) =>
                  prev.map((e) =>
                    e.id === currentId ? { ...e, text } : e
                  )
                );
              } else {
                const newId = entryIdRef.current++;
                interimIdRef.current = newId;
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: newId,
                    speaker,
                    text,
                    isFinal: false,
                    timestamp: Date.now(),
                  },
                ]);
              }
            }
          };
        };

        console.log("[Transcription] API key obtained, starting streams...");
        console.log("[Transcription] Local stream:", localStream ? `${localStream.getAudioTracks().length} audio tracks` : "null");
        console.log("[Transcription] Remote stream:", remoteStream ? `${remoteStream.getAudioTracks().length} audio tracks` : "null");

        let started = false;

        // Start local stream transcription (caller)
        if (localStream && localStream.getAudioTracks().length > 0) {
          const ws = createDeepgramSocket(
            apiKey,
            makeHandler("local"),
            (err) => { console.error("[Transcription] Local WS error:", err); setError(err); }
          );
          localWsRef.current = ws;

          ws.onopen = () => {
            console.log("[Transcription] Local WebSocket connected");
            localRecorderRef.current = startMediaRecorder(localStream, ws);
            console.log("[Transcription] Local MediaRecorder started:", !!localRecorderRef.current);
          };
          ws.onclose = (e) => {
            console.log("[Transcription] Local WebSocket closed:", e.code, e.reason);
          };
          started = true;
        }

        // Start remote stream transcription (callee)
        if (remoteStream && remoteStream.getAudioTracks().length > 0) {
          const ws = createDeepgramSocket(
            apiKey,
            makeHandler("remote"),
            (err) => { console.error("[Transcription] Remote WS error:", err); setError(err); }
          );
          remoteWsRef.current = ws;

          ws.onopen = () => {
            console.log("[Transcription] Remote WebSocket connected");
            remoteRecorderRef.current = startMediaRecorder(remoteStream, ws);
            console.log("[Transcription] Remote MediaRecorder started:", !!remoteRecorderRef.current);
          };
          ws.onclose = (e) => {
            console.log("[Transcription] Remote WebSocket closed:", e.code, e.reason);
          };
          started = true;
        }

        if (!started) {
          console.warn("[Transcription] No valid audio streams to transcribe");
          setError("No audio streams available for transcription");
        }

        setIsTranscribing(started);
      } catch (err: any) {
        setError(err?.message || "Failed to start transcription");
      }
    },
    []
  );

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    localInterimIdRef.current = null;
    remoteInterimIdRef.current = null;
  }, []);

  return {
    transcript,
    isTranscribing,
    error,
    startTranscription,
    stopTranscription,
    clearTranscript,
  };
}

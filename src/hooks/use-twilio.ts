"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type CallStatus =
  | "idle"
  | "connecting"
  | "ringing"
  | "connected"
  | "disconnected"
  | "error";

interface TwilioState {
  status: CallStatus;
  isMuted: boolean;
  duration: number;
  error: string | null;
  isReady: boolean;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function fetchToken(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/twilio-token`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Token fetch failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("Token response missing 'token' field");
  return data.token;
}

export function useTwilio() {
  const [state, setState] = useState<TwilioState>({
    status: "idle",
    isMuted: false,
    duration: 0,
    error: null,
    isReady: false,
  });

  // Use refs to avoid stale closures in event handlers
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initDevice = useCallback(async () => {
    if (deviceRef.current) return;

    try {
      setState((s) => ({ ...s, error: null }));

      console.log("[Twilio] Fetching token...");
      const token = await fetchToken();
      console.log("[Twilio] Token received, importing SDK...");

      const { Device } = await import("@twilio/voice-sdk");
      console.log("[Twilio] SDK loaded, creating device...");

      const device = new Device(token, {
        closeProtection: true,
        codecPreferences: ["opus" as any, "pcmu" as any],
      });

      device.on("registered", () => {
        console.log("[Twilio] Device registered");
        setState((s) => ({ ...s, isReady: true, error: null }));
      });

      device.on("error", (err: any) => {
        console.error("[Twilio] Device error:", err);
        setState((s) => ({
          ...s,
          error: err?.message || "Device error",
          status: "error",
        }));
      });

      device.on("tokenWillExpire", async () => {
        try {
          const newToken = await fetchToken();
          device.updateToken(newToken);
        } catch {
          setState((s) => ({
            ...s,
            error: "Failed to refresh token",
          }));
        }
      });

      await device.register();
      deviceRef.current = device;
      console.log("[Twilio] Device ready");
    } catch (err: any) {
      const msg =
        err?.message ||
        (typeof err === "string" ? err : JSON.stringify(err, null, 2));
      console.error("[Twilio] Init failed:", msg, err);
      setState((s) => ({
        ...s,
        error: `Failed to initialize: ${msg}`,
        status: "error",
      }));
      // Auto-retry after 3 seconds
      setTimeout(() => {
        console.log("[Twilio] Retrying init...");
        deviceRef.current = null;
        setState((s) => ({
          ...s,
          error: null,
          status: "idle",
        }));
      }, 3000);
    }
  }, []);

  const makeCall = useCallback(
    async (phoneNumber: string) => {
      if (!deviceRef.current) {
        setState((s) => ({ ...s, error: "Device not ready" }));
        return;
      }

      try {
        setState((s) => ({
          ...s,
          status: "connecting",
          error: null,
          duration: 0,
          isMuted: false,
        }));

        const call = await deviceRef.current.connect({
          params: { To: phoneNumber },
        });

        callRef.current = call;

        call.on("ringing", () => {
          setState((s) => ({ ...s, status: "ringing" }));
        });

        call.on("accept", () => {
          setState((s) => ({ ...s, status: "connected" }));
          clearTimer();
          timerRef.current = setInterval(() => {
            setState((s) => ({ ...s, duration: s.duration + 1 }));
          }, 1000);
        });

        call.on("disconnect", () => {
          clearTimer();
          callRef.current = null;
          setState((s) => ({
            ...s,
            status: "disconnected",
            isMuted: false,
          }));
          // Reset to idle after a brief delay
          setTimeout(() => {
            setState((s) =>
              s.status === "disconnected"
                ? { ...s, status: "idle", duration: 0 }
                : s
            );
          }, 2000);
        });

        call.on("cancel", () => {
          clearTimer();
          callRef.current = null;
          setState((s) => ({
            ...s,
            status: "idle",
            isMuted: false,
            duration: 0,
          }));
        });

        call.on("reject", () => {
          clearTimer();
          callRef.current = null;
          setState((s) => ({
            ...s,
            status: "disconnected",
            isMuted: false,
          }));
        });

        call.on("error", (err: any) => {
          clearTimer();
          callRef.current = null;
          setState((s) => ({
            ...s,
            status: "error",
            error: err?.message || "Call failed",
            isMuted: false,
          }));
        });
      } catch (err: any) {
        const msg = err?.message || "Failed to connect call";
        setState((s) => ({
          ...s,
          status: "error",
          error: msg.includes("Permission")
            ? "Microphone access is required to make calls"
            : msg,
        }));
      }
    },
    [clearTimer]
  );

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
    clearTimer();
    setState((s) => ({
      ...s,
      status: "idle",
      isMuted: false,
      duration: 0,
    }));
  }, [clearTimer]);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !callRef.current.isMuted();
      callRef.current.mute(newMuted);
      setState((s) => ({ ...s, isMuted: newMuted }));
    }
  }, []);

  const sendDigits = useCallback((digits: string) => {
    if (callRef.current) {
      callRef.current.sendDigits(digits);
    }
  }, []);

  const getStreams = useCallback((): {
    local: MediaStream | null;
    remote: MediaStream | null;
  } => {
    if (!callRef.current) return { local: null, remote: null };
    try {
      return {
        local: callRef.current.getLocalStream() || null,
        remote: callRef.current.getRemoteStream() || null,
      };
    } catch {
      return { local: null, remote: null };
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (callRef.current) {
        callRef.current.disconnect();
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, [clearTimer]);

  return {
    ...state,
    initDevice,
    makeCall,
    hangUp,
    toggleMute,
    sendDigits,
    getStreams,
  };
}

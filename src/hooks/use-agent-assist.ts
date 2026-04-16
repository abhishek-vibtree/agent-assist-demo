"use client";

import { useState, useRef, useCallback } from "react";

export interface AgentMetadata {
  reason: string;
  confidence: string;
  sentiment: string;
  flags: string;
}

export interface ParsedResponse {
  text: string;       // The main text (Suggested Reply + Next Action) with bold markdown
  metadata?: AgentMetadata; // Extracted JSON metadata
}

export interface AssistMessage {
  id: number;
  role: "user" | "assistant";
  type: "suggestion" | "chat";
  content: string;
  parsed?: ParsedResponse;
  timestamp: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Strip complete or partial ```json blocks from streaming text for display
function stripJsonFence(text: string): string {
  // Remove complete ```json ... ``` blocks
  let cleaned = text.replace(/```json\s*\n?[\s\S]*?\n?\s*```/g, "");
  // Remove partial/in-progress ```json blocks (opened but not yet closed)
  cleaned = cleaned.replace(/```json[\s\S]*$/, "");
  // Remove trailing bare ``` or `` or ` that might be the start of a fence
  cleaned = cleaned.replace(/`{1,3}$/, "");
  return cleaned.trim();
}

function parseResponse(text: string): ParsedResponse {
  // Extract JSON block from ```json ... ``` fence
  const jsonMatch = text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  let metadata: AgentMetadata | undefined;

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      metadata = {
        reason: parsed.reason || "",
        confidence: parsed.confidence || "",
        sentiment: parsed.sentiment || "",
        flags: parsed.flags || "",
      };
    } catch (_) {
      // JSON parse failed, skip metadata
    }
  }

  // Remove the JSON code fence from the display text
  const displayText = text.replace(/```json\s*\n?[\s\S]*?\n?\s*```/, "").trim();

  return { text: displayText, metadata };
}

export function useAgentAssist() {
  const [messages, setMessages] = useState<AssistMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const msgIdRef = useRef(0);
  const transcriptRef = useRef("");
  const sessionIdRef = useRef<string | null>(null);
  const warmingUpRef = useRef(false);
  const customerContextRef = useRef<Record<string, any> | undefined>(undefined);
  const localeRef = useRef<string>("en");

  // Update the active locale — call this whenever UI locale changes so the
  // next request (streamed or warmup) uses the latest language.
  const setLocale = useCallback((locale: string) => {
    localeRef.current = locale || "en";
  }, []);

  // Warm up session (non-streaming, runs in background when call connects)
  const warmUpSession = useCallback(async (customerContext?: Record<string, any>, locale: string = "en") => {
    if (warmingUpRef.current || sessionIdRef.current) return;
    warmingUpRef.current = true;

    try {
      // Store customer context and locale for all future API calls
      customerContextRef.current = customerContext;
      localeRef.current = locale;
      console.log("[AgentAssist] Warming up session...", customerContext ? "with customer context" : "", "locale:", locale);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "warmup", customer_context: customerContext, locale }),
      });

      if (!res.ok) {
        console.error("[AgentAssist] Warmup failed:", await res.text().catch(() => ""));
        return;
      }

      const data = await res.json();
      if (data.session_id) {
        sessionIdRef.current = data.session_id;
        setIsSessionReady(true);
        console.log("[AgentAssist] Session ready:", data.session_id);
      }
    } catch (err: any) {
      console.error("[AgentAssist] Warmup error:", err?.message);
    } finally {
      warmingUpRef.current = false;
    }
  }, []);

  // Streaming API call
  const callApi = useCallback(async (transcript: string, userQuestion?: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Create a placeholder assistant message that we'll stream into
    const msgId = msgIdRef.current++;
    const responseType = userQuestion ? "chat" : "suggestion";

    const placeholderMsg: AssistMessage = {
      id: msgId,
      role: "assistant",
      type: responseType,
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          question: userQuestion,
          session_id: sessionIdRef.current,
          customer_context: customerContextRef.current,
          locale: localeRef.current,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "no body");
        throw new Error(errBody || "Agent assist request failed");
      }

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // Streaming response
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "meta") {
                // Store session_id from meta event
                if (event.session_id) {
                  sessionIdRef.current = event.session_id;
                }
              } else if (event.type === "text") {
                // Append text chunk and update the message
                fullText += event.text;
                // Strip any JSON fence from display during streaming
                const displayText = stripJsonFence(fullText);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId ? { ...m, content: displayText } : m
                  )
                );
              } else if (event.type === "done") {
                // Finalize: parse response to extract metadata
                if (responseType === "suggestion" && fullText) {
                  const parsed = parseResponse(fullText);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === msgId
                        ? {
                            ...m,
                            content: parsed.text,
                            parsed,
                            type: "suggestion",
                          }
                        : m
                    )
                  );
                }
              }
            } catch (_) {}
          }
        }

        // Final parse in case "done" event was missed
        if (responseType === "suggestion" && fullText) {
          const parsed = parseResponse(fullText);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    content: parsed.text,
                    parsed,
                    type: "suggestion",
                  }
                : m
            )
          );
        }
      } else {
        // Non-streaming fallback (JSON response)
        const data = await res.json();
        if (data.session_id) {
          sessionIdRef.current = data.session_id;
        }
        if (data.response) {
          const rt = data.type || responseType;
          const parsed = rt === "suggestion" ? parseResponse(data.response) : undefined;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    type: rt,
                    content: parsed ? parsed.text : data.response,
                    parsed,
                  }
                : m
            )
          );
        } else {
          // Remove empty placeholder if no response
          setMessages((prev) => prev.filter((m) => m.id !== msgId));
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err?.message || "Failed to get suggestions");
        // Remove the empty placeholder on error
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // User clicks AI button
  const requestAssist = useCallback(async (transcript: string) => {
    if (transcript.length < 20) return;
    transcriptRef.current = transcript;
    await callApi(transcript);
  }, [callApi]);

  // Update transcript ref
  const updateTranscript = useCallback((transcript: string) => {
    transcriptRef.current = transcript;
  }, []);

  // Follow-up question
  const askQuestion = useCallback(async (question: string) => {
    if (!question.trim()) return;

    const userMsg: AssistMessage = {
      id: msgIdRef.current++,
      role: "user",
      type: "chat",
      content: question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await callApi(transcriptRef.current, question);
  }, [callApi]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    transcriptRef.current = "";
    sessionIdRef.current = null;
    customerContextRef.current = undefined;
    localeRef.current = "en";
    setIsSessionReady(false);
    warmingUpRef.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    isSessionReady,
    warmUpSession,
    setLocale,
    requestAssist,
    updateTranscript,
    askQuestion,
    clearMessages,
  };
}

"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ConversationEntry,
  StoredTranscriptEntry,
  StoredAssistMessage,
} from "@/lib/db-types";
import type { AssistMessage } from "@/hooks/use-agent-assist";
import type { TranscriptEntry } from "@/hooks/use-transcription";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function getDeepgramSummary(transcriptText: string): Promise<string | undefined> {
  if (!transcriptText.trim()) return undefined;
  try {
    const keyRes = await fetch(`${SUPABASE_URL}/functions/v1/deepgram-token`);
    if (!keyRes.ok) return undefined;
    const { key } = await keyRes.json();

    const res = await fetch(
      "https://api.deepgram.com/v1/read?summarize=true&language=en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: transcriptText }),
      }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    return (data.results?.summary?.short as string) ?? undefined;
  } catch (err: any) {
    console.error("[useConversationSave] Deepgram summary error:", err?.message);
    return undefined;
  }
}

// Shared helper: fetch-modify-update a single conversation entry
async function patchEntry(
  customerId: string,
  conversationEntryId: string,
  patch: Partial<ConversationEntry>
): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("agent_assist")
    .select("conversation")
    .eq("id", customerId)
    .single();

  if (fetchError || !data) {
    console.error("[useConversationSave] Fetch error:", fetchError);
    return;
  }

  const conversations = (data.conversation as ConversationEntry[]) || [];
  const idx = conversations.findIndex((e) => e.id === conversationEntryId);

  if (idx === -1) {
    console.warn("[useConversationSave] Entry not found:", conversationEntryId);
    return;
  }

  const updated = conversations.map((e, i) =>
    i === idx ? { ...e, ...patch } : e
  );

  const { error: updateError } = await supabase
    .from("agent_assist")
    .update({ conversation: updated, updated_at: new Date().toISOString() })
    .eq("id", customerId);

  if (updateError) {
    console.error("[useConversationSave] Update error:", updateError);
  }
}

interface SavePayload {
  transcript: TranscriptEntry[];
  assistMessages: AssistMessage[];
  duration?: string;
}

export function useConversationSave() {
  const [isSaving, setIsSaving] = useState(false);

  const saveCallData = useCallback(
    async (customerId: string, conversationEntryId: string, payload: SavePayload) => {
      setIsSaving(true);
      try {
        // 1. Build stored transcript (final entries only)
        const storedTranscript: StoredTranscriptEntry[] = payload.transcript
          .filter((e) => e.isFinal)
          .map(({ speaker, text, timestamp }) => ({ speaker, text, timestamp }));

        // 2. Get call summary from Deepgram Text Intelligence API
        const transcriptText = storedTranscript
          .map((e) => `${e.speaker === "local" ? "Agent" : "Customer"}: ${e.text}`)
          .join("\n");
        const summary = await getDeepgramSummary(transcriptText);

        // 3. Build stored assist history
        const assistHistory: StoredAssistMessage[] = payload.assistMessages
          .filter((m) => m.content)
          .map((m) => ({
            role: m.role,
            type: m.type,
            content: m.content,
            metadata: m.parsed?.metadata,
            timestamp: m.timestamp,
          }));

        const patch: Partial<ConversationEntry> = {
          ...(payload.duration ? { duration: payload.duration } : {}),
          ...(storedTranscript.length > 0 ? { transcript: storedTranscript } : {}),
          ...(summary ? { summary } : {}),
          ...(assistHistory.length > 0 ? { assistHistory } : {}),
        };

        await patchEntry(customerId, conversationEntryId, patch);
      } catch (err: any) {
        console.error("[useConversationSave] Unexpected error:", err?.message);
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const createConversationEntry = useCallback(
    async (customerId: string, entry: ConversationEntry): Promise<boolean> => {
      try {
        const { data, error: fetchError } = await supabase
          .from("agent_assist")
          .select("conversation")
          .eq("id", customerId)
          .single();

        if (fetchError || !data) {
          console.error("[useConversationSave] Fetch error on create:", fetchError);
          return false;
        }

        const conversations = (data.conversation as ConversationEntry[]) || [];
        const updated = [...conversations, entry];

        const { error: updateError } = await supabase
          .from("agent_assist")
          .update({ conversation: updated, updated_at: new Date().toISOString() })
          .eq("id", customerId);

        if (updateError) {
          console.error("[useConversationSave] Create entry error:", updateError);
          return false;
        }
        return true;
      } catch (err: any) {
        console.error("[useConversationSave] Unexpected error on create:", err?.message);
        return false;
      }
    },
    []
  );

  return { saveCallData, createConversationEntry, isSaving };
}

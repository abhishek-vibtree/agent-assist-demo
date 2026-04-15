"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CallLabel } from "./call-label";
import type { AgentAssistRow, ConversationEntry, StoredTranscriptEntry, StoredAssistMessage } from "@/lib/db-types";
import {
  MoreVertical,
  Phone,
  PhoneIncoming,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";


/* ── Render text with **bold** markdown ── */
function BoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <span key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/* ── Transcript panel ── */
function TranscriptPanel({ entries }: { entries: StoredTranscriptEntry[] }) {
  return (
    <div className="mt-2 rounded-lg border border-black/5 bg-white/70 p-2 space-y-1">
      {entries.map((e, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-0.5",
            e.speaker === "local" ? "items-end" : "items-start"
          )}
        >
          <span className="text-[9px] font-medium text-muted-foreground">
            {e.speaker === "local" ? "Agent" : "Customer"}
          </span>
          <span
            className={cn(
              "rounded-xl px-2.5 py-1 text-[11px] leading-relaxed",
              e.speaker === "local"
                ? "bg-blue-100 text-blue-900"
                : "bg-muted text-foreground"
            )}
          >
            {e.text}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Summary panel ── */
function SummaryPanel({ text }: { text: string }) {
  return (
    <div className="mt-2 rounded-lg border border-black/5 bg-emerald-50 p-2.5">
      <p className="text-[11px] leading-relaxed text-foreground/80">
        <BoldText text={text} />
      </p>
    </div>
  );
}

/* ── Confidence/sentiment badge helpers ── */
function confidenceColor(c: string) {
  const lower = c.toLowerCase();
  if (lower.includes("high")) return { bg: "#DCFCE7", text: "#16A34A" };
  if (lower.includes("medium")) return { bg: "#FEF9C3", text: "#A16207" };
  return { bg: "#FEE2E2", text: "#EF4444" };
}

function sentimentColor(s: string) {
  const lower = s.toLowerCase();
  if (lower.includes("happy") || lower.includes("positive"))
    return { bg: "#DCFCE7", text: "#16A34A" };
  if (lower.includes("angry") || lower.includes("negative") || lower.includes("frustrat"))
    return { bg: "#FEE2E2", text: "#EF4444" };
  return { bg: "#F3F4F6", text: "#6B7280" };
}

/* ── Assist history panel ── */
function AssistHistoryPanel({ messages }: { messages: StoredAssistMessage[] }) {
  return (
    <div className="mt-2 rounded-lg border border-black/5 bg-white/70 p-2 space-y-2">
      {messages.map((m, i) => (
        <div
          key={i}
          className={cn(
            "flex flex-col gap-0.5",
            m.role === "user" ? "items-end" : "items-start"
          )}
        >
          <span className="text-[9px] font-medium text-muted-foreground">
            {m.role === "user" ? "Agent" : m.type === "suggestion" ? "AI Suggest" : "AI Reply"}
          </span>
          <div
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed",
              m.role === "user"
                ? "bg-purple-100 text-purple-900"
                : "bg-white text-foreground/80 ring-1 ring-gray-100 shadow-sm"
            )}
          >
            <BoldText text={m.content} />
            {m.metadata && (m.metadata.confidence || m.metadata.sentiment) && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {m.metadata.confidence && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                    style={{ backgroundColor: confidenceColor(m.metadata.confidence).bg, color: confidenceColor(m.metadata.confidence).text }}
                  >
                    {m.metadata.confidence}
                  </span>
                )}
                {m.metadata.sentiment && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                    style={{ backgroundColor: sentimentColor(m.metadata.sentiment).bg, color: sentimentColor(m.metadata.sentiment).text }}
                  >
                    {m.metadata.sentiment}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CallLogBubble({
  entry,
  customerName,
  phone,
}: {
  entry: ConversationEntry;
  customerName: string;
  phone: string;
}) {
  const { tc } = useI18n();
  const isOutgoing = entry.direction === "outgoing";
  const isConnected = entry.status === "connected";
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showAssist, setShowAssist] = useState(false);

  const hasTranscript = (entry.transcript?.length ?? 0) > 0;
  const hasSummary = !!entry.summary;
  const hasAssist = (entry.assistHistory?.length ?? 0) > 0;
  const hasExpandable = hasTranscript || hasSummary || hasAssist;

  return (
    <div
      className={cn(
        "w-full max-w-sm px-4",
        isOutgoing ? "self-end" : "self-start"
      )}
    >
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            "flex flex-col gap-2 rounded-2xl p-3",
            isOutgoing ? "bg-blue-100" : "bg-muted/50"
          )}
        >
          {/* Call info header */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                isOutgoing ? "bg-blue-200" : "bg-muted"
              )}
            >
              {isOutgoing ? (
                <Phone className="h-5 w-5 text-muted-foreground" />
              ) : (
                <PhoneIncoming
                  className={cn(
                    "h-5 w-5",
                    isConnected ? "text-muted-foreground" : "text-destructive"
                  )}
                />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{customerName}</span>
              {isConnected && entry.duration ? (
                <span className="text-xs text-muted-foreground">
                  {entry.duration}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{phone}</span>
              )}
            </div>
          </div>

          {/* Labels */}
          {entry.labels.length > 0 && (
            <div className="flex gap-1.5">
              {entry.labels.map((label, i) => (
                <CallLabel
                  key={i}
                  text={label.text}
                  color={label.color}
                  rounded
                />
              ))}
            </div>
          )}

          {/* Note */}
          {entry.note && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-2.5">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-foreground">
                {tc(entry.note)}
              </p>
            </div>
          )}

          {/* Expandable section toggle pills */}
          {hasExpandable && (
            <div className="flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
              {hasTranscript && (
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                    showTranscript
                      ? "bg-blue-200 text-blue-800"
                      : "bg-white/60 text-muted-foreground hover:bg-white"
                  )}
                >
                  Transcript ({entry.transcript!.length})
                </button>
              )}
              {hasSummary && (
                <button
                  onClick={() => setShowSummary((v) => !v)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                    showSummary
                      ? "bg-emerald-200 text-emerald-800"
                      : "bg-white/60 text-muted-foreground hover:bg-white"
                  )}
                >
                  Summary
                </button>
              )}
              {hasAssist && (
                <button
                  onClick={() => setShowAssist((v) => !v)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                    showAssist
                      ? "bg-purple-200 text-purple-800"
                      : "bg-white/60 text-muted-foreground hover:bg-white"
                  )}
                >
                  AI Assist ({entry.assistHistory!.length})
                </button>
              )}
            </div>
          )}

          {/* Expanded panels */}
          {showTranscript && entry.transcript && (
            <TranscriptPanel entries={entry.transcript} />
          )}
          {showSummary && entry.summary && (
            <SummaryPanel text={entry.summary} />
          )}
          {showAssist && entry.assistHistory && (
            <AssistHistoryPanel messages={entry.assistHistory} />
          )}
        </div>

        {/* Timestamp + agent */}
        <div
          className={cn(
            "flex items-center gap-2",
            isOutgoing ? "justify-end" : ""
          )}
        >
          <span className="text-[11px] text-muted-foreground">
            {entry.time}
          </span>
          {entry.agent && (
            <div className="flex items-center">
              <Avatar className="h-5 w-5 border border-muted-foreground/30">
                <AvatarFallback className="bg-purple-200 text-[8px]">
                  {entry.agent[0]}
                </AvatarFallback>
              </Avatar>
              <span className="rounded-r-full bg-muted px-2 py-0.5 text-[11px]">
                {entry.agent}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatArea({
  customer,
  onHeaderClick,
}: {
  customer: AgentAssistRow | null;
  onHeaderClick?: () => void;
}) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [customer?.id, customer?.conversation?.length]);

  if (!customer) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-r bg-background">
        <p className="text-sm text-muted-foreground">{t("selectCallToView")}</p>
      </div>
    );
  }

  const labels = customer.details?.labels || [];
  const initials =
    customer.details?.initials ||
    customer.customer_name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  const conversations = customer.conversation || [];

  // Group conversations by date
  const grouped = new Map<string, ConversationEntry[]>();
  for (const entry of conversations) {
    const date = entry.date || "Unknown";
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(entry);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r bg-background">
      {/* Header — click to toggle profile sidebar */}
      <div
        className="flex cursor-pointer items-center justify-between border-b px-6 py-3 transition-colors hover:bg-muted/30"
        onClick={onHeaderClick}
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(customer.customer_name)}&backgroundColor=e0e0e0&textColor=555555`}
              alt={customer.customer_name}
            />
            <AvatarFallback className="bg-gray-300 text-lg font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="text-base font-normal">
              {customer.customer_name}
            </span>
            {labels.length > 0 && (
              <div className="flex gap-1.5">
                {labels.map((label, i) => (
                  <CallLabel key={i} text={label.text} color={label.color} />
                ))}
              </div>
            )}
          </div>
        </div>
        <button className="rounded-md p-1.5 hover:bg-muted">
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Chat body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 p-4">
          {conversations.length === 0 ? (
            <p className="py-12 text-sm text-muted-foreground">
              {t("noCallHistoryYet")}
            </p>
          ) : (
            Array.from(grouped.entries()).map(([date, entries]) => (
              <div key={date} className="flex w-full flex-col items-center gap-3">
                {/* Date divider */}
                <span className="text-xs font-medium text-muted-foreground">
                  {date}
                </span>

                {/* Call logs for this date */}
                {entries.map((entry) => (
                  <CallLogBubble
                    key={entry.id}
                    entry={entry}
                    customerName={customer.customer_name}
                    phone={customer.phone_number}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

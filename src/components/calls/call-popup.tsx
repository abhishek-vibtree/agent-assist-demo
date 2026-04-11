"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Grid3X3,
  Delete,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Send,
  ChevronDown,
} from "lucide-react";
import type { CallStatus } from "@/hooks/use-twilio";
import type { TranscriptEntry } from "@/hooks/use-transcription";
import type { AgentMetadata, AssistMessage } from "@/hooks/use-agent-assist";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const keypadKeys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const keypadSub: Record<string, string> = {
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
  "0": "+",
};

/* ── Transcript bubble ── */
function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isLocal = entry.speaker === "local";
  return (
    <div className={cn("flex gap-2", isLocal ? "flex-row-reverse" : "")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isLocal ? "rounded-tr-md bg-blue-100" : "rounded-tl-md bg-muted/60",
          !entry.isFinal && "opacity-60"
        )}
      >
        {entry.text}
        {!entry.isFinal && (
          <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-gray-400 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

/* ── Render text with **bold** markdown ── */
function BoldText({ text }: { text: string }) {
  // Split on **...** patterns and render bold spans
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

/* ── Metadata tags (reason, confidence, sentiment, flags) ── */
function MetadataTags({ metadata }: { metadata: AgentMetadata }) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const confidenceColor = (c: string) => {
    const lower = c.toLowerCase();
    if (lower.includes("high")) return { bg: "#DCFCE7", text: "#16A34A" };
    if (lower.includes("medium")) return { bg: "#FEF9C3", text: "#A16207" };
    return { bg: "#FEE2E2", text: "#EF4444" };
  };

  const sentimentColor = (s: string) => {
    const lower = s.toLowerCase();
    if (lower.includes("happy") || lower.includes("positive"))
      return { bg: "#DCFCE7", text: "#16A34A" };
    if (lower.includes("angry") || lower.includes("negative") || lower.includes("frustrat"))
      return { bg: "#FEE2E2", text: "#EF4444" };
    return { bg: "#F3F4F6", text: "#6B7280" };
  };

  const hasFlags =
    metadata.flags &&
    metadata.flags.trim() !== "" &&
    !metadata.flags.toLowerCase().startsWith("none");

  const cc = confidenceColor(metadata.confidence);
  const sc = sentimentColor(metadata.sentiment);

  return (
    <div className="mt-2 space-y-1.5">
      {/* Flags banner */}
      {hasFlags && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 px-2.5 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
          <p className="text-[10px] leading-relaxed text-red-700">
            {metadata.flags}
          </p>
        </div>
      )}

      {/* Reason (collapsed by default) */}
      {metadata.reason && (
        <div className="border-t border-b border-gray-100 py-1.5">
          <button
            onClick={() => setReasonOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-[10px] font-semibold text-foreground/70">
              Reason
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-transform",
                reasonOpen && "rotate-180"
              )}
            />
          </button>
          {reasonOpen && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              {metadata.reason}
            </p>
          )}
        </div>
      )}

      {/* Tags row */}
      <div className="flex items-center gap-1.5 pt-0.5">
        {metadata.confidence && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: cc.bg, color: cc.text }}
          >
            {metadata.confidence}
          </span>
        )}
        {metadata.sentiment && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: sc.bg, color: sc.text }}
          >
            {metadata.sentiment}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Assist chat panel (right column) ── */
function AssistChatPanel({
  messages,
  isLoading,
  error,
  onSendMessage,
}: {
  messages: AssistMessage[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (question: string) => void;
}) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <Sparkles className="h-8 w-8 text-purple-300" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                AI Agent Assist
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Click the AI button or ask a question below to get suggestions.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg, idx) => {
            // Check if this is the last message and still streaming
            const isLastMsg = idx === messages.length - 1;
            const isStreaming = isLastMsg && isLoading && msg.role === "assistant";
            const isEmpty = !msg.content || msg.content.trim() === "";

            // Skip rendering empty placeholder while streaming hasn't started
            if (msg.role === "assistant" && isEmpty && isStreaming) return null;
            // Skip empty assistant messages entirely
            if (msg.role === "assistant" && isEmpty && !isStreaming) return null;

            return (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-2xl rounded-tr-md bg-purple-100 px-3 py-2">
                      <p className="text-[11px] leading-relaxed text-purple-900">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100">
                      <Sparkles className="h-3 w-3 text-purple-600" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                        <BoldText text={msg.content} />
                        {isStreaming && (
                          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-purple-400 align-text-bottom" />
                        )}
                      </p>
                      {/* Show metadata tags after streaming is done */}
                      {!isStreaming && msg.parsed?.metadata && (
                        <MetadataTags metadata={msg.parsed.metadata} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading indicator — only show when no streaming message is visible yet */}
          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user" || (!messages[messages.length - 1]?.content)) && (
            <div className="flex gap-2">
              <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100">
                <Sparkles className="h-3 w-3 text-purple-600" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <p className="text-[11px] text-red-500">{error}</p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask AI about this call..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-purple-300 focus:ring-1 focus:ring-purple-200 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500 text-white transition-colors hover:bg-purple-600 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Props ── */
interface CallPopupProps {
  open: boolean;
  onClose: () => void;
  status: CallStatus;
  isMuted: boolean;
  duration: number;
  error: string | null;
  isReady: boolean;
  onMakeCall: (phone: string) => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onSendDigits: (digits: string) => void;
  onInitDevice: () => void;
  transcript: TranscriptEntry[];
  isTranscribing: boolean;
  transcriptionError: string | null;
  assistMessages: AssistMessage[];
  isSuggestionLoading: boolean;
  suggestionError: string | null;
  onAskQuestion: (question: string) => void;
  onTriggerAssist: () => void;
}

export function CallPopup({
  open,
  onClose,
  status,
  isMuted,
  duration,
  error,
  isReady,
  onMakeCall,
  onHangUp,
  onToggleMute,
  onSendDigits,
  onInitDevice,
  transcript,
  isTranscribing,
  transcriptionError,
  assistMessages,
  isSuggestionLoading,
  suggestionError,
  onAskQuestion,
  onTriggerAssist,
}: CallPopupProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showKeypad, setShowKeypad] = useState(true);
  const [showDtmf, setShowDtmf] = useState(false);
  const [showAssistPanel, setShowAssistPanel] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !isReady) onInitDevice();
  }, [open, isReady, onInitDevice]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  if (!open) return null;

  const isIdle =
    status === "idle" || status === "disconnected" || status === "error";
  const isActive =
    status === "connecting" ||
    status === "ringing" ||
    status === "connected";

  const handleKeyPress = (key: string) => {
    if (isActive) onSendDigits(key);
    else setPhoneNumber((prev) => prev + key);
  };

  const handleBackspace = () => setPhoneNumber((prev) => prev.slice(0, -1));

  const handleCall = () => {
    if (phoneNumber.trim()) onMakeCall(phoneNumber.trim());
  };

  const statusLabel: Record<string, string> = {
    idle: "Ready",
    connecting: "Connecting...",
    ringing: "Ringing...",
    connected: "Connected",
    disconnected: "Call Ended",
    error: error || "Error",
  };

  const statusColor: Record<string, string> = {
    idle: "text-muted-foreground",
    connecting: "text-yellow-500",
    ringing: "text-yellow-500",
    connected: "text-emerald-500",
    disconnected: "text-muted-foreground",
    error: "text-red-500",
  };

  // Wide two-column layout only when assist panel is open
  const popupWidth = isActive && showAssistPanel ? 760 : 380;

  return (
    <div
      className="fixed bottom-24 right-4 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{
        width: popupWidth,
        height: isActive ? "80vh" : "auto",
        maxHeight: "85vh",
        transition: "width 0.3s ease",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isReady ? "bg-emerald-500" : "bg-yellow-500"
            )}
          />
          <span className="text-sm font-semibold text-foreground">
            {isActive ? "Live Call" : "Make a Call"}
          </span>
          {isTranscribing && (
            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-medium", statusColor[status])}>
                {statusLabel[status]}
              </span>
              {status === "connected" && (
                <>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground">
                    {formatDuration(duration)}
                  </span>
                  {/* AI Assist trigger button */}
                  <button
                    onClick={() => {
                      if (!showAssistPanel) {
                        setShowAssistPanel(true);
                        onTriggerAssist();
                      } else {
                        setShowAssistPanel(false);
                      }
                    }}
                    disabled={isSuggestionLoading}
                    className={cn(
                      "ml-1 flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold transition-all",
                      showAssistPanel
                        ? "bg-purple-100 text-purple-600 hover:bg-purple-200"
                        : isSuggestionLoading
                          ? "bg-purple-100 text-purple-400"
                          : "bg-purple-500 text-white hover:bg-purple-600 active:scale-95"
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    AI
                  </button>
                </>
              )}
            </div>
          )}
          <button
            onClick={() => {
              if (isActive) return;
              onClose();
            }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isActive ? "cursor-not-allowed opacity-30" : "hover:bg-muted"
            )}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left column: dialer / transcript + toolbar */}
        <div
          className={cn(
            "flex min-h-0 flex-col",
            isActive ? "flex-1 border-r" : "w-full"
          )}
        >
          {/* Phone number / status */}
          {!isActive && (
            <div className="shrink-0 px-4 pt-4 pb-2">
              <div className="relative">
                <Input
                  type="tel"
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCall();
                  }}
                  className="pr-10 text-center text-lg tracking-wider"
                />
                {phoneNumber && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {isActive && (
            <div className="shrink-0 flex flex-col items-center gap-0.5 px-4 py-3">
              <span className="text-base font-semibold tracking-wide text-foreground">
                {phoneNumber || "Unknown"}
              </span>
              {(status === "connecting" || status === "ringing") && (
                <div className="mt-1 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-pulse rounded-full bg-yellow-400"
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error messages */}
          {error && status === "error" && (
            <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          {transcriptionError && (
            <div className="mx-4 mb-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              Transcription: {transcriptionError}
            </div>
          )}

          {/* Live Transcript */}
          {isActive && (
            <div
              className="flex-1 overflow-y-auto border-t px-4 py-3"
              style={{ minHeight: 100 }}
            >
              {transcript.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  {status === "connected" ? (
                    <>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="animate-pulse opacity-40"
                      >
                        <path
                          d="M12 3a4 4 0 0 0-4 4v4a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M5 11v.5a7 7 0 0 0 14 0V11"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 19v3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="text-xs">Listening for speech...</span>
                    </>
                  ) : (
                    <span className="text-xs">{statusLabel[status]}</span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {transcript
                    .filter((entry, idx, arr) => {
                      // Skip interim entries if the next entry from same speaker is final with same/similar text
                      if (!entry.isFinal) {
                        const next = arr[idx + 1];
                        if (next && next.isFinal && next.speaker === entry.speaker) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((entry) => (
                      <TranscriptBubble key={entry.id} entry={entry} />
                    ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Keypad (dialer mode) */}
          {isIdle && showKeypad && (
            <div className="px-6 pb-2">
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.flat().map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="flex h-14 flex-col items-center justify-center rounded-xl transition-colors hover:bg-muted active:bg-muted/80"
                  >
                    <span className="text-xl font-medium text-foreground">
                      {key}
                    </span>
                    {keypadSub[key] && (
                      <span className="text-[9px] font-medium tracking-widest text-muted-foreground">
                        {keypadSub[key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DTMF keypad overlay */}
          {isActive && showDtmf && (
            <div className="shrink-0 border-t px-6 py-2">
              <div className="grid grid-cols-3 gap-2">
                {keypadKeys.flat().map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="flex h-12 flex-col items-center justify-center rounded-xl bg-muted/50 transition-colors hover:bg-muted active:bg-muted/80"
                  >
                    <span className="text-lg font-medium text-foreground">
                      {key}
                    </span>
                    {keypadSub[key] && (
                      <span className="text-[8px] font-medium tracking-widest text-muted-foreground">
                        {keypadSub[key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom toolbar */}
          {isIdle ? (
            <div className="flex items-center justify-center gap-3 px-4 pb-4 pt-2">
              <button
                onClick={() => setShowKeypad((v) => !v)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  showKeypad
                    ? "bg-muted text-foreground"
                    : "bg-muted/50 text-muted-foreground"
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={handleCall}
                disabled={!phoneNumber.trim() || !isReady}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-40"
              >
                <Phone className="h-6 w-6" />
              </button>
              <div className="h-10 w-10" />
            </div>
          ) : (
            <div
              className="shrink-0 flex items-center justify-center gap-2 px-4 py-3"
              style={{
                backgroundColor: "#1E1E2E",
                borderTop: "1px solid #2D2D3D",
              }}
            >
              <button
                onClick={onToggleMute}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-white/10",
                  isMuted && "bg-white/10"
                )}
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5" style={{ color: "#EF4444" }} />
                ) : (
                  <Mic
                    className="h-5 w-5"
                    style={{ color: "rgba(255,255,255,0.8)" }}
                  />
                )}
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: isMuted ? "#EF4444" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>

              <button
                onClick={() => setShowDtmf((v) => !v)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-white/10",
                  showDtmf && "bg-white/10"
                )}
              >
                <Grid3X3
                  className="h-5 w-5"
                  style={{
                    color: showDtmf ? "#22C55E" : "rgba(255,255,255,0.8)",
                  }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: showDtmf ? "#22C55E" : "rgba(255,255,255,0.6)",
                  }}
                >
                  Keypad
                </span>
              </button>

              <button
                onClick={onHangUp}
                className="ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#EF4444" }}
              >
                <PhoneOff className="h-5 w-5 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Right column: AI Chat (only after clicking AI button) */}
        {isActive && showAssistPanel && (
          <div className="flex w-[320px] shrink-0 min-h-0 flex-col bg-gray-50/50">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Assist
              </span>
            </div>
            <AssistChatPanel
              messages={assistMessages}
              isLoading={isSuggestionLoading}
              error={suggestionError}
              onSendMessage={onAskQuestion}
            />
          </div>
        )}
      </div>
    </div>
  );
}

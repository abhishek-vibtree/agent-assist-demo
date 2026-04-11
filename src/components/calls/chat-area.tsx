"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CallLabel } from "./call-label";
import type { AgentAssistRow } from "@/lib/db-types";
import {
  MoreVertical,
  Phone,
  PhoneIncoming,
  Play,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

function AudioPlayer({ duration }: { duration: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5">
      <button className="text-muted-foreground hover:text-foreground">
        <Play className="h-5 w-5 fill-current" />
      </button>
      <div className="h-1 flex-1 rounded-full bg-muted">
        <div className="h-full w-0 rounded-full bg-emerald-600" />
      </div>
      <span className="text-xs text-muted-foreground">{duration}</span>
    </div>
  );
}

interface ConversationEntry {
  id: string;
  direction: "outgoing" | "incoming";
  status: "connected" | "missed";
  duration: string;
  time: string;
  date: string;
  hasRecording: boolean;
  agent?: string;
  labels: { text: string; color: string }[];
  note?: string;
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
  const isOutgoing = entry.direction === "outgoing";
  const isConnected = entry.status === "connected";

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

          {/* Audio player for recorded calls */}
          {entry.hasRecording && entry.duration && (
            <AudioPlayer duration={entry.duration} />
          )}

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
                {entry.note}
              </p>
            </div>
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
  if (!customer) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-r bg-background">
        <p className="text-sm text-muted-foreground">Select a call to view</p>
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
    <div className="flex min-w-0 flex-1 flex-col border-r bg-background">
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
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-3 p-4">
          {conversations.length === 0 ? (
            <p className="py-12 text-sm text-muted-foreground">
              No call history yet
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
      </ScrollArea>
    </div>
  );
}

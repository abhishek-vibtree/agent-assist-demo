"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CallLabel } from "./call-label";
import type { AgentAssistRow } from "@/lib/db-types";
import {
  Filter,
  Search,
  Settings,
  ChevronDown,
  PhoneForwarded,
  PhoneMissed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function CallListItem({
  customer,
  active,
  onClick,
  noAnswerLabel,
}: {
  customer: AgentAssistRow;
  active: boolean;
  onClick: () => void;
  noAnswerLabel: string;
}) {
  const labels = customer.details?.labels || [];
  const initials =
    customer.details?.initials ||
    customer.customer_name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // Get latest conversation entry for status/duration
  const latestCall = customer.conversation?.[0];
  const isMissed = latestCall?.status === "missed";
  const duration = latestCall?.duration || "";
  const time = latestCall?.time || "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/50"
      )}
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarImage
          src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(customer.customer_name)}&backgroundColor=e0e0e0&textColor=555555`}
          alt={customer.customer_name}
        />
        <AvatarFallback className="bg-muted text-sm font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-foreground">
            {customer.customer_name}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {time}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isMissed ? (
            <PhoneMissed className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <PhoneForwarded className="h-4 w-4 shrink-0 text-emerald-500" />
          )}
          <span className="text-sm text-muted-foreground">
            {isMissed && !duration ? noAnswerLabel : duration || "0:00"}
          </span>
        </div>

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {labels.map((label, i) => (
              <CallLabel key={i} text={label.text} color={label.color} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export function CallListPanel({
  customers,
  isLoading,
  selectedId,
  onSelect,
}: {
  customers: AgentAssistRow[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex h-full w-80 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t("calls")}</h2>
          <span className="text-sm text-muted-foreground">
            {customers.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1.5 hover:bg-muted">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="rounded-md p-1.5 hover:bg-muted">
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Phone selector */}
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-sm">
              &#x1F680;
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-normal">{t("customerSupport")}</span>
              <span className="text-xs text-muted-foreground">
                +91 987654310
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Call list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {customers.map((customer) => (
              <CallListItem
                key={customer.id}
                customer={customer}
                active={customer.id === selectedId}
                onClick={() => onSelect(customer.id)}
                noAnswerLabel={t("noAnswer")}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CallListPanel } from "@/components/calls/call-list-panel";
import { ChatArea } from "@/components/calls/chat-area";
import { CustomerProfile } from "@/components/calls/customer-profile";
import { FloatingCTA } from "@/components/calls/floating-cta";
import { CallPopup } from "@/components/calls/call-popup";
import { useTwilio } from "@/hooks/use-twilio";
import { useTranscription } from "@/hooks/use-transcription";
import { useAgentAssist } from "@/hooks/use-agent-assist";
import { useCustomers } from "@/hooks/use-customers";
import { useConversationSave } from "@/hooks/use-conversation-save";
import { useI18n } from "@/lib/i18n";
import type { ConversationEntry } from "@/lib/db-types";


export default function Home() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const dialedNumberRef = useRef<string>("");

  const { locale } = useI18n();
  const twilio = useTwilio();
  const transcription = useTranscription();
  const agentAssist = useAgentAssist();
  const { customers, isLoading: isLoadingCustomers, refetch: refetchCustomers } = useCustomers();
  const conversationSave = useConversationSave();
  const prevStatusRef = useRef(twilio.status);

  // Refs to track active call IDs
  const activeCustomerIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  // Track call start time independently — twilio.duration resets to 0 on hangUp()
  // before the disconnect effect runs, so we compute duration ourselves
  const callStartTimeRef = useRef<number | null>(null);

  // Mirror live data to refs so the disconnect handler reads current values
  const transcriptRef = useRef(transcription.transcript);
  useEffect(() => { transcriptRef.current = transcription.transcript; }, [transcription.transcript]);

  const assistMessagesRef = useRef(agentAssist.messages);
  useEffect(() => { assistMessagesRef.current = agentAssist.messages; }, [agentAssist.messages]);

  // Keep agent assist locale in sync whenever UI locale changes
  useEffect(() => {
    agentAssist.setLocale(locale);
  }, [locale, agentAssist.setLocale]);

  // Auto-select first customer when data loads
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  // Start/stop transcription on call connect/disconnect
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = twilio.status;
    prevStatusRef.current = curr;

    if (prev !== "connected" && curr === "connected") {
      callStartTimeRef.current = Date.now();

      // Start transcription
      setTimeout(() => {
        const streams = twilio.getStreams();
        transcription.startTranscription(streams.local, streams.remote, locale);
      }, 1000);

      // Look up customer by dialed phone number and send context to AI
      const phone = dialedNumberRef.current;
      const matchedCustomer = customers.find((c) => {
        // Normalize both numbers (strip non-digits) for comparison
        const normalize = (n: string) => n.replace(/\D/g, "");
        return normalize(c.phone_number) === normalize(phone);
      });

      const customerContext = matchedCustomer
        ? {
            name: matchedCustomer.customer_name,
            phone: matchedCustomer.phone_number,
            email: matchedCustomer.email,
            ...matchedCustomer.details,
            recentConversations: matchedCustomer.conversation,
          }
        : phone
          ? { phone, note: "Unknown caller — no matching record found." }
          : undefined;

      agentAssist.warmUpSession(customerContext, locale);

      // Create a new conversation entry in Supabase for this call
      if (matchedCustomer) {
        const newEntry: ConversationEntry = {
          id: crypto.randomUUID(),
          direction: "outgoing",
          status: "connected",
          duration: "",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          date: new Date().toLocaleDateString(),
          labels: [],
        };
        activeCustomerIdRef.current = matchedCustomer.id;
        activeConversationIdRef.current = newEntry.id;
        conversationSave.createConversationEntry(matchedCustomer.id, newEntry).then((ok) => {
          if (ok) refetchCustomers();
        });
      }
    }

    if (
      prev === "connected" &&
      (curr === "idle" || curr === "disconnected" || curr === "error")
    ) {
      (async () => {
        // Compute duration from start time
        const durationSecs = callStartTimeRef.current
          ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
          : 0;
        const durationStr = durationSecs > 0
          ? `${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, "0")}`
          : undefined;
        callStartTimeRef.current = null;

        if (activeCustomerIdRef.current && activeConversationIdRef.current) {
          await conversationSave.saveCallData(
            activeCustomerIdRef.current,
            activeConversationIdRef.current,
            {
              transcript: transcriptRef.current,
              assistMessages: assistMessagesRef.current,
              duration: durationStr,
            }
          );
          refetchCustomers();
        }
        transcription.stopTranscription();
        agentAssist.clearMessages();
        activeCustomerIdRef.current = null;
        activeConversationIdRef.current = null;
      })();
    }
  }, [twilio.status]);

  // Keep transcript ref updated (no auto-trigger)
  useEffect(() => {
    if (twilio.status !== "connected") return;

    const finalEntries = transcription.transcript.filter((e) => e.isFinal);
    if (finalEntries.length === 0) return;

    const text = finalEntries
      .map(
        (e) =>
          `${e.speaker === "local" ? "Agent" : "Customer"}: ${e.text}`
      )
      .join("\n");

    agentAssist.updateTranscript(text);
  }, [transcription.transcript, twilio.status]);

  // Manual trigger: user clicks the AI button
  const handleTriggerAssist = useCallback(() => {
    const finalEntries = transcription.transcript.filter((e) => e.isFinal);
    if (finalEntries.length === 0) return;

    const text = finalEntries
      .map(
        (e) =>
          `${e.speaker === "local" ? "Agent" : "Customer"}: ${e.text}`
      )
      .join("\n");

    agentAssist.requestAssist(text);
  }, [transcription.transcript, agentAssist.requestAssist]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-row overflow-hidden">
        <CallListPanel
          customers={customers}
          isLoading={isLoadingCustomers}
          selectedId={selectedCustomerId}
          onSelect={setSelectedCustomerId}
        />
        <ChatArea
          customer={selectedCustomer}
          onHeaderClick={() => setShowProfile((v) => !v)}
        />
        {showProfile && selectedCustomer && (
          <CustomerProfile
            customer={selectedCustomer}
            onClose={() => setShowProfile(false)}
          />
        )}
      </SidebarInset>
      <FloatingCTA onClick={() => setShowCallPopup(true)} />
      <CallPopup
        open={showCallPopup}
        onClose={() => setShowCallPopup(false)}
        status={twilio.status}
        isMuted={twilio.isMuted}
        duration={twilio.duration}
        error={twilio.error}
        isReady={twilio.isReady}
        onMakeCall={(phone: string) => {
          dialedNumberRef.current = phone;
          twilio.makeCall(phone);
        }}
        onHangUp={twilio.hangUp}
        onToggleMute={twilio.toggleMute}
        onSendDigits={twilio.sendDigits}
        onInitDevice={twilio.initDevice}
        transcript={transcription.transcript}
        isTranscribing={transcription.isTranscribing}
        transcriptionError={transcription.error}
        assistMessages={agentAssist.messages}
        isSuggestionLoading={agentAssist.isLoading}
        suggestionError={agentAssist.error}
        onAskQuestion={agentAssist.askQuestion}
        onTriggerAssist={handleTriggerAssist}
      />
    </SidebarProvider>
  );
}

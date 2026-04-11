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

export default function Home() {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [showCallPopup, setShowCallPopup] = useState(false);
  const dialedNumberRef = useRef<string>("");

  const twilio = useTwilio();
  const transcription = useTranscription();
  const agentAssist = useAgentAssist();
  const { customers, isLoading: isLoadingCustomers } = useCustomers();
  const prevStatusRef = useRef(twilio.status);

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
      // Start transcription
      setTimeout(() => {
        const streams = twilio.getStreams();
        transcription.startTranscription(streams.local, streams.remote);
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

      agentAssist.warmUpSession(customerContext);
    }

    if (
      prev === "connected" &&
      (curr === "idle" || curr === "disconnected" || curr === "error")
    ) {
      transcription.stopTranscription();
      agentAssist.clearMessages();
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

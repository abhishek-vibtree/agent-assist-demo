export interface StoredTranscriptEntry {
  speaker: "local" | "remote";
  text: string;
  timestamp: number;
}

export interface StoredAssistMessage {
  role: "user" | "assistant";
  type: "suggestion" | "chat";
  content: string;
  metadata?: {
    reason: string;
    confidence: string;
    sentiment: string;
    flags: string;
  };
  timestamp: number;
}

export interface ConversationEntry {
  id: string;
  direction: "outgoing" | "incoming";
  status: "connected" | "missed";
  duration: string;
  time: string;
  date: string;
  agent?: string;
  labels: { text: string; color: string }[];
  note?: string;
  transcript?: StoredTranscriptEntry[];
  summary?: string;
  assistHistory?: StoredAssistMessage[];
}

// Database row type for agent_assist table
export interface AgentAssistRow {
  id: string;
  customer_name: string;
  phone_number: string;
  email: string | null;
  details: {
    firstName?: string;
    lastName?: string;
    initials?: string;
    dob?: string;
    gender?: string;
    username?: string;
    labels?: { text: string; color: string }[];
    addresses?: string[];
    notes?: { text: string; author: string; date: string; time: string }[];
    orders?: {
      orderNumber: string;
      product: string;
      date: string;
      status: string;
      amount: string;
      image: string;
    }[];
  };
  conversation: ConversationEntry[];
  created_at: string;
  updated_at: string;
}

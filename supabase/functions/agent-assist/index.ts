import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2.49.0";

const MODEL = "claude-haiku-4-5-20251001";
const API_BASE = "https://api.anthropic.com/v1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://hywugzuqmrdsjpeosgdi.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KB_BUCKET = "agent-assist-kb";

const SYSTEM_PROMPT = `You are a real-time AI copilot assisting a call center agent during a live customer call.

## Critical Rules
- When a Customer Profile is provided below, you ALREADY HAVE the customer's data. Use it directly. For example, if asked "what is the order number?", look at the orders in the profile and answer with the actual order numbers. NEVER ask the agent to look up or verify information that is already in the Customer Profile.
- Use knowledge base documents for company policies. Never fabricate policy details.
- If information is truly not available anywhere in this prompt, say "I don't have that info — verify with the customer."
- Prioritize first-call resolution.
- Adapt tone: Frustrated → empathetic, Curious → informative, Ready to buy → direct.
- If compliance or risk is detected → flag immediately.

## Two Response Modes

### MODE 1: Transcript Analysis (when analyzing a call transcript)
Use this STRICT format — plain text with bold labels, then a JSON metadata block:

**Suggested Reply:** <1-2 line reply the agent can say verbatim>

**Next Action:** <what the agent should do next>

\`\`\`json
{"reason": "<brief justification>", "confidence": "High|Medium|Low", "sentiment": "Angry|Neutral|Happy", "flags": "Compliance|Escalation|Angry Customer|None"}
\`\`\`

Rules for Mode 1:
- The bold labels and JSON block are REQUIRED.
- No other headers, bullet points, or extra markdown.

### MODE 2: Chat (when the agent asks you a direct question)
Reply like a helpful colleague — 2-3 short sentences MAX. Be direct, conversational, and actionable.
- NO bold labels, NO "Suggested Reply:", NO "Next Action:", NO JSON block.
- Just answer the question plainly using the Customer Profile and KB data.
- Example: "Her latest order is ORD-2024-2105, a Standing Desk Converter for $389 — status is Refund Requested."`;


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory cache for KB content, customer context, and conversation history
const sessionCache = new Map<string, {
  kbContent: string;
  customerContext: string;
  messages: Array<{ role: string; content: string }>;
}>();

function getApiKey(): string {
  return Deno.env.get("Athropic_Agent_API_ley") || "";
}

async function fetchKBContent(): Promise<string> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.storage
      .from(KB_BUCKET)
      .list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

    if (error || !data) {
      console.error("[KB] List error:", error);
      return "";
    }

    const files = data.filter((f: any) => f.name && !f.name.endsWith("/") && f.id);
    if (files.length === 0) return "";

    console.log("[KB] Fetching content from", files.length, "files");

    const contents: string[] = [];
    for (const file of files) {
      try {
        const { data: fileData, error: dlError } = await supabase.storage
          .from(KB_BUCKET)
          .download(file.name);

        if (dlError || !fileData) {
          console.error(`[KB] Download failed for ${file.name}:`, dlError);
          continue;
        }

        const text = await fileData.text();
        if (text && text.trim()) {
          contents.push(`--- ${file.name} ---\n${text.trim()}`);
        }
      } catch (err) {
        console.error(`[KB] Error reading ${file.name}:`, err);
      }
    }

    const result = contents.join("\n\n");
    console.log("[KB] Total content length:", result.length, "chars from", contents.length, "files");
    return result;
  } catch (err) {
    console.error("[KB] Fetch error:", err);
    return "";
  }
}

function generateSessionId(): string {
  return "sess_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, transcript, question, session_id, customer_context } = body;

    if (!getApiKey()) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WARMUP: fetch KB docs and create session
    if (action === "warmup") {
      const sid = generateSessionId();
      console.log("[Warmup] Session:", sid);

      const kbContent = await fetchKBContent();
      const customerCtx = customer_context
        ? JSON.stringify(customer_context, null, 2)
        : "";
      sessionCache.set(sid, { kbContent, customerContext: customerCtx, messages: [] });
      console.log("[Warmup] KB cached, length:", kbContent.length);
      if (customerCtx) {
        console.log("[Warmup] Customer context cached, length:", customerCtx.length);
      }

      return new Response(
        JSON.stringify({ session_id: sid, status: "ready" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // STREAMING FLOW
    if (!transcript && !question) {
      return new Response(
        JSON.stringify({ error: "transcript or question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isFollowUp = !!question;
    let sid = session_id;

    // Get or create session cache
    if (!sid || !sessionCache.has(sid)) {
      sid = sid || generateSessionId();
      if (!sessionCache.has(sid)) {
        console.log("[Fallback] Creating session with KB + customer context");
        const kbContent = await fetchKBContent();
        const customerCtx = customer_context
          ? JSON.stringify(customer_context, null, 2)
          : "";
        sessionCache.set(sid, { kbContent, customerContext: customerCtx, messages: [] });
      }
    }

    const session = sessionCache.get(sid)!;

    // Always update customer context if provided (in case session was recreated)
    if (customer_context && !session.customerContext) {
      session.customerContext = JSON.stringify(customer_context, null, 2);
      console.log("[Session] Customer context restored, length:", session.customerContext.length);
    }

    // Build system prompt with KB content and customer context
    let systemPrompt = SYSTEM_PROMPT;
    if (session.customerContext) {
      systemPrompt += `\n\n## Customer Profile (from CRM)\nBelow is the customer's ACTUAL profile data including their order history, notes, and past interactions. You MUST use this data to answer any questions about the customer's orders, account, or history. Do NOT ask the agent to look up information that is already here.\n\`\`\`json\n${session.customerContext}\n\`\`\``;
    }
    if (session.kbContent) {
      systemPrompt += `\n\n## Knowledge Base Documents\n${session.kbContent}`;
    }

    // Build user message
    let userMessage = "";
    if (isFollowUp) {
      userMessage = `The call center agent is chatting with you as their AI copilot. Reply in 2-3 short sentences MAX. Be direct and actionable — no bullet points, no markdown, no headers. Just give a quick, practical answer like a colleague whispering advice.

Agent says: ${question}

Current transcript for context:
${transcript || "(no transcript yet)"}`;
    } else {
      userMessage = `Here is the current live call transcript. Analyze it and provide suggestions using the structured format:\n\n${transcript}`;
    }

    // Add to conversation history
    session.messages.push({ role: "user", content: userMessage });

    // Call Anthropic Messages API with streaming
    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: session.messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic API failed ${res.status}: ${errBody}`);
    }

    // Pipe Anthropic SSE stream -> client SSE stream
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const anthropicReader = res.body!.getReader();

    const clientStream = new ReadableStream({
      async start(controller) {
        // Send meta event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "meta",
          session_id: sid,
          response_type: isFollowUp ? "chat" : "suggestion",
        })}\n\n`));

        let buffer = "";
        let fullResponse = "";

        try {
          while (true) {
            const { done, value } = await anthropicReader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;

              try {
                const event = JSON.parse(jsonStr);

                // content_block_delta with text
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  const text = event.delta.text;
                  fullResponse += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", text })}\n\n`));
                }

                // message_stop = done
                if (event.type === "message_stop") {
                  // Save assistant response to conversation history
                  session.messages.push({ role: "assistant", content: fullResponse });

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                  controller.close();
                  return;
                }
              } catch (_) {}
            }
          }

          // Stream ended without message_stop
          if (fullResponse) {
            session.messages.push({ role: "assistant", content: fullResponse });
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          try { controller.close(); } catch (_) {}
        }
      },
    });

    return new Response(clientStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("Agent assist error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

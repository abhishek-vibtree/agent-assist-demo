import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const API_KEY = Deno.env.get("TWILIO_API_KEY")!;
const API_SECRET = Deno.env.get("TWILIO_API_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const twilioBase = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}`;
const basicAuth = btoa(`${API_KEY}:${API_SECRET}`);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "call-recordings";

async function ensureBucket(supabase: any) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  // Ignore "already exists" errors
  if (error && !error.message?.includes("already exists")) {
    console.error("Bucket create error:", error.message);
  }
}

async function downloadAndStore(twilioMp3Url: string, filename: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  await ensureBucket(supabase);

  // Download from Twilio with auth
  const res = await fetch(twilioMp3Url, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) throw new Error(`Twilio fetch failed: ${res.status}`);

  const buffer = await res.arrayBuffer();

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: "audio/mpeg", upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // POST — start, get, or migrate recordings
  try {
    const { action, call_sid } = await req.json();

    if (action === "start") {
      if (!call_sid) {
        return new Response(JSON.stringify({ error: "call_sid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${twilioBase}/Calls/${call_sid}/Recordings.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ RecordingChannels: "dual" }).toString(),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ recording_sid: data.sid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      if (!call_sid) {
        return new Response(JSON.stringify({ error: "call_sid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(`${twilioBase}/Calls/${call_sid}/Recordings.json`, {
        headers: { Authorization: `Basic ${basicAuth}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const recordings: any[] = data.recordings || [];
      const completed = recordings.find((r: any) => r.status === "completed");
      if (!completed) {
        return new Response(JSON.stringify({ recording_url: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const twilioMp3 = `https://api.twilio.com${completed.uri.replace(".json", ".mp3")}`;
      const filename = `${completed.sid}.mp3`;
      const recording_url = await downloadAndStore(twilioMp3, filename);

      return new Response(JSON.stringify({ recording_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Migrate: re-download old proxy URLs and upload to storage
    if (action === "migrate") {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      await ensureBucket(supabase);

      const { data: rows, error } = await supabase
        .from("agent_assist")
        .select("id, conversation");

      if (error) throw new Error(error.message);

      let updated = 0;
      for (const row of rows || []) {
        const conversations: any[] = row.conversation || [];
        let changed = false;

        const patched = await Promise.all(conversations.map(async (entry: any) => {
          if (!entry.recordingUrl) return entry;

          // Already a public Supabase Storage URL — skip
          if (entry.recordingUrl.includes("/storage/v1/object/public/")) return entry;

          // Extract the original Twilio URL (from proxy or raw)
          let twilioUrl = entry.recordingUrl;
          if (twilioUrl.includes("action=proxy&url=")) {
            twilioUrl = decodeURIComponent(twilioUrl.split("action=proxy&url=")[1]);
          }

          if (!twilioUrl.startsWith("https://api.twilio.com")) return entry;

          try {
            // Extract SID from URL for filename
            const sidMatch = twilioUrl.match(/\/(RE[a-z0-9]+)\.mp3/);
            const filename = sidMatch ? `${sidMatch[1]}.mp3` : `recording-${Date.now()}.mp3`;
            const publicUrl = await downloadAndStore(twilioUrl, filename);
            changed = true;
            return { ...entry, recordingUrl: publicUrl };
          } catch (err: any) {
            console.error("Migration error for entry", entry.id, err.message);
            return entry;
          }
        }));

        if (changed) {
          await supabase
            .from("agent_assist")
            .update({ conversation: patched })
            .eq("id", row.id);
          updated++;
        }
      }

      return new Response(JSON.stringify({ migrated: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

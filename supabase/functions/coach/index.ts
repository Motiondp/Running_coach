// Coach chat — reads the latest stored athlete_snapshot, calls the LLM with structured
// output, persists both turns, and logs any newly-described injury. The Gemini key
// (and any future provider's key) lives ONLY in this function's secrets
// (`supabase secrets set`), never in the app bundle.
//
// Uses the caller's own JWT (forwarded from the client) rather than the service-role
// key, so every query here goes through the same RLS policies the app itself is
// bound by — this function can only ever see/write the calling athlete's own rows.
import { createClient } from "npm:@supabase/supabase-js@^2.47.10";
import { corsHeaders } from "../_shared/cors.ts";
import { todayLocalDate } from "../_shared/date.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { callGemini, type ChatTurn } from "./providers/gemini.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, thread_id: incomingThreadId } = await req.json();
    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "message is required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const { data: snapshotRow, error: snapErr } = await supabase
      .from("athlete_snapshot")
      .select("id, payload")
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapErr) throw snapErr;
    if (!snapshotRow) {
      return jsonResponse({ error: "No snapshot yet — run `npm run build:snapshot` first" }, 409);
    }

    const threadId = incomingThreadId ?? crypto.randomUUID();

    const { data: historyRows } = await supabase
      .from("coach_message")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history: ChatTurn[] = (historyRows ?? []).map((r) => ({
      role: r.role === "user" ? "user" : "model",
      text: r.content,
    }));

    const provider = Deno.env.get("COACH_PROVIDER") ?? "gemini";
    if (provider !== "gemini") {
      throw new Error(`Unsupported COACH_PROVIDER "${provider}" — only "gemini" is implemented`);
    }
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY secret is not set");

    const result = await callGemini({
      apiKey: geminiKey,
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash",
      systemPrompt: buildSystemPrompt(snapshotRow.payload as Record<string, unknown>),
      history,
      userMessage: message,
    });

    const { error: insertErr } = await supabase.from("coach_message").insert([
      { user_id: userId, thread_id: threadId, role: "user", content: message, snapshot_id: snapshotRow.id },
      { user_id: userId, thread_id: threadId, role: "coach", content: result.reply, snapshot_id: snapshotRow.id },
    ]);
    if (insertErr) throw insertErr;

    if (result.injuryLogged) {
      const { error: injuryErr } = await supabase.from("injury").insert({
        user_id: userId,
        location: result.injuryLogged.location,
        severity: result.injuryLogged.severity,
        since: todayLocalDate(Deno.env.get("ATHLETE_TZ") ?? "Pacific/Auckland"),
      });
      if (injuryErr) throw injuryErr;
    }

    return jsonResponse({ reply: result.reply, thread_id: threadId, injury_logged: result.injuryLogged });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

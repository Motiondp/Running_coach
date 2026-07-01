// Gemini adapter — the default/only implemented COACH_PROVIDER (see ../index.ts).
// To add another provider later (e.g. Claude), write a sibling file exporting the
// same shape (opts in, CoachReply out) and branch on Deno.env.get("COACH_PROVIDER")
// in index.ts. Nothing else in this function needs to change.
import { GoogleGenAI, Type } from "npm:@google/genai@^1.0.0";

export interface CoachReply {
  reply: string;
  /** Non-null only when the athlete's message described a new injury. */
  injuryLogged: { location: string; severity: number } | null;
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

// Scalars only (no nullable nested object) — keeps the schema unambiguous for the
// model's structured-output mode. injuryLocation "" + severity 0 means "no injury".
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING, description: "The coach's reply to the athlete, plain text." },
    injuryLocation: {
      type: Type.STRING,
      description:
        'Lowercase, underscore-separated body location if the athlete just described a NEW injury or pain (e.g. "left_knee"). Empty string if no injury was mentioned this turn.',
    },
    injurySeverity: {
      type: Type.INTEGER,
      description: "0 if injuryLocation is empty, else the athlete's reported severity 0-10.",
    },
  },
  required: ["reply", "injuryLocation", "injurySeverity"],
};

export async function callGemini(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: ChatTurn[];
  userMessage: string;
}): Promise<CoachReply> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const contents = [
    ...opts.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user" as const, parts: [{ text: opts.userMessage }] },
  ];

  const response = await ai.models.generateContent({
    model: opts.model,
    contents,
    config: {
      systemInstruction: opts.systemPrompt,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");

  const parsed = JSON.parse(text) as { reply: string; injuryLocation: string; injurySeverity: number };
  return {
    reply: parsed.reply,
    injuryLogged: parsed.injuryLocation
      ? { location: parsed.injuryLocation, severity: parsed.injurySeverity }
      : null,
  };
}

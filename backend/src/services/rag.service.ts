import { supabase } from "../db/supabase";

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "will", "with", "have",
  "this", "that", "from", "your", "their", "about", "been", "does",
  "just", "like", "more", "also", "than", "into", "then", "some",
  "would", "could", "should", "there", "were", "they", "them",
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

export async function searchChunks(
  query: string,
  businessId: string
): Promise<string[]> {
  // Primary: PostgreSQL full-text search
  const { data: ftsData, error: ftsError } = await supabase
    .from("chunks")
    .select("content")
    .eq("business_id", businessId)
    .textSearch("search_vector", query, { type: "websearch", config: "english" })
    .limit(5);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return ftsData.map((r) => r.content);
  }

  // Fallback: ILIKE on the most meaningful individual keywords
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  // Try each keyword, take the first that returns results
  for (const word of keywords.slice(0, 3)) {
    const { data, error } = await supabase
      .from("chunks")
      .select("content")
      .eq("business_id", businessId)
      .ilike("content", `%${word}%`)
      .limit(5);

    if (!error && data && data.length > 0) {
      return data.map((r) => r.content);
    }
  }

  return [];
}

const PERSONALITY_PROMPTS: Record<string, string> = {
  professional: `PERSONALITY — PROFESSIONAL:
- Tone: formal, composed, and precise. No slang, no exclamation marks.
- Structure: lead with the solution, then supporting steps if needed.
- Never start with "Hey", "Sure!", "Of course!", "Great question!" or any filler.
- Example opener: "To resolve this, please follow these steps:" or "Based on your account details, here is what applies:"
- Close with a single, formal offer: "Please let me know if you require further assistance."`,

  friendly: `PERSONALITY — FRIENDLY:
- Tone: warm, upbeat, and human. Write like a helpful friend, not a robot.
- Use casual language, contractions ("you're", "we've", "let's"), and occasional light humour.
- Show genuine empathy first, then help. Example opener: "Oh no, that sounds super frustrating — let's sort it out!"
- Use short sentences. Avoid jargon. If you must list steps, keep them brief.
- Close with warmth: "Hope that helps! 😊 Ping me if anything else comes up."`,

  technical: `PERSONALITY — TECHNICAL:
- Tone: precise and direct. Speak to someone who understands software and systems.
- Lead with the root cause or mechanism, then the fix.
- Use technical terminology freely: latency, TTL, cache invalidation, MIME type, API rate limit, etc.
- Include specific values when available (e.g. "minimum 5 Mbps", "TLS 1.2+", "AES-256").
- No filler phrases. No "I hope this helps." Skip pleasantries entirely.
- If multiple causes are possible, enumerate them with their likelihood.`,
};

export function buildSystemPrompt(chunks: string[], config: any): string {
  const botName = config?.bot_name ?? "SupportBot";
  const personality = (config?.personality ?? "professional") as string;

  const personalityBlock =
    PERSONALITY_PROMPTS[personality] ?? PERSONALITY_PROMPTS.professional;

  const contextBlock =
    chunks.length > 0
      ? `\n\nKNOWLEDGE BASE (answer using ONLY this — do not invent facts):\n${chunks
          .map((c, i) => `[${i + 1}] ${c.trim()}`)
          .join("\n\n")}`
      : "\n\nNo knowledge base context matched this query.";

  return `You are ${botName}, a customer support assistant.

${personalityBlock}

ABSOLUTE RULES:
- Answer ONLY from the knowledge base context below.
- If the answer is clearly present in the context, state it directly and confidently.
- If the answer is NOT in the context, say exactly: "I don't have that information on hand. I can escalate this to a human agent who can help — would you like me to do that?"
- Never invent information not in the context.${contextBlock}`;
}

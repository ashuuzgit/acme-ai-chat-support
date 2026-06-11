import { supabase } from "../db/supabase";

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "what", "when", "where", "which", "who", "will", "with", "have",
  "this", "that", "from", "your", "their", "about", "been", "does",
  "just", "like", "more", "also", "than", "into", "then", "some",
  "would", "could", "should", "there", "were", "they", "them",
  "help", "know", "tell", "need", "want", "please", "thanks",
]);

// ─── Synonym map ──────────────────────────────────────────────────────────────
// Maps a user word → additional search terms to try alongside it.

const SYNONYMS: Record<string, string[]> = {
  cost:         ["price", "pricing", "rate", "fee", "charge", "plan"],
  price:        ["cost", "pricing", "rate", "fee", "charge", "plan"],
  pricing:      ["cost", "price", "rate", "fee", "plan"],
  cheap:        ["price", "cost", "discount", "affordable", "plan"],
  expensive:    ["price", "cost", "pricing", "plan"],
  pay:          ["payment", "billing", "charge", "invoice"],
  payment:      ["pay", "billing", "charge", "invoice", "card"],
  billing:      ["invoice", "payment", "charge", "subscription"],
  invoice:      ["billing", "payment", "receipt"],
  refund:       ["money back", "reimbursement", "cancel", "return"],
  cancel:       ["cancellation", "stop", "end", "terminate", "refund"],
  cancellation: ["cancel", "stop", "end", "refund"],
  upgrade:      ["plan", "tier", "premium", "pro"],
  downgrade:    ["plan", "tier", "change", "switch"],
  plan:         ["tier", "subscription", "pricing", "upgrade"],
  discount:     ["coupon", "promo", "deal", "offer", "nonprofit", "startup"],
  free:         ["trial", "plan", "discount"],
  trial:        ["free", "demo", "test"],
  broken:       ["issue", "problem", "error", "bug", "not working", "outage"],
  error:        ["issue", "problem", "bug", "broken", "failed"],
  issue:        ["problem", "error", "bug", "broken", "help"],
  problem:      ["issue", "error", "bug", "broken", "help"],
  working:      ["broken", "issue", "error", "outage", "bug"],
  stopped:      ["broken", "issue", "error", "outage", "working"],
  outage:       ["down", "issue", "problem", "broken", "service"],
  slow:         ["performance", "latency", "speed", "outage"],
  login:        ["sign in", "access", "password", "account"],
  password:     ["login", "reset", "forgot", "access", "account"],
  account:      ["login", "user", "profile", "settings"],
  access:       ["login", "permission", "account", "password"],
  integrate:    ["integration", "connect", "api", "plugin", "zapier", "slack"],
  integration:  ["connect", "api", "plugin", "zapier", "slack", "webhook"],
  connect:      ["integration", "api", "link", "sync"],
  setup:        ["install", "configure", "start", "begin", "guide"],
  install:      ["setup", "configure", "start", "guide"],
  data:         ["export", "import", "backup", "storage"],
  export:       ["data", "download", "backup"],
  security:     ["safe", "encrypt", "privacy", "pci", "gdpr"],
  safe:         ["security", "encrypt", "privacy"],
  support:      ["help", "contact", "agent", "human"],
  contact:      ["support", "email", "human", "agent", "reach"],
  human:        ["agent", "support", "person", "contact", "escalate"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
}

/** Expand keywords with synonyms — returns deduplicated flat list */
function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords);
  for (const kw of keywords) {
    for (const syn of SYNONYMS[kw] ?? []) {
      // Only add single-word synonyms to the set (multi-word handled in ILIKE)
      if (!syn.includes(" ")) expanded.add(syn);
    }
  }
  return Array.from(expanded);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchChunks(
  query: string,
  businessId: string
): Promise<string[]> {

  // ── Stage 1: FTS websearch (strict, ranked) ──────────────────────────────
  const { data: ftsData, error: ftsError } = await supabase
    .from("chunks")
    .select("content")
    .eq("business_id", businessId)
    .textSearch("search_vector", query, { type: "websearch", config: "english" })
    .limit(8);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return ftsData.map((r) => r.content);
  }

  // ── Stage 2: FTS plain (permissive OR across all words) ──────────────────
  // plainto_tsquery ORs every word — catches cases where websearch is too strict
  const plainQuery = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  if (plainQuery) {
    const { data: plainData, error: plainError } = await supabase
      .from("chunks")
      .select("content")
      .eq("business_id", businessId)
      .textSearch("search_vector", plainQuery, { type: "plain", config: "english" })
      .limit(8);

    if (!plainError && plainData && plainData.length > 0) {
      return plainData.map((r) => r.content);
    }
  }

  // ── Stage 3: ILIKE across all expanded keywords simultaneously ───────────
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const allTerms = expandKeywords(keywords);

  // Build OR filter across all terms at once — much better than sequential
  let ilikeQuery = supabase
    .from("chunks")
    .select("content")
    .eq("business_id", businessId);

  // Supabase JS v2: chain .or() with ilike conditions
  const orConditions = allTerms
    .slice(0, 8)
    .map((w) => `content.ilike.%${w}%`)
    .join(",");

  const { data: ilikeData, error: ilikeError } = await ilikeQuery
    .or(orConditions)
    .limit(8);

  if (!ilikeError && ilikeData && ilikeData.length > 0) {
    return ilikeData.map((r) => r.content);
  }

  return [];
}

// ─── Personality prompts ──────────────────────────────────────────────────────

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

// ─── System prompt builder ────────────────────────────────────────────────────

export function buildSystemPrompt(chunks: string[], config: any): string {
  const botName = config?.bot_name ?? "SupportBot";
  const personality = (config?.personality ?? "professional") as string;

  const personalityBlock =
    PERSONALITY_PROMPTS[personality] ?? PERSONALITY_PROMPTS.professional;

  const hasContext = chunks.length > 0;

  const contextBlock = hasContext
    ? `\n\nKNOWLEDGE BASE (answer using ONLY this — do not invent facts):\n${chunks
        .map((c, i) => `[${i + 1}] ${c.trim()}`)
        .join("\n\n")}`
    : "\n\nNo knowledge base context matched this query.";

  const noContextRule = hasContext
    ? `- If the answer is clearly present in the context, state it directly and confidently.
- If the answer is NOT in the context, say: "I don't have that information on hand. I can escalate this to a human agent who can help — would you like me to do that?"`
    : `- No knowledge base context was found for this query.
- If the question is a common, general how-to (e.g. resetting a password, browser steps, general software usage), you may answer from your general knowledge and prefix your answer with: "I don't have a specific article for this, but generally: "
- If the question is business-specific (account details, order status, charges, specific policies), say: "I don't have that information on hand. I can escalate this to a human agent who can help — would you like me to do that?"
- Never invent specific business data such as prices, order numbers, account details, or policies.`;

  return `You are ${botName}, a customer support assistant.

${personalityBlock}

ABSOLUTE RULES:
- Answer ONLY from the knowledge base context below when context is available.
${noContextRule}
- Never invent information not in the context.

ESCALATION CONFIRMATION RULE (highest priority — overrides all other rules):
- If the user's message is a confirmation of escalation — e.g. "yes", "yes please", "do that", "please escalate", "escalate", "human agent", "talk to human", "speak to human", "connect me", "I want a human", or any similar phrase — respond ONLY with an acknowledgement that their request has been escalated and a human agent will follow up shortly. Do NOT ask again whether they want to escalate. Do NOT say you don't have the information. Example: "Got it — I've escalated your request and a human agent will follow up with you shortly."${contextBlock}`;
}

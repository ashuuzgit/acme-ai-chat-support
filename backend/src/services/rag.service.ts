import { supabase } from "../db/supabase";

/**
 * Retrieves the top-5 most relevant chunks for a query using PostgreSQL
 * full-text search (tsvector / websearch_to_tsquery).  This replaces the
 * previous pgvector cosine-similarity approach; no embedding API is required.
 *
 * The `search_vector` column is a GENERATED ALWAYS AS tsvector column on the
 * chunks table — Postgres maintains it automatically on every insert/update.
 */
export async function searchChunks(
  query: string,
  businessId: string
): Promise<string[]> {
  // websearch syntax supports quoted phrases and - exclusions naturally
  const { data, error } = await supabase
    .from("chunks")
    .select("content")
    .eq("business_id", businessId)
    .textSearch("search_vector", query, {
      type: "websearch",
      config: "english",
    })
    .limit(5);

  if (error) {
    // Fall back to simple ILIKE if FTS fails (e.g. very short queries)
    const { data: fallback, error: fallbackError } = await supabase
      .from("chunks")
      .select("content")
      .eq("business_id", businessId)
      .ilike("content", `%${query}%`)
      .limit(5);

    if (fallbackError) throw fallbackError;
    return (fallback ?? []).map((r) => r.content);
  }

  return (data ?? []).map((r) => r.content);
}

export function buildSystemPrompt(chunks: string[], config: any): string {
  const botName = config?.bot_name ?? "SupportBot";
  const personality = config?.personality ?? "professional";

  const contextBlock =
    chunks.length > 0
      ? `\n\nRelevant knowledge base context (use this to answer):\n${chunks
          .map((c, i) => `[${i + 1}] ${c.trim()}`)
          .join("\n\n")}`
      : "\n\nNo specific knowledge base context is available for this query.";

  return `You are ${botName}, a ${personality} customer support assistant.
Answer the customer's question accurately and helpfully using the context provided.
If the answer is not in the context, say you don't have that information and offer to escalate to a human agent.
Keep responses concise, clear, and friendly.${contextBlock}`;
}

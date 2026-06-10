import { supabase } from "../db/supabase";
import { generateEmbedding } from "./embedding.service";

export async function searchChunks(
  query: string,
  businessId: string
): Promise<string[]> {
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_business_id: businessId,
    match_count: 5,
  });

  if (error) throw error;

  return (data as { content: string }[]).map((row) => row.content);
}

export function buildSystemPrompt(chunks: string[], config: any): string {
  const botName = config?.bot_name ?? "SupportBot";
  const personality = config?.personality ?? "professional";

  const contextBlock =
    chunks.length > 0
      ? `\n\nKnowledge base context:\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}`
      : "";

  return `You are ${botName}, a ${personality} customer support assistant.
Answer the customer's question accurately and helpfully using the context provided.
If the answer is not in the context, say you don't have that information and offer to escalate.
Keep responses concise and friendly.${contextBlock}`;
}

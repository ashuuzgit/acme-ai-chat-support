import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { supabase } from "../db/supabase";
import { searchChunks, buildSystemPrompt } from "../services/rag.service";
import { detectEscalation } from "../services/escalation.service";
import { createTicket } from "../services/ticket.service";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/chat  (public)
router.post("/", async (req: Request, res: Response) => {
  const {
    message,
    conversationId: existingConversationId,
    businessId,
    customerName,
    customerEmail,
  } = req.body;

  if (!message || !businessId) {
    res.status(400).json({ error: "message and businessId are required" });
    return;
  }

  // Resolve or create conversation
  let conversationId = existingConversationId as string | undefined;

  if (!conversationId) {
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: "active",
      })
      .select("id")
      .single();

    if (convError) throw convError;
    conversationId = conversation.id;
  }

  // Fetch ai_config for this business
  const { data: config } = await supabase
    .from("ai_configs")
    .select("bot_name, welcome_message, personality, escalation_rules")
    .eq("business_id", businessId)
    .single();

  // RAG: fetch relevant chunks
  const chunks = await searchChunks(message, businessId).catch(() => [] as string[]);
  const systemPrompt = buildSystemPrompt(chunks, config);

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const startTime = Date.now();
  let fullResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
    res.end();
    return;
  }

  const responseTimeMs = Date.now() - startTime;

  // Persist messages
  await Promise.all([
    supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      event_type: "message",
    }),
    supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: fullResponse,
      event_type: "message",
      response_time_ms: responseTimeMs,
    }),
  ]);

  // Escalation check
  const escalationRules: string[] = config?.escalation_rules ?? [];
  const priority = detectEscalation(message, escalationRules);

  if (priority) {
    await createTicket({
      businessId,
      conversationId: conversationId!,
      customerName,
      customerEmail,
      query: message,
      priority,
    }).catch((err) => console.error("Failed to create ticket:", err));
  }

  res.write(
    `data: ${JSON.stringify({ done: true, conversationId: conversationId! })}\n\n`
  );
  res.end();
});

// GET /api/chat/widget-config/:businessId  (public)
router.get("/widget-config/:businessId", async (req: Request, res: Response) => {
  const { businessId } = req.params;

  const { data: config, error } = await supabase
    .from("ai_configs")
    .select("bot_name, welcome_message, personality")
    .eq("business_id", businessId)
    .single();

  if (error || !config) {
    res.status(404).json({ error: "Config not found for this business" });
    return;
  }

  res.json(config);
});

export default router;

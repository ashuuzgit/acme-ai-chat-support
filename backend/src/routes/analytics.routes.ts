import { Router, Request, Response } from "express";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();
router.use(verifyToken);

// GET /api/analytics/overview
router.get("/overview", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const [
    { count: totalConvos },
    { data: messages },
    { count: totalTickets },
    { count: escalatedTickets },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("messages")
      .select("response_time_ms, conversation_id, created_at")
      .eq("role", "assistant")
      .not("response_time_ms", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["resolved", "closed"]),
  ]);

  const avgResponseMs =
    messages && messages.length > 0
      ? messages.reduce((sum: number, m: any) => sum + (m.response_time_ms ?? 0), 0) /
        messages.length
      : 0;

  // Conversations over last 7 days
  const days: { date: string; conversations: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const { count } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    days.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      conversations: count ?? 0,
    });
  }

  res.json({
    total_conversations: totalConvos ?? 0,
    avg_response_ms: Math.round(avgResponseMs),
    resolution_rate:
      totalTickets && totalTickets > 0
        ? Math.round(((escalatedTickets ?? 0) / totalTickets) * 100)
        : 0,
    escalation_rate:
      totalConvos && totalConvos > 0
        ? Math.round(((totalTickets ?? 0) / totalConvos) * 100)
        : 0,
    daily_conversations: days,
  });
});

// GET /api/analytics/dashboard  — lightweight stat cards for the main dashboard
router.get("/dashboard", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const [
    { count: totalConversations },
    { count: openTickets },
    { count: resolvedTickets },
    { count: escalatedTickets },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "open"),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["resolved", "closed"]),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("priority", ["urgent", "high"]),
    supabase
      .from("messages")
      .select("response_time_ms")
      .eq("role", "assistant")
      .not("response_time_ms", "is", null)
      .limit(200),
  ]);

  const totalTickets = (openTickets ?? 0) + (resolvedTickets ?? 0);
  const resolutionRate =
    totalTickets > 0
      ? Math.round(((resolvedTickets ?? 0) / totalTickets) * 100)
      : 0;

  const avgResponseMs =
    messages && messages.length > 0
      ? Math.round(
          messages.reduce((s: number, m: any) => s + (m.response_time_ms ?? 0), 0) /
            messages.length
        )
      : 0;

  res.json({
    total_conversations: totalConversations ?? 0,
    open_tickets: openTickets ?? 0,
    resolved_tickets: resolvedTickets ?? 0,
    escalated_tickets: escalatedTickets ?? 0,
    resolution_rate: resolutionRate,
    avg_response_ms: avgResponseMs,
  });
});

// GET /api/analytics/knowledge
router.get("/knowledge", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  // Most referenced documents = documents with the most chunks (proxy for usage)
  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, file_type, status")
    .eq("business_id", businessId)
    .eq("status", "ready");

  const docStats = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { count } = await supabase
        .from("chunks")
        .select("*", { count: "exact", head: true })
        .eq("document_id", doc.id);
      return { ...doc, chunk_count: count ?? 0 };
    })
  );

  docStats.sort((a, b) => b.chunk_count - a.chunk_count);

  // Unanswered questions = user messages that have no following assistant message
  // Approximation: last user message in conversations with only 1 message
  const { data: unanswered } = await supabase
    .from("messages")
    .select("id, content, created_at, conversation_id")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(20);

  // Filter to messages that appear to not have a reply (simplified heuristic)
  const unreplied = (unanswered ?? []).slice(0, 10);

  res.json({
    top_documents: docStats.slice(0, 10),
    unanswered_questions: unreplied,
  });
});

export default router;

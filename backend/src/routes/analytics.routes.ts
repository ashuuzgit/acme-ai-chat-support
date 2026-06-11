import { Router, Request, Response } from "express";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();
router.use(verifyToken);

// ── Simple in-memory cache (5-minute TTL per businessId per route) ────────────
type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// GET /api/analytics/overview
router.get("/overview", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const cacheKey = `overview:${businessId}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }

  const [
    { count: totalConvos },
    { data: messages },
    { count: totalTickets },
    { count: resolvedTickets },
  ] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    supabase.from("messages").select("response_time_ms").eq("role", "assistant").not("response_time_ms", "is", null).limit(500),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["resolved", "closed"]),
  ]);

  const avgResponseMs =
    messages && messages.length > 0
      ? messages.reduce((sum: number, m: any) => sum + (m.response_time_ms ?? 0), 0) / messages.length
      : 0;

  // 7-day conversation counts — run all in parallel
  const dayBoundaries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });

  const dayCounts = await Promise.all(
    dayBoundaries.map(({ start, end }) =>
      supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", start)
        .lte("created_at", end)
        .then(({ count }) => count ?? 0)
    )
  );

  const daily_conversations = dayBoundaries.map((d, i) => ({
    date: d.label,
    conversations: dayCounts[i],
  }));

  const result = {
    total_conversations: totalConvos ?? 0,
    avg_response_ms: Math.round(avgResponseMs),
    resolution_rate:
      totalTickets && totalTickets > 0
        ? Math.round(((resolvedTickets ?? 0) / totalTickets) * 100)
        : 0,
    escalation_rate:
      totalConvos && totalConvos > 0
        ? Math.round(((totalTickets ?? 0) / totalConvos) * 100)
        : 0,
    daily_conversations,
  };

  cacheSet(cacheKey, result);
  res.json(result);
});

// GET /api/analytics/dashboard  — lightweight stat cards for the main dashboard
router.get("/dashboard", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const cacheKey = `dashboard:${businessId}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }

  const dayBoundaries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);
    return { ymd: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), start: start.toISOString(), end: end.toISOString() };
  });

  const [
    { count: totalConversations },
    { count: openTickets },
    { count: resolvedTickets },
    { count: escalatedTickets },
    { data: messages },
    { data: recentTickets },
  ] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("business_id", businessId),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "open"),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["resolved", "closed"]),
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("business_id", businessId).in("priority", ["urgent", "high"]),
    supabase.from("messages").select("response_time_ms").eq("role", "assistant").not("response_time_ms", "is", null).limit(200),
    supabase.from("tickets").select("status, priority, created_at").eq("business_id", businessId)
      .gte("created_at", dayBoundaries[0].start).lte("created_at", dayBoundaries[6].end),
  ]);

  const totalTickets = (openTickets ?? 0) + (resolvedTickets ?? 0);
  const resolutionRate = totalTickets > 0 ? Math.round(((resolvedTickets ?? 0) / totalTickets) * 100) : 0;
  const avgResponseMs = messages && messages.length > 0
    ? Math.round(messages.reduce((s: number, m: any) => s + (m.response_time_ms ?? 0), 0) / messages.length)
    : 0;

  const spark_open: number[]      = [];
  const spark_escalated: number[] = [];
  const spark_resolved: number[]  = [];
  const spark_rate: number[]      = [];

  for (const day of dayBoundaries) {
    const dayTickets = (recentTickets ?? []).filter((t: any) => t.created_at >= day.start && t.created_at <= day.end);
    const open_n  = dayTickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;
    const esc_n   = dayTickets.filter((t: any) => t.priority === "urgent" || t.priority === "high").length;
    const res_n   = dayTickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length;
    const total_n = dayTickets.length;
    spark_open.push(open_n);
    spark_escalated.push(esc_n);
    spark_resolved.push(res_n);
    spark_rate.push(total_n > 0 ? Math.round((res_n / total_n) * 100) : 0);
  }

  const result = {
    total_conversations: totalConversations ?? 0,
    open_tickets: openTickets ?? 0,
    resolved_tickets: resolvedTickets ?? 0,
    escalated_tickets: escalatedTickets ?? 0,
    resolution_rate: resolutionRate,
    avg_response_ms: avgResponseMs,
    spark_open,
    spark_escalated,
    spark_resolved,
    spark_rate,
  };

  cacheSet(cacheKey, result);
  res.json(result);
});

// GET /api/analytics/knowledge
router.get("/knowledge", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const cacheKey = `knowledge:${businessId}`;
  const cached = cacheGet(cacheKey);
  if (cached) { res.json(cached); return; }

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, file_type, status")
    .eq("business_id", businessId)
    .eq("status", "ready");

  // Single query for all chunk counts — replaces N+1 per-document queries
  const docIds = (documents ?? []).map((d) => d.id);
  const { data: allChunks } = docIds.length > 0
    ? await supabase.from("chunks").select("document_id").in("document_id", docIds)
    : { data: [] };

  const countMap = new Map<string, number>();
  for (const chunk of allChunks ?? []) {
    countMap.set(chunk.document_id, (countMap.get(chunk.document_id) ?? 0) + 1);
  }

  const docStats = (documents ?? [])
    .map((doc) => ({ ...doc, chunk_count: countMap.get(doc.id) ?? 0 }))
    .sort((a, b) => b.chunk_count - a.chunk_count);

  // Unanswered questions heuristic
  const { data: unanswered } = await supabase
    .from("messages")
    .select("id, content, created_at, conversation_id")
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(20);

  const result = {
    top_documents: docStats.slice(0, 10),
    unanswered_questions: (unanswered ?? []).slice(0, 10),
  };

  cacheSet(cacheKey, result);
  res.json(result);
});

export default router;

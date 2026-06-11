import { Router, Request, Response } from "express";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();
router.use(verifyToken);

// GET /api/conversations  — list for business, most recent first
router.get("/", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      customer_name,
      customer_email,
      status,
      created_at,
      messages (
        content,
        role,
        created_at
      )
    `)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100)
    .limit(1, { referencedTable: "messages" });

  if (error) throw error;

  // Attach last message preview to each conversation
  const enriched = (data ?? []).map((c: any) => {
    const msgs: any[] = c.messages ?? [];
    const last = msgs.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return {
      id: c.id,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      status: c.status,
      created_at: c.created_at,
      last_message: last?.content ?? null,
      last_message_role: last?.role ?? null,
      last_message_at: last?.created_at ?? c.created_at,
    };
  });

  res.json(enriched);
});

// GET /api/conversations/search?q=
router.get("/search", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  // Strip characters that could break Supabase .or() filter syntax
  const q = String(req.query.q ?? "").trim().replace(/[%,()]/g, "").slice(0, 100);

  if (!q) {
    req.url = "/";
    res.redirect(307, "/api/conversations");
    return;
  }

  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      customer_name,
      customer_email,
      status,
      created_at,
      messages ( content, role, created_at )
    `)
    .eq("business_id", businessId)
    .or(`customer_name.ilike.%${q}%,customer_email.ilike.%${q}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const enriched = (data ?? []).map((c: any) => {
    const msgs: any[] = c.messages ?? [];
    const last = msgs.sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return {
      id: c.id,
      customer_name: c.customer_name,
      customer_email: c.customer_email,
      status: c.status,
      created_at: c.created_at,
      last_message: last?.content ?? null,
      last_message_role: last?.role ?? null,
      last_message_at: last?.created_at ?? c.created_at,
    };
  });

  res.json(enriched);
});

// GET /api/conversations/:id/messages
router.get("/:id/messages", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  // Verify ownership
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .select("id, customer_name, customer_email, status, created_at")
    .eq("id", req.params.id)
    .eq("business_id", businessId)
    .single();

  if (convErr || !conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, role, content, event_type, response_time_ms, created_at")
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: true });

  if (msgErr) throw msgErr;

  res.json({ conversation: conv, messages: messages ?? [] });
});

export default router;

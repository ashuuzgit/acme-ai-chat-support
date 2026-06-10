import { Router, Request, Response } from "express";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();
router.use(verifyToken);

// GET /api/tickets  — supports ?status=&priority= filters
router.get("/", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const { status, priority } = req.query;

  let query = supabase
    .from("tickets")
    .select("id, customer_name, customer_email, query, priority, status, conversation_id, created_at, updated_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status as string);
  if (priority && priority !== "all") query = query.eq("priority", priority as string);

  const { data, error } = await query;
  if (error) throw error;

  res.json(data);
});

// GET /api/tickets/:id
router.get("/:id", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", req.params.id)
    .eq("business_id", businessId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(data);
});

// PATCH /api/tickets/:id  — update status
router.patch("/:id", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const { status } = req.body;

  const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(data);
});

export default router;

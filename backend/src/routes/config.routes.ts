import { Router, Request, Response } from "express";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();
router.use(verifyToken);

// GET /api/config
router.get("/", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const { data, error } = await supabase
    .from("ai_configs")
    .select("id, bot_name, welcome_message, personality, escalation_rules")
    .eq("business_id", businessId)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Config not found" });
    return;
  }

  res.json(data);
});

// PUT /api/config
router.put("/", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const { bot_name, welcome_message, personality, escalation_rules } = req.body;

  const { data, error } = await supabase
    .from("ai_configs")
    .update({
      bot_name,
      welcome_message,
      personality,
      escalation_rules,
    })
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) throw error;

  res.json(data);
});

export default router;

import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

function signToken(userId: string, businessId: string, role: string) {
  return jwt.sign(
    { userId, businessId, role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );
}

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  const { businessName, email, password } = req.body;

  if (!businessName || !email || !password) {
    res.status(400).json({ error: "businessName, email and password are required" });
    return;
  }

  // Create business
  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .insert({ name: businessName, email })
    .select()
    .single();

  if (bizError) {
    if (bizError.code === "23505") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw bizError;
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 12);

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ business_id: business.id, email, password_hash: passwordHash, role: "admin" })
    .select("id, business_id, email, role, created_at")
    .single();

  if (userError) throw userError;

  // Auto-create default ai_config
  const { error: configError } = await supabase
    .from("ai_configs")
    .insert({ business_id: business.id });

  if (configError) throw configError;

  const token = signToken(user.id, business.id, user.role);

  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, business_id, email, role, password_hash, created_at")
    .eq("email", email)
    .single();

  if (error || !user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken(user.id, user.business_id, user.role);

  const { password_hash: _omit, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  // Stub: email sending not yet implemented
  res.json({ message: "If that email exists, a reset link has been sent" });
});

// GET /api/auth/me
router.get("/me", verifyToken, async (req: Request, res: Response) => {
  const { userId, businessId } = req.user!;

  const [{ data: user, error: userError }, { data: business, error: bizError }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, business_id, email, role, created_at")
        .eq("id", userId)
        .single(),
      supabase
        .from("businesses")
        .select("id, name, email, created_at")
        .eq("id", businessId)
        .single(),
    ]);

  if (userError || !user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (bizError || !business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json({ user, business });
});

export default router;

import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";

dotenv.config();

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "GROQ_API_KEY", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

import authRoutes from "./routes/auth.routes";
import documentRoutes from "./routes/documents.routes";
import chatRoutes from "./routes/chat.routes";
import configRoutes from "./routes/config.routes";
import ticketsRoutes from "./routes/tickets.routes";
import conversationsRoutes from "./routes/conversations.routes";
import analyticsRoutes from "./routes/analytics.routes";
import { errorHandler } from "./middleware/error.middleware";
import { supabase } from "./db/supabase";

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "documents");
  if (!exists) {
    const { error } = await supabase.storage.createBucket("documents", { public: false });
    if (error) console.error("Could not create storage bucket:", error.message);
    else console.log("Storage bucket 'documents' created");
  }
}

const app = express();
const PORT = process.env.PORT ?? 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Auth: 10 attempts per 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// Chat: 30 messages per minute per IP (widget abuse prevention)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages, please slow down" },
});

// Analytics / dashboard: 60 req per minute per IP
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth",          authLimiter,      authRoutes);
app.use("/api/documents",     documentRoutes);
app.use("/api/chat",          chatLimiter,      chatRoutes);
app.use("/api/config",        configRoutes);
app.use("/api/tickets",       ticketsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/analytics",     analyticsLimiter, analyticsRoutes);

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await ensureBucket();
});

export default app;

import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

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
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/config", configRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await ensureBucket();
});

export default app;

import path from "path";
import os from "os";
import fs from "fs/promises";
import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../db/supabase";
import { verifyToken } from "../middleware/auth.middleware";
import { processDocument } from "../services/document.service";

const router = Router();
router.use(verifyToken);

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, TXT, and MD files are allowed"));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// POST /api/documents/upload
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { businessId } = req.user!;
  const fileType = ALLOWED_TYPES[file.mimetype];
  const storagePath = `${businessId}/${uuidv4()}-${file.originalname}`;

  // Upload to Supabase Storage
  const fileBuffer = await fs.readFile(file.path);
  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBuffer, { contentType: file.mimetype });

  if (storageError) throw storageError;

  // Insert document record
  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      business_id: businessId,
      name: file.originalname,
      file_type: fileType,
      storage_path: storagePath,
      status: "processing",
    })
    .select()
    .single();

  if (docError) {
    await supabase.storage.from("documents").remove([storagePath]);
    throw docError;
  }

  // Process in background — intentionally not awaited
  processDocument(document.id, businessId, file.path, fileType).finally(() =>
    fs.unlink(file.path).catch(() => {})
  );

  res.status(201).json(document);
});

// GET /api/documents
router.get("/", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, file_type, storage_path, status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  res.json(data);
});

// DELETE /api/documents/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const { businessId } = req.user!;
  const { id } = req.params;

  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  // Delete from storage (chunks cascade via DB foreign key)
  await supabase.storage.from("documents").remove([document.storage_path]);

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (deleteError) throw deleteError;

  res.json({ message: "Document deleted" });
});

// POST /api/documents/reindex
router.post("/reindex", async (req: Request, res: Response) => {
  const { businessId } = req.user!;

  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, storage_path, file_type")
    .eq("business_id", businessId);

  if (error) throw error;

  // Fire and forget — download each file to tmp, then reprocess
  (async () => {
    for (const doc of documents ?? []) {
      try {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("documents")
          .download(doc.storage_path);

        if (dlError || !fileData) continue;

        const tmpPath = path.join(os.tmpdir(), `${uuidv4()}-reindex`);
        await fs.writeFile(tmpPath, Buffer.from(await fileData.arrayBuffer()));

        // Remove old chunks before reprocessing
        await supabase.from("chunks").delete().eq("document_id", doc.id);

        await processDocument(doc.id, businessId, tmpPath, doc.file_type);
        await fs.unlink(tmpPath).catch(() => {});
      } catch (err) {
        console.error(`Reindex failed for document ${doc.id}:`, err);
      }
    }
  })();

  res.json({ message: "Reindexing started" });
});

export default router;

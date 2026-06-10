import fs from "fs/promises";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require("pdf-parse");
import mammoth from "mammoth";
import { supabase } from "../db/supabase";
import { generateEmbedding } from "./embedding.service";

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 50;

export async function parseDocument(
  filePath: string,
  fileType: string
): Promise<string> {
  const lower = fileType.toLowerCase();

  if (lower === "pdf") {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (lower === "docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }

  if (lower === "txt" || lower === "md") {
    return fs.readFile(filePath, "utf-8");
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    chunks.push(text.slice(start, end));
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter((c) => c.trim().length > 0);
}

export async function processDocument(
  documentId: string,
  businessId: string,
  filePath: string,
  fileType: string
): Promise<void> {
  try {
    const text = await parseDocument(filePath, fileType);
    const chunks = chunkText(text);

    for (const content of chunks) {
      const embedding = await generateEmbedding(content);

      const { error } = await supabase.from("chunks").insert({
        document_id: documentId,
        business_id: businessId,
        content,
        embedding: JSON.stringify(embedding),
      });

      if (error) throw error;
    }

    await supabase
      .from("documents")
      .update({ status: "ready" })
      .eq("id", documentId);
  } catch (err) {
    console.error(`Failed to process document ${documentId}:`, err);

    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);
  }
}

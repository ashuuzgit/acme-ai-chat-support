/**
 * Embedding generation replaced by PostgreSQL full-text search (tsvector).
 * This file is retained so import sites compile; it is no longer called
 * during document processing.  The DB generates `search_vector` automatically
 * via a GENERATED ALWAYS AS column, so no embedding API is required.
 */
export async function generateEmbedding(_text: string): Promise<number[]> {
  return [];
}

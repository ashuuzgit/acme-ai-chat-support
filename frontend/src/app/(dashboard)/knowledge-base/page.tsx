"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  name: string;
  file_type: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

interface PendingFile {
  file: File;
  preview: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCEPTED: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  md: "MD",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Document["status"] }) {
  if (status === "ready") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
        Ready
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 gap-1.5">
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Processing
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
      Failed
    </Badge>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground">No documents yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload a PDF, DOCX, TXT, or MD file to build your knowledge base
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reindexing, setReindexing] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    try {
      const { data } = await api.get<Document[]>("/api/documents");
      setDocuments(data);
    } catch {
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ── Dropzone ───────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setPendingFile({ file: accepted[0], preview: accepted[0].name });
      setUploadProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", pendingFile.file);

    try {
      await api.post("/api/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress(e) {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success("Document uploaded — processing started");
      setPendingFile(null);
      setUploadProgress(0);
      await fetchDocuments();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/documents/${id}`);
      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Failed to delete document");
    }
  }

  // ── Reindex ────────────────────────────────────────────────────────────────

  async function handleReindex() {
    setReindexing(true);
    try {
      await api.post("/api/documents/reindex");
      toast.success("Reindexing started — documents will update shortly");
      await fetchDocuments();
    } catch {
      toast.error("Reindex failed");
    } finally {
      setReindexing(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents to power your AI assistant&apos;s answers
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleReindex}
          disabled={reindexing || documents.length === 0}
          className="gap-2"
        >
          {reindexing ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
          {reindexing ? "Reindexing…" : "Re-index all"}
        </Button>
      </div>

      {/* Upload zone */}
      <Card className="border-dashed">
        <CardContent className="p-6 space-y-4">
          <div
            {...getRootProps()}
            className={`rounded-lg border-2 border-dashed transition-colors cursor-pointer px-8 py-10 text-center
              ${isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <svg
                className={`h-10 w-10 transition-colors ${isDragActive ? "text-primary" : "text-muted-foreground"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              {isDragActive ? (
                <p className="text-sm font-medium text-primary">Drop it here</p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Drag &amp; drop a file, or{" "}
                    <span className="text-primary underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD — up to 20 MB</p>
                </>
              )}
            </div>
          </div>

          {/* File rejection errors */}
          {fileRejections.length > 0 && (
            <p className="text-xs text-destructive">
              {fileRejections[0].errors[0].message}
            </p>
          )}

          {/* Pending file preview */}
          {pendingFile && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{pendingFile.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(pendingFile.file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => { setPendingFile(null); setUploadProgress(0); }}
                  disabled={uploading}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading} className="h-8 gap-1.5">
                  {uploading ? (
                    <>
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      {uploadProgress < 100 ? `${uploadProgress}%` : "Processing…"}
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Upload progress bar */}
          {uploading && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents table */}
      <div>
        {loading ? (
          <div className="flex justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold w-24">Type</TableHead>
                  <TableHead className="font-semibold w-32">Status</TableHead>
                  <TableHead className="font-semibold w-36">Uploaded</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {doc.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {TYPE_LABELS[doc.file_type] ?? doc.file_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <span className="font-medium">{doc.name}</span> and all its indexed chunks will be permanently removed. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              onClick={() => handleDelete(doc.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

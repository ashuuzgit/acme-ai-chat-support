"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ticket {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  query: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "closed";
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<Ticket["priority"], string> = {
  urgent: "bg-slate-900 text-white border-slate-900 hover:bg-slate-900",
  high:   "bg-slate-700 text-white border-slate-700 hover:bg-slate-700",
  medium: "bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800",
  low:    "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const STATUS_STYLES: Record<Ticket["status"], string> = {
  open:        "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
  in_progress: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  resolved:    "bg-white text-slate-800 border-slate-300 hover:bg-white dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600",
  closed:      "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-700",
};

const STATUS_LABELS: Record<Ticket["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

function PriorityBadge({ priority }: { priority: Ticket["priority"] }) {
  return (
    <Badge className={`capitalize ${PRIORITY_STYLES[priority]}`}>{priority}</Badge>
  );
}

function StatusBadge({ status }: { status: Ticket["status"] }) {
  return (
    <Badge className={`${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</Badge>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      const { data } = await api.get<Ticket[]>("/api/tickets", { params });
      setTickets(data);
    } catch {
      setError("Could not load tickets. Check your connection or backend.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      const { data } = await api.patch<Ticket>(`/api/tickets/${id}`, { status });
      setTickets((prev) => prev.map((t) => (t.id === id ? data : t)));
      toast.success("Ticket updated");
    } catch {
      toast.error("Failed to update ticket");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Auto-escalated conversations that need human attention
        </p>
      </div>

      {/* Inline error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={fetchTickets}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No tickets found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tickets are created automatically when escalation keywords are detected in chat
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Query</TableHead>
                <TableHead className="font-semibold w-24">Priority</TableHead>
                <TableHead className="font-semibold w-32">Status</TableHead>
                <TableHead className="font-semibold w-32">Created</TableHead>
                <TableHead className="font-semibold w-40">Update status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id} className="group">
                  <TableCell className="font-medium">
                    {ticket.customer_name ?? (
                      <span className="text-muted-foreground italic">Anonymous</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ticket.customer_email ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm" title={ticket.query}>
                      {ticket.query}
                    </p>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(ticket.created_at)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ticket.status}
                      onValueChange={(v) => updateStatus(ticket.id, v)}
                      disabled={updating === ticket.id}
                    >
                      <SelectTrigger className="h-8 text-xs w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {ticket.conversation_id && (
                      <Link href={`/conversations?id=${ticket.conversation_id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

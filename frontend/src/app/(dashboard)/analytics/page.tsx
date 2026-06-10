"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  total_conversations: number;
  avg_response_ms: number;
  resolution_rate: number;
  escalation_rate: number;
  daily_conversations: { date: string; conversations: number }[];
}

interface DashboardStats {
  open_tickets: number;
  resolved_tickets: number;
  escalated_tickets: number;
  spark_open?: number[];
  spark_resolved?: number[];
}

interface KnowledgeData {
  top_documents: { id: string; name: string; file_type: string; chunk_count: number }[];
  unanswered_questions: { id: string; content: string; created_at: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string) {
  const normalized = /[Z+]/.test(iso) ? iso : iso + "Z";
  const diff = Date.now() - new Date(normalized).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

// ─── Circular gauge ───────────────────────────────────────────────────────────

function CircleGauge({ value, max = 100, size = 88, label }: {
  value: number; max?: number; size?: number; label?: string;
}) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ - pct * circ;
  const cx = size / 2;

  return (
    <svg width={size} height={size} className="block">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={8} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke="#1e293b" strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        className="transition-all duration-700"
      />
      <text x={cx} y={cx - 4} textAnchor="middle" fontSize={size * 0.2} fontWeight="700" fill="currentColor">
        {value}{label}
      </text>
      {label === undefined && (
        <text x={cx} y={cx + 12} textAnchor="middle" fontSize={size * 0.14} fill="hsl(var(--muted-foreground))">
          / {max}
        </text>
      )}
    </svg>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({ value, max, label, sub }: { value: number; max: number; label: string; sub?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate max-w-[200px]" title={label}>{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{sub ?? value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-slate-800 dark:bg-slate-300 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ title, sub, hint }: { title: string; sub: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <svg className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                </svg>
              </TooltipTrigger>
              <TooltipContent className="max-w-48">{hint}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

// ─── Tooltip style ────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  cursor: { stroke: "hsl(var(--border))" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview,   setOverview]   = useState<OverviewData | null>(null);
  const [knowledge,  setKnowledge]  = useState<KnowledgeData | null>(null);
  const [dash,       setDash]       = useState<DashboardStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  function fetchData() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<OverviewData>("/api/analytics/overview"),
      api.get<KnowledgeData>("/api/analytics/knowledge"),
      api.get<DashboardStats>("/api/analytics/dashboard"),
    ])
      .then(([{ data: ov }, { data: kn }, { data: ds }]) => {
        setOverview(ov);
        setKnowledge(kn);
        setDash(ds);
      })
      .catch(() => setError("Could not load analytics. Check your connection or backend."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []);

  const daily   = overview?.daily_conversations ?? [];
  const maxDoc  = Math.max(...(knowledge?.top_documents.map(d => d.chunk_count) ?? [1]), 1);

  // Resolution status bars
  const totalTickets = (dash?.open_tickets ?? 0) + (dash?.resolved_tickets ?? 0);
  const resolutionBars = [
    { label: "Resolved", value: dash?.resolved_tickets ?? 0, color: "#1e293b" },
    { label: "Escalated", value: dash?.escalated_tickets ?? 0, color: "#7c3aed" },
    { label: "Open",      value: dash?.open_tickets ?? 0,     color: "#cbd5e1" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-10">

      {/* Page header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance overview for the last 30 days</p>
        </div>
        {!loading && (
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10" onClick={fetchData}>Retry</Button>
        </div>
      )}

      {/* ── CHAT METRICS ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead title="Chat Metrics" sub="Aggregate performance across all conversations" />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Total Conversations */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Conversations</p>
            {loading ? <Sk className="h-9 w-20" /> : (
              <p className="text-3xl font-bold tabular-nums">
                {(overview?.total_conversations ?? 0).toLocaleString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">all time</p>
          </div>

          {/* Avg Response Time */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Response</p>
            {loading ? <Sk className="h-9 w-16" /> : (
              <p className="text-3xl font-bold tabular-nums">{formatMs(overview?.avg_response_ms ?? 0)}</p>
            )}
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-800 dark:bg-slate-300 transition-all duration-700"
                style={{ width: loading ? "0%" : `${Math.min(((overview?.avg_response_ms ?? 0) / 10000) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Resolution Rate */}
          <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-start w-full">Resolution Rate</p>
            {loading ? <Sk className="h-20 w-20 rounded-full" /> : (
              <CircleGauge value={overview?.resolution_rate ?? 0} label="%" size={88} />
            )}
          </div>

          {/* Escalation Rate */}
          <div className="rounded-xl border bg-card p-4 flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground self-start w-full">Escalation Rate</p>
            {loading ? <Sk className="h-20 w-20 rounded-full" /> : (
              <CircleGauge value={overview?.escalation_rate ?? 0} label="%" size={88} />
            )}
          </div>
        </div>

        {/* Conversations area chart */}
        <div className="rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold">Conversations Over Time</p>
              <p className="text-xs text-muted-foreground mt-0.5">Daily volume — last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-800 dark:bg-slate-300" />
              <span className="text-xs text-muted-foreground">conversations / day</span>
            </div>
          </div>
          {loading ? <Sk className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1e293b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1e293b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RechartsTooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="conversations" stroke="#1e293b" strokeWidth={2} fill="url(#grad)" dot={{ r: 3, fill: "#1e293b" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resolution status + response time bar grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          {/* Resolution status */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Resolution Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ticket breakdown by outcome</p>
            </div>
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <Sk key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                {resolutionBars.map((b) => (
                  <div key={b.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{b.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {b.value}
                        {totalTickets > 0 && (
                          <span className="ml-1 opacity-60">({Math.round((b.value / totalTickets) * 100)}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: totalTickets > 0 ? `${Math.round((b.value / totalTickets) * 100)}%` : "0%", backgroundColor: b.color }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">{totalTickets} total tickets</p>
              </div>
            )}
          </div>

          {/* Daily ticket trend bar chart */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Daily Ticket Trend</p>
              <p className="text-xs text-muted-foreground mt-0.5">Open vs resolved — last 7 days</p>
            </div>
            {loading ? <Sk className="h-36 w-full" /> : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={(dash?.spark_open ?? Array(7).fill(0)).map((o, i) => ({
                    day: ["M","T","W","T","F","S","S"][i % 7],
                    open: o,
                    resolved: (dash?.spark_resolved ?? Array(7).fill(0))[i] ?? 0,
                  }))}
                  margin={{ top: 0, right: 0, left: -30, bottom: 0 }}
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <RechartsTooltip {...tooltipStyle} />
                  <Bar dataKey="open"     fill="#cbd5e1" radius={[3,3,0,0]} maxBarSize={20} name="Open" />
                  <Bar dataKey="resolved" fill="#1e293b" radius={[3,3,0,0]} maxBarSize={20} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 pt-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />Open</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-slate-800 dark:bg-slate-200" />Resolved</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── KNOWLEDGE BASE METRICS ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHead
          title="Knowledge Base Metrics"
          sub="Document index health and query coverage"
          hint="Based on how many chunks each document has indexed — more chunks = more content available to the AI."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Most referenced documents */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold">Most Referenced Documents</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by indexed chunk count</p>
            </div>
            {loading ? (
              <div className="space-y-4">{[...Array(4)].map((_, i) => <Sk key={i} className="h-8 w-full" />)}</div>
            ) : !knowledge?.top_documents.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No documents indexed yet</div>
            ) : (
              <div className="space-y-4">
                {knowledge.top_documents.slice(0, 6).map((doc, i) => (
                  <div key={doc.id} className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{doc.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{doc.chunk_count} chunks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-800 dark:bg-slate-300 transition-all duration-700"
                          style={{ width: `${Math.round((doc.chunk_count / maxDoc) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0
                      ${doc.file_type === "pdf" ? "bg-slate-100 text-slate-700 border-slate-200" :
                        doc.file_type === "md"  ? "bg-violet-50 text-violet-700 border-violet-200" :
                        "bg-slate-50 text-slate-500 border-slate-200"}`}
                    >
                      {doc.file_type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unanswered / failed queries */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Unanswered Questions</p>
                <p className="text-xs text-muted-foreground mt-0.5">Recent queries from customer conversations</p>
              </div>
              {!loading && knowledge && (
                <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 border px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {knowledge.unanswered_questions.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Sk key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : !knowledge?.unanswered_questions.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <p className="text-sm font-medium">All questions answered</p>
                <p className="text-xs text-muted-foreground mt-1">No unanswered queries found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {knowledge.unanswered_questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 rounded-lg bg-muted/40 border px-3 py-2.5">
                    <span className="mt-0.5 text-xs tabular-nums text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <p className="text-xs text-foreground flex-1 leading-relaxed break-words line-clamp-2">{q.content}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{timeAgo(q.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer gradient */}
      <div className="h-8 rounded-xl bg-gradient-to-r from-violet-50/70 via-slate-50/40 to-violet-50/70 dark:from-violet-950/25 dark:via-transparent dark:to-violet-950/25 border border-violet-100/50 dark:border-violet-900/20" />
    </div>
  );
}

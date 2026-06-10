"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  total_conversations: number;
  open_tickets: number;
  resolved_tickets: number;
  escalated_tickets: number;
  resolution_rate: number;
  avg_response_ms: number;
  spark_open?: number[];
  spark_escalated?: number[];
  spark_resolved?: number[];
  spark_rate?: number[];
}

interface Ticket {
  id: string;
  customer_name: string | null;
  query: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
}

interface ConvSummary {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: "active" | "closed";
  created_at: string;
  last_message: string | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1100): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!target) { setCount(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p >= 1) { clearInterval(id); setCount(target); }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return count;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  // Supabase returns timestamps without timezone suffix — treat as UTC
  const normalized = /[Z+]/.test(iso) ? iso : iso + "Z";
  const diff = Date.now() - new Date(normalized).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  return src.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  suffix = "",
  todayCount,
  yesterdayCount,
}: {
  label: string;
  value: number;
  suffix?: string;
  todayCount: number;
  yesterdayCount: number;
}) {
  const animated = useCountUp(value);
  const diff = todayCount - yesterdayCount;
  const hasData = todayCount > 0 || yesterdayCount > 0;

  let trendEl: React.ReactNode = null;
  if (hasData) {
    if (diff > 0) {
      trendEl = (
        <span className="flex items-center gap-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
          +{diff} today
        </span>
      );
    } else if (diff < 0) {
      trendEl = (
        <span className="flex items-center gap-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" /></svg>
          {diff} today
        </span>
      );
    } else {
      trendEl = (
        <span className="flex items-center gap-0.5 text-xs text-slate-400 dark:text-slate-500 font-medium">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
          same as yesterday
        </span>
      );
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 overflow-hidden">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </p>
      <p className="text-3xl font-bold tabular-nums text-foreground">
        {animated.toLocaleString()}{suffix}
      </p>
      <div className="mt-auto">
        {trendEl ?? <span className="text-xs text-muted-foreground/50">No activity yet</span>}
      </div>
    </div>
  );
}

// ─── Activity event config ────────────────────────────────────────────────────

const EVT = {
  ticket: {
    tag: "[NEW_TICKET]",
    border: "border-l-slate-400 dark:border-l-slate-500",
    tagColor: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50/80 dark:bg-slate-800/30",
  },
  escalation: {
    tag: "[AI_ESCALATION]",
    border: "border-l-violet-300 dark:border-l-violet-600",
    tagColor: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
  },
  conversation: {
    tag: "[CHAT_STARTED]",
    border: "border-l-slate-300 dark:border-l-slate-600",
    tagColor: "text-slate-400 dark:text-slate-500",
    bg: "",
  },
  resolved: {
    tag: "[TICKET_RESOLVED]",
    border: "border-l-slate-300 dark:border-l-slate-600",
    tagColor: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-50/40 dark:bg-slate-800/20",
  },
};

type EvtType = keyof typeof EVT;

interface ActivityItem {
  id: string;
  type: EvtType;
  description: string;
  time: string;
}

// ─── Priority donut colors ────────────────────────────────────────────────────

const P_COLORS = {
  urgent: "#ef4444",
  high:   "#f97316",
  medium: "#a78bfa",
  low:    "#cbd5e1",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats]             = useState<DashboardStats | null>(null);
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [convos, setConvos]           = useState<ConvSummary[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo]   = useState(0);
  const [error, setError]             = useState<string | null>(null);

  const fetchRef = useRef<(silent?: boolean) => void>(null!);

  fetchRef.current = (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    Promise.all([
      api.get<DashboardStats>("/api/analytics/dashboard"),
      api.get<Ticket[]>("/api/tickets"),
      api.get<ConvSummary[]>("/api/conversations"),
    ])
      .then(([{ data: s }, { data: t }, { data: c }]) => {
        setStats(s);
        setTickets(t.slice(0, 60));
        setConvos(c.slice(0, 8));
      })
      .catch(() => { if (!silent) setError("Could not load dashboard. Check your connection or backend."); })
      .finally(() => { setLoading(false); setRefreshing(false); setLastUpdated(new Date()); setSecondsAgo(0); });
  };

  function fetchAll(silent = false) { fetchRef.current(silent); }

  useEffect(() => {
    fetchRef.current();
    const pollId = setInterval(() => fetchRef.current(true), 30_000);
    const tickId = setInterval(() => setSecondsAgo((s) => s + 1), 1_000);
    return () => { clearInterval(pollId); clearInterval(tickId); };
  }, []);

  // Today = last element, yesterday = second-to-last in the 7-day series
  const s = stats;
  const todayOpen      = s?.spark_open?.at(-1)      ?? 0;
  const yestOpen       = s?.spark_open?.at(-2)      ?? 0;
  const todayEsc       = s?.spark_escalated?.at(-1) ?? 0;
  const yestEsc        = s?.spark_escalated?.at(-2) ?? 0;
  const todayRes       = s?.spark_resolved?.at(-1)  ?? 0;
  const yestRes        = s?.spark_resolved?.at(-2)  ?? 0;
  const todayRate      = s?.spark_rate?.at(-1)      ?? 0;
  const yestRate       = s?.spark_rate?.at(-2)      ?? 0;

  const priority = (["urgent", "high", "medium", "low"] as const).map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: tickets.filter((t) => t.priority === p && (t.status === "open" || t.status === "in_progress")).length,
    color: P_COLORS[p],
  }));

  const openCount = priority.reduce((s, p) => s + p.value, 0);

  const emptyDonut = priority.every((p) => p.value === 0);

  const activity: ActivityItem[] = [
    ...tickets.slice(0, 10).map((t): ActivityItem => ({
      id: `t-${t.id}`,
      type:
        t.status === "resolved" || t.status === "closed" ? "resolved"
        : t.priority === "urgent" || t.priority === "high" ? "escalation"
        : "ticket",
      description: t.customer_name
        ? `${t.customer_name} — ${t.query.slice(0, 65)}${t.query.length > 65 ? "…" : ""}`
        : `Query: ${t.query.slice(0, 65)}${t.query.length > 65 ? "…" : ""}`,
      time: t.created_at,
    })),
    ...convos.slice(0, 6).map((c): ActivityItem => ({
      id: `c-${c.id}`,
      type: "conversation",
      description: `${c.customer_name ?? c.customer_email ?? "Anonymous"} started a chat session`,
      time: c.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 7);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">Operations Center</h1>
            <span className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-700 px-2.5 py-0.5 text-xs font-bold text-violet-600 dark:text-violet-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time oversight of AI and support performance
          </p>
        </div>
        <Link href="/knowledge-base">
          <Button size="sm" className="gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Upload document
          </Button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => fetchAll()}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2.5">
              <Sk className="h-3 w-24" />
              <Sk className="h-9 w-16" />
              <Sk className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Open Tickets"    value={stats?.open_tickets ?? 0}      todayCount={todayOpen} yesterdayCount={yestOpen} />
          <StatCard label="Escalated"       value={stats?.escalated_tickets ?? 0} todayCount={todayEsc}  yesterdayCount={yestEsc}  />
          <StatCard label="Resolved"        value={stats?.resolved_tickets ?? 0}  todayCount={todayRes}  yesterdayCount={yestRes}  />
          <StatCard label="Resolution Rate" value={stats?.resolution_rate ?? 0}   todayCount={todayRate} yesterdayCount={yestRate} suffix="%" />
        </div>
      )}

      {/* ── Middle row: Activity feed + Donut ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_276px]">

        {/* Activity feed */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">Live Activity Stream</h2>
              <span className="font-mono text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                {loading ? "LOADING" : refreshing ? "SYNCING…" : activity.length === 0 ? "EMPTY" : "LIVE"}
              </span>
              {!loading && lastUpdated && (
                <span className="text-xs text-muted-foreground/60">
                  refreshed {secondsAgo}s ago
                </span>
              )}
            </div>
            <Link href="/tickets" className="text-xs text-primary hover:underline">
              View tickets →
            </Link>
          </div>

          <div className="divide-y flex-1">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Sk className="h-4 w-28 shrink-0" />
                  <Sk className="h-4 flex-1" />
                  <Sk className="h-3 w-12 shrink-0" />
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Start a chat from the widget to see events here
                </p>
              </div>
            ) : (
              activity.map((item) => {
                const s = EVT[item.type];
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-5 py-3.5 border-l-4 ${s.border} ${s.bg}`}
                  >
                    <span className={`text-xs font-bold font-mono shrink-0 mt-0.5 leading-none ${s.tagColor}`}>
                      {s.tag}
                    </span>
                    <span className="text-sm text-foreground flex-1 leading-relaxed min-w-0 break-words">
                      {item.description}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">
                      {timeAgo(item.time)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Priority donut */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b shrink-0">
            <h2 className="text-sm font-semibold">Ticket Priority</h2>
          </div>
          <div className="flex flex-col items-center px-4 py-5 gap-4 flex-1 justify-center">
            {loading ? (
              <Sk className="h-[190px] w-[190px] rounded-full" />
            ) : (
              <div className="relative">
                <ResponsiveContainer width={190} height={190}>
                  <PieChart>
                    <Pie
                      data={emptyDonut ? [{ name: "None", value: 1, color: "#e5e7eb" }] : priority}
                      cx={90}
                      cy={90}
                      innerRadius={58}
                      outerRadius={82}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                      paddingAngle={emptyDonut ? 0 : 2}
                    >
                      {(emptyDonut ? [{ name: "None", value: 1, color: "#e5e7eb" }] : priority).map(
                        (entry, i) => <Cell key={i} fill={entry.color} />
                      )}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-3xl font-bold tabular-nums">{openCount}</span>
                  <span className="text-xs text-muted-foreground leading-tight text-center">
                    Open<br />Tickets
                  </span>
                </div>
              </div>
            )}
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 w-full">
              {priority.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="ml-auto font-semibold tabular-nums">{loading ? "—" : p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Conversations ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Conversations</h2>
          <Link
            href="/conversations"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3 min-w-[220px] shrink-0">
                <div className="flex items-center gap-2.5">
                  <Sk className="h-9 w-9 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Sk className="h-3.5 w-24" />
                    <Sk className="h-3 w-16" />
                  </div>
                </div>
                <Sk className="h-3.5 w-full" />
                <Sk className="h-3.5 w-2/3" />
                <div className="flex justify-between pt-1">
                  <Sk className="h-5 w-14 rounded-full" />
                  <Sk className="h-3 w-10" />
                </div>
              </div>
            ))}
          </div>
        ) : convos.length === 0 ? (
          <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
            No conversations yet — embed the widget on your site to start receiving chats.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
            {convos.slice(0, 6).map((c) => {
              const ini = initials(c.customer_name, c.customer_email);
              const isActive = c.status === "active";
              return (
                <Link
                  key={c.id}
                  href={`/conversations?id=${c.id}`}
                  className="group rounded-xl border bg-card p-4 flex flex-col gap-2.5 min-w-[220px] max-w-[260px] shrink-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-primary/25 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-bold group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition-colors">
                      {ini}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.customer_name ?? c.customer_email ?? "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.customer_email ?? "No email"}
                      </p>
                    </div>
                  </div>
                  {c.last_message && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                      &ldquo;{c.last_message}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        isActive
                          ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800"
                          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
                      {isActive ? "Active" : "Closed"}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer gradient accent */}
      <div className="h-10 rounded-xl bg-gradient-to-r from-violet-50/70 via-slate-50/40 to-violet-50/70 dark:from-violet-950/25 dark:via-transparent dark:to-violet-950/25 border border-violet-100/50 dark:border-violet-900/20 flex items-center justify-center">
        <p className="text-xs text-muted-foreground/50 select-none">
          SupportAI — AI-Powered Customer Operations Platform
        </p>
      </div>

    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  total_conversations: number;
  avg_response_ms: number;
  resolution_rate: number;
  escalation_rate: number;
  daily_conversations: { date: string; conversations: number }[];
}

interface KnowledgeData {
  top_documents: {
    id: string;
    name: string;
    file_type: string;
    chunk_count: number;
  }[];
  unanswered_questions: {
    id: string;
    content: string;
    created_at: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

const TYPE_COLOURS: Record<string, string> = {
  pdf: "bg-red-50 text-red-700 border-red-200",
  docx: "bg-blue-50 text-blue-700 border-blue-200",
  txt: "bg-slate-50 text-slate-600 border-slate-200",
  md: "bg-violet-50 text-violet-700 border-violet-200",
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<OverviewData>("/api/analytics/overview"),
      api.get<KnowledgeData>("/api/analytics/knowledge"),
    ])
      .then(([{ data: ov }, { data: kn }]) => {
        setOverview(ov);
        setKnowledge(kn);
      })
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance overview for your AI support assistant
        </p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Conversations"
            value={(overview?.total_conversations ?? 0).toLocaleString()}
            sub="all time"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
              </svg>
            }
          />
          <StatCard
            label="Avg Response Time"
            value={overview ? formatMs(overview.avg_response_ms) : "—"}
            sub="AI generation time"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <StatCard
            label="Resolution Rate"
            value={`${overview?.resolution_rate ?? 0}%`}
            sub="tickets resolved or closed"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <StatCard
            label="Escalation Rate"
            value={`${overview?.escalation_rate ?? 0}%`}
            sub="conversations escalated"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            }
          />
        </div>
      )}

      {/* Line chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversations — last 7 days</CardTitle>
          <CardDescription>Daily volume of customer conversations</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <Skeleton className="h-52 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={overview?.daily_conversations ?? []}
                margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  cursor={{ stroke: "hsl(var(--border))" }}
                />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-table row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Most referenced documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Most Referenced Documents</CardTitle>
            <CardDescription>Ranked by number of indexed chunks</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6 pt-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : !knowledge?.top_documents.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No documents indexed yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs w-16">Type</TableHead>
                    <TableHead className="text-xs w-20 text-right">Chunks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knowledge.top_documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="text-sm font-medium max-w-[180px] truncate">
                        {doc.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${TYPE_COLOURS[doc.file_type] ?? ""}`}
                        >
                          {doc.file_type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {doc.chunk_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Unanswered questions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Customer Questions</CardTitle>
            <CardDescription>Latest messages from customer conversations</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6 pt-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : !knowledge?.unanswered_questions.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No messages yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Question</TableHead>
                    <TableHead className="text-xs w-24 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {knowledge.unanswered_questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell
                        className="text-sm max-w-[220px] truncate"
                        title={q.content}
                      >
                        {q.content}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(q.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

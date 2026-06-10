"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  status: "active" | "closed";
  created_at: string;
  last_message: string | null;
  last_message_role: "user" | "assistant" | null;
  last_message_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  event_type: "message" | "escalation" | "ticket_created";
  response_time_ms: number | null;
  created_at: string;
}

interface ConversationDetail {
  conversation: {
    id: string;
    customer_name: string | null;
    customer_email: string | null;
    status: string;
    created_at: string;
  };
  messages: Message[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string | null, email: string | null) {
  if (name) return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function getDisplayName(name: string | null, email: string | null) {
  return name ?? email ?? "Anonymous visitor";
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConversationItem({
  conv,
  active,
  onClick,
}: {
  conv: ConversationSummary;
  active: boolean;
  onClick: () => void;
}) {
  const initials = getInitials(conv.customer_name, conv.customer_email);
  const name = getDisplayName(conv.customer_name, conv.customer_email);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3.5 transition-colors hover:bg-muted/60 border-b last:border-b-0",
        active && "bg-muted"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0 h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
          {initials}
        </div>
        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{name}</p>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTime(conv.last_message_at)}
            </span>
          </div>
          {conv.last_message && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {conv.last_message_role === "assistant" && (
                <span className="text-primary/60 mr-1">Bot:</span>
              )}
              {conv.last_message}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Event banners ────────────────────────────────────────────────────────────

function EscalationBanner({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-sm rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-center my-3">
      <p className="text-xs font-medium text-amber-800">
        ⚠️ Escalation detected — {content}
      </p>
    </div>
  );
}

function TicketBanner({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-sm rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-center my-3">
      <p className="text-xs font-medium text-blue-800">
        🎫 Ticket created — {content}
      </p>
    </div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (message.event_type === "escalation") return <EscalationBanner content={message.content} />;
  if (message.event_type === "ticket_created") return <TicketBanner content={message.content} />;

  return (
    <div className={cn("flex gap-2.5 max-w-[85%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
      {/* Avatar dot */}
      <div
        className={cn(
          "shrink-0 mt-1 h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? "U" : "AI"}
      </div>

      <div className={cn("flex flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {/* Preserve line breaks in AI responses */}
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground px-1">
          {formatFull(message.created_at)}
          {message.response_time_ms && (
            <span className="ml-1 text-muted-foreground/60">
              · {(message.response_time_ms / 1000).toFixed(1)}s
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Empty thread state ───────────────────────────────────────────────────────

function EmptyThread() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="mb-4 rounded-full bg-muted p-5">
        <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-foreground">Select a conversation</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose a conversation from the list to view the message thread
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-6rem)] items-center justify-center"><svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg></div>}>
      <ConversationsInner />
    </Suspense>
  );
}

function ConversationsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load conversation list ─────────────────────────────────────────────────

  const fetchConversations = useCallback(async (q?: string) => {
    setListLoading(true);
    try {
      const url = q?.trim() ? `/api/conversations/search?q=${encodeURIComponent(q)}` : "/api/conversations";
      const { data } = await api.get<ConversationSummary[]>(url);
      setConversations(data);
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Honour ?id= param from tickets page
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setActiveId(id);
  }, [searchParams]);

  // ── Debounced search ───────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchConversations(search), 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, fetchConversations]);

  // ── Load thread ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeId) return;
    setThreadLoading(true);
    api
      .get<ConversationDetail>(`/api/conversations/${activeId}/messages`)
      .then(({ data }) => setThread(data))
      .catch(() => toast.error("Failed to load messages"))
      .finally(() => setThreadLoading(false));
  }, [activeId]);

  // Auto-scroll to bottom when thread loads
  useEffect(() => {
    if (thread) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  function selectConversation(id: string) {
    setActiveId(id);
    router.replace(`/conversations?id=${id}`, { scroll: false });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-7xl mx-auto rounded-xl border overflow-hidden bg-background">

      {/* ── Left panel: conversation list ── */}
      <div className="w-80 shrink-0 flex flex-col border-r">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <Input
              placeholder="Search conversations…"
              className="pl-8 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Conversations
          </p>
          {!listLoading && (
            <span className="text-xs text-muted-foreground">{conversations.length}</span>
          )}
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {listLoading ? (
            <div className="flex justify-center py-10">
              <svg className="h-5 w-5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                {search ? "No conversations match your search" : "No conversations yet"}
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* ── Right panel: message thread ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <EmptyThread />
        ) : threadLoading ? (
          <div className="flex justify-center items-center h-full">
            <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : thread ? (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {getInitials(thread.conversation.customer_name, thread.conversation.customer_email)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {getDisplayName(thread.conversation.customer_name, thread.conversation.customer_email)}
                  </p>
                  {thread.conversation.customer_email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {thread.conversation.customer_email}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  className={cn(
                    "capitalize",
                    thread.conversation.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {thread.conversation.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFull(thread.conversation.created_at)}
                </span>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              {thread.messages.length === 0 ? (
                <div className="flex justify-center py-8">
                  <p className="text-sm text-muted-foreground italic">No messages in this conversation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {thread.messages.map((msg, i) => {
                    const prevMsg = thread.messages[i - 1];
                    const showDateSep =
                      !prevMsg ||
                      new Date(msg.created_at).toDateString() !==
                        new Date(prevMsg.created_at).toDateString();

                    return (
                      <div key={msg.id}>
                        {showDateSep && (
                          <div className="flex items-center gap-3 my-4">
                            <Separator className="flex-1" />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(msg.created_at).toLocaleDateString([], {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <Separator className="flex-1" />
                          </div>
                        )}
                        <ChatBubble message={msg} />
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>
          </>
        ) : null}
      </div>
    </div>
  );
}

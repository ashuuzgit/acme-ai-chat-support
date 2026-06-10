"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetConfig {
  bot_name: string;
  welcome_message: string;
  personality: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface CustomerInfo {
  name: string;
  email: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const SUGGESTED = [
  "Track my order",
  "Pricing",
  "Refund policy",
  "Contact support",
];

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 max-w-[85%] mr-auto">
      <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
        AI
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground/50 inline-block animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  botName,
}: {
  message: Message;
  botName: string;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex items-end gap-2.5 max-w-[85%]",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          isUser
            ? "bg-slate-600 text-white"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? "U" : botName.slice(0, 2).toUpperCase()}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-slate-700 text-white rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-primary">
                  {children}
                </a>
              ),
              code: ({ children }) => (
                <code className="bg-background/60 rounded px-1 text-xs font-mono">{children}</code>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.streaming && (
          <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

// ─── Customer info form ───────────────────────────────────────────────────────

function CustomerForm({
  botName,
  welcomeMessage,
  onStart,
}: {
  botName: string;
  welcomeMessage: string;
  onStart: (info: CustomerInfo) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onStart({ name: name.trim(), email: email.trim() });
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-5">
      <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-md">
        {botName.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <p className="font-semibold text-base">{botName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{welcomeMessage}</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <Input
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-sm"
        />
        <Input
          type="email"
          placeholder="Email address (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-sm"
        />
        <Button type="submit" className="w-full">
          Start chatting
        </Button>
      </form>
    </div>
  );
}

// ─── Page / Widget ────────────────────────────────────────────────────────────

export default function WidgetPage({
  params,
}: {
  params: { businessId: string };
}) {
  const { businessId } = params;
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Load config ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_URL}/api/chat/widget-config/${businessId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setConfig(data);
      })
      .catch(() => setConfigError(true));
  }, [businessId]);

  // ── Scroll to bottom ─────────────────────────────────────────────────────

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTyping]);

  // ── Start chat ───────────────────────────────────────────────────────────

  function handleStart(info: CustomerInfo) {
    setCustomer(info);
    const welcome: Message = {
      id: "welcome",
      role: "assistant",
      content: config?.welcome_message ?? "Hi! How can I help you today?",
    };
    setMessages([welcome]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowTyping(true);
    setIsStreaming(true);

    const assistantId = `assistant-${Date.now()}`;

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          businessId,
          conversationId,
          customerName: customer?.name || undefined,
          customerEmail: customer?.email || undefined,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      setShowTyping(false);

      // Seed empty assistant bubble
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", streaming: true },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const json = part.slice(6).trim();
          if (!json) continue;

          try {
            const payload = JSON.parse(json);

            if (payload.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + payload.content }
                    : m
                )
              );
            }

            if (payload.done) {
              setConversationId(payload.conversationId);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, streaming: false } : m
                )
              );
            }

            if (payload.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
                    : m
                )
              );
            }
          } catch {
            // Malformed SSE chunk — skip
          }
        }
      }
    } catch {
      setShowTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "Sorry, I couldn't connect. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (configError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground text-center px-6">
          Widget unavailable. Check the business ID.
        </p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  // ── Pre-chat form ─────────────────────────────────────────────────────────

  if (!customer) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <WidgetHeader botName={config.bot_name} />
        <div className="flex-1 overflow-hidden">
          <CustomerForm
            botName={config.bot_name}
            welcomeMessage={config.welcome_message}
            onStart={handleStart}
          />
        </div>
      </div>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <WidgetHeader botName={config.bot_name} />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble message={msg} botName={config.bot_name} />
            {/* Suggestion chips after welcome message */}
            {i === 0 && msg.id === "welcome" && (
              <div className="flex flex-wrap gap-2 mt-3 ml-9">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={isStreaming}
                    className="rounded-full border border-border bg-background hover:bg-muted px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {showTyping && <TypingIndicator />}
        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={isStreaming}
            className="flex-1 text-sm h-10 rounded-full"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isStreaming}
            className="h-10 w-10 rounded-full p-0 shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </Button>
        </form>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          Powered by SupportAI
        </p>
      </div>
    </div>
  );
}

// ─── Widget header (shared) ───────────────────────────────────────────────────

function WidgetHeader({ botName }: { botName: string }) {
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 border-b bg-background shadow-sm">
      <div className="relative">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          {botName.slice(0, 2).toUpperCase()}
        </div>
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{botName}</p>
        <p className="mt-0.5 text-xs text-emerald-600 font-medium">Online</p>
      </div>
    </div>
  );
}

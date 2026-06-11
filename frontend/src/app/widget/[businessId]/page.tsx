"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WidgetConfig {
  bot_name: string;
  welcome_message: string;
  personality: string;
  suggested_questions?: string[];
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

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ initial }: { initial: string }) {
  return (
    <div className="flex items-end gap-2 max-w-[80%] mr-auto">
      <BotAvatar initial={initial} size="sm" />
      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 inline-block animate-bounce"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.75s" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

function BotAvatar({ initial, size = "md" }: { initial: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-12 w-12 text-lg" : "h-8 w-8 text-xs";
  return (
    <div className={cn("rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shrink-0", sz)}>
      {initial}
    </div>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ message, botInitial, customerInitial }: { message: Message; botInitial: string; customerInitial: string }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-end gap-2 max-w-[82%]", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
      {isUser ? (
        <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-[10px] font-bold shrink-0">
          {customerInitial}
        </div>
      ) : (
        <BotAvatar initial={botInitial} size="sm" />
      )}
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-slate-900 text-white rounded-br-sm"
            : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm"
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
                <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-violet-700 dark:text-violet-400">
                  {children}
                </a>
              ),
              code: ({ children }) => (
                <code className="bg-slate-200 dark:bg-slate-700 rounded px-1 text-xs font-mono">{children}</code>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.streaming && (
          <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
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
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function validate() {
    const e: { name?: string; email?: string } = {};
    if (!name.trim())  e.name  = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email";
    return e;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onStart({ name: name.trim(), email: email.trim() });
  }

  const botInitial = initials(botName);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-6 text-center gap-5">
      {/* Avatar with pulsing ring */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-violet-200/60 animate-ping" style={{ animationDuration: "2.5s" }} />
        <BotAvatar initial={botInitial} size="lg" />
        <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white" />
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-base text-slate-900 dark:text-slate-100">{botName}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">{welcomeMessage}</p>
      </div>

      {/* Divider */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Before we start</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-3" noValidate>
        <div className="text-left space-y-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Full name <span className="text-slate-400">*</span>
          </label>
          <Input
            placeholder="e.g. Jane Smith"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
            className={cn(
              "text-sm h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-slate-900",
              errors.name && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        <div className="text-left space-y-1">
          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Email address <span className="text-slate-400">*</span>
          </label>
          <Input
            type="email"
            placeholder="e.g. jane@company.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
            className={cn(
              "text-sm h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-slate-900",
              errors.email && "border-red-400 focus-visible:ring-red-400"
            )}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg"
        >
          Start chatting
          <svg className="h-4 w-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Button>
      </form>
    </div>
  );
}

// ─── Widget header ────────────────────────────────────────────────────────────

function WidgetHeader({ botName }: { botName: string }) {
  const initial = initials(botName);
  return (
    <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white">
      <div className="relative">
        <div className="h-8 w-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white text-xs font-bold">
          {initial}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-none truncate">{botName}</p>
        <p className="mt-0.5 text-[11px] text-emerald-400 font-medium">Online · Typically replies instantly</p>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  const words = name.trim().split(/\s+|(?=[A-Z])/);
  const filtered = words.filter(Boolean);
  return filtered.length >= 2
    ? (filtered[0][0] + filtered[filtered.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white sm:bg-gradient-to-br sm:from-violet-50 sm:via-slate-50/80 sm:to-violet-100 relative overflow-hidden">
      {/* Decorative blobs — desktop only */}
      <div className="hidden sm:block pointer-events-none select-none" aria-hidden>
        <div className="fixed top-[-120px] right-[-100px] w-[440px] h-[440px] rounded-full bg-violet-200/40 blur-[80px]" />
        <div className="fixed bottom-[-100px] left-[-80px] w-[360px] h-[360px] rounded-full bg-slate-300/30 blur-[70px]" />
        <div className="fixed top-1/3 left-[8%] w-[200px] h-[200px] rounded-full bg-violet-100/30 blur-[60px]" />
      </div>

      {/* Branding text — desktop only */}
      <div className="hidden sm:flex absolute top-8 left-1/2 -translate-x-1/2 items-center gap-2 opacity-40 select-none pointer-events-none">
        <div className="h-5 w-5 rounded bg-slate-900 flex items-center justify-center">
          <span className="text-white text-[9px] font-black">S</span>
        </div>
        <span className="text-xs font-semibold text-slate-500 tracking-wide">SupportAI</span>
      </div>

      {/* Chat widget card */}
      <div className={cn(
        "relative bg-white dark:bg-slate-950 flex flex-col overflow-hidden",
        "w-screen h-[100dvh]",
        "sm:w-[520px] sm:h-[700px] sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-slate-200/80 dark:sm:ring-slate-700/60"
      )}>
        {children}
      </div>

      {/* Footer — desktop only */}
      <div className="hidden sm:block absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-slate-400 select-none pointer-events-none">
        Powered by <span className="font-semibold text-slate-500">SupportAI</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WidgetPage({ params }: { params: { businessId: string } }) {
  const { businessId } = params;
  const [config,         setConfig]         = useState<WidgetConfig | null>(null);
  const [configError,    setConfigError]    = useState(false);
  const [customer,       setCustomer]       = useState<CustomerInfo | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [isStreaming,    setIsStreaming]    = useState(false);
  const [showTyping,     setShowTyping]     = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  function scrollToBottom(force = false) {
    const el = messagesRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (force || distFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(`${API_URL}/api/chat/widget-config/${businessId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { if (data.error) throw new Error(); setConfig(data); })
      .catch(() => setConfigError(true))
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [businessId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, showTyping]);

  function handleStart(info: CustomerInfo) {
    setCustomer(info);
    setMessages([{ id: "welcome", role: "assistant", content: config?.welcome_message ?? "Hi! How can I help you today?" }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowTyping(true);
    setTimeout(() => scrollToBottom(true), 30);
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
          customerName:  customer?.name,
          customerEmail: customer?.email,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      setShowTyping(false);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);

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
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: m.content + payload.content } : m));
            }
            if (payload.done) {
              setConversationId(payload.conversationId);
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m));
            }
            if (payload.error) {
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: "Sorry, something went wrong.", streaming: false } : m));
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } catch {
      setShowTyping(false);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "Sorry, I couldn't connect. Please try again." }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: FormEvent) { e.preventDefault(); sendMessage(input); }
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const botInitial      = config ? initials(config.bot_name) : "AI";
  const customerInitial = customer ? initials(customer.name) : "U";

  // ── Loading / error ───────────────────────────────────────────────────────

  if (configError) {
    return (
      <PageShell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">Widget unavailable</p>
          <p className="text-xs text-slate-400">Check the business ID or try again later.</p>
        </div>
      </PageShell>
    );
  }

  if (!config) {
    return (
      <PageShell>
        <div className="flex-1 flex items-center justify-center">
          <svg className="h-6 w-6 animate-spin text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </PageShell>
    );
  }

  // ── Pre-chat form ─────────────────────────────────────────────────────────

  if (!customer) {
    return (
      <PageShell>
        <WidgetHeader botName={config.bot_name} />
        <div className="flex-1 overflow-y-auto">
          <CustomerForm
            botName={config.bot_name}
            welcomeMessage={config.welcome_message}
            onStart={handleStart}
          />
        </div>
      </PageShell>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <WidgetHeader botName={config.bot_name} />

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white dark:bg-slate-950">
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble message={msg} botInitial={botInitial} customerInitial={customerInitial} />
            {/* Suggestion chips after welcome */}
            {i === 0 && msg.id === "welcome" && config?.suggested_questions && config.suggested_questions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 ml-8">
                {config.suggested_questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    disabled={isStreaming}
                    className="rounded-full border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {showTyping && <TypingIndicator initial={botInitial} />}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={isStreaming}
            className="flex-1 text-sm h-9 rounded-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-slate-900 placeholder:text-slate-400"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || isStreaming}
            className="h-9 w-9 rounded-full p-0 shrink-0 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </Button>
        </form>
        {/* Powered by — mobile only (desktop shown outside the card) */}
        <p className="sm:hidden mt-1.5 text-center text-[10px] text-slate-300 dark:text-slate-600">
          Powered by SupportAI
        </p>
      </div>
    </PageShell>
  );
}

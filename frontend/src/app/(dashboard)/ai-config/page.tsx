"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import api from "@/lib/api";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  bot_name: z.string().min(1, "Bot name is required"),
  welcome_message: z.string().min(1, "Welcome message is required"),
  personality: z.enum(["professional", "friendly", "technical"]),
  escalation_rules: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

interface ChatMsg { role: "bot" | "user"; text: string; }

const PERSONALITIES: {
  value: "professional" | "friendly" | "technical";
  label: string;
  description: string;
  preview: ChatMsg[];
}[] = [
  {
    value: "professional",
    label: "Professional",
    description: "Formal, precise, business-focused",
    preview: [
      { role: "bot",  text: "Good day. How may I assist you?" },
      { role: "user", text: "I'd like a refund for my last order." },
      { role: "bot",  text: "I understand. To process your refund, I will need your order reference number and the date of purchase. Please provide those details and I will proceed accordingly." },
      { role: "user", text: "Order #84921, placed on June 3rd." },
      { role: "bot",  text: "Thank you. I have located your order. Refunds are processed within 5–7 business days to the original payment method. Please let me know if you require further assistance." },
    ],
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm, casual, conversational",
    preview: [
      { role: "bot",  text: "Hey there! 👋 What can I help you with today?" },
      { role: "user", text: "I haven't received my order yet." },
      { role: "bot",  text: "Oh no, that's frustrating — let's sort it out! Can you share your order number so I can take a look?" },
      { role: "user", text: "It's #84921." },
      { role: "bot",  text: "Got it! 🎉 Your package is on its way and should arrive by tomorrow. You'll get a tracking email shortly. Anything else I can help with?" },
    ],
  },
  {
    value: "technical",
    label: "Technical",
    description: "Detailed, accurate, jargon-aware",
    preview: [
      { role: "bot",  text: "Support ready. What's the issue?" },
      { role: "user", text: "The API returns a 403 on every request." },
      { role: "bot",  text: "A 403 indicates the request is authenticated but lacks the required permission scope. Three likely causes: (1) missing billing:read scope, (2) account tier doesn't include API access, or (3) IP allowlist blocking your origin." },
      { role: "user", text: "How do I check the scope?" },
      { role: "bot",  text: "GET /auth/token/introspect with your bearer token. The response includes a scopes array. If billing:read is absent, regenerate the key under Settings → API → Scopes and re-authenticate." },
    ],
  },
];

const DEFAULT_RULES = ["refund", "legal", "angry", "human agent"];

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewChat({ p, botName }: { p: typeof PERSONALITIES[number]; botName: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 border-b bg-muted/30 px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold">
          {(botName?.[0] ?? "S").toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-none truncate">{botName || "SupportBot"}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI Assistant · Online</p>
        </div>
        <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-violet-400 animate-pulse" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {p.preview.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed break-words
              ${msg.role === "bot"
                ? "bg-background border text-foreground rounded-tl-sm"
                : "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 rounded-tr-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <span className="flex-1 text-xs text-muted-foreground/60 select-none">Type a message…</span>
          <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiConfigPage() {
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [ruleInput, setRuleInput]   = useState("");
  const [preview, setPreview]       = useState<typeof PERSONALITIES[number] | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bot_name: "SupportBot",
      welcome_message: "Hi! How can I help you today?",
      personality: "professional",
      escalation_rules: DEFAULT_RULES,
    },
  });

  const { control, handleSubmit, watch, setValue, formState } = form;
  const escalationRules    = watch("escalation_rules");
  const botName            = watch("bot_name");
  const currentPersonality = watch("personality");

  useEffect(() => {
    api.get<{ business: { id: string } }>("/api/auth/me")
      .then(({ data }) => setBusinessId(data.business.id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<FormValues>("/api/config")
      .then(({ data }) => {
        form.reset({
          bot_name: data.bot_name,
          welcome_message: data.welcome_message,
          personality: data.personality,
          escalation_rules: data.escalation_rules?.length ? data.escalation_rules : DEFAULT_RULES,
        });
        // Don't auto-open preview — only open on explicit user click
      })
      .catch(() => setLoadError("Could not load config. Using defaults — your changes will still save."))
      .finally(() => setLoading(false));
  }, [form]);

  async function onSubmit(values: FormValues) {
    try {
      await api.put("/api/config", values);
      toast.success("Configuration saved");
      // Scroll to widget section so user can copy the link
      setTimeout(() => {
        widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch {
      toast.error("Failed to save configuration");
    }
  }

  function addRule() {
    const trimmed = ruleInput.trim().toLowerCase();
    if (!trimmed || escalationRules.includes(trimmed)) return;
    setValue("escalation_rules", [...escalationRules, trimmed]);
    setRuleInput("");
  }

  function removeRule(rule: string) {
    setValue("escalation_rules", escalationRules.filter((r) => r !== rule));
  }

  function onRuleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addRule(); }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  const widgetUrl = businessId
    ? `${process.env.NEXT_PUBLIC_APP_URL}/widget/${businessId}`
    : null;

  return (
    <div className="flex gap-6 items-start max-w-5xl mx-auto">

      {/* ── Left column: form + widget card ───────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Configuration</h1>
            <p className="text-sm text-muted-foreground mt-1">Customise your bot&apos;s identity and behaviour</p>
          </div>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>

        {loadError && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>{loadError}</span>
          </div>
        )}

        {/* Bot Identity */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Bot Identity</CardTitle>
            <CardDescription>How your assistant presents itself to customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot_name">Bot Name</Label>
              <Controller
                control={control}
                name="bot_name"
                render={({ field, fieldState }) => (
                  <>
                    <Input id="bot_name" placeholder="SupportBot" {...field} />
                    {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                  </>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome_message">Welcome Message</Label>
              <Controller
                control={control}
                name="welcome_message"
                render={({ field, fieldState }) => (
                  <>
                    <Textarea id="welcome_message" placeholder="Hi! How can I help you today?" rows={3} className="resize-none" {...field} />
                    {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                  </>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Personality */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Personality</CardTitle>
            <CardDescription>
              Select a style to set the bot&apos;s tone
              <span className="hidden md:inline"> — click to preview on the right</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="personality"
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {PERSONALITIES.map((p) => {
                    const active = field.value === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          field.onChange(p.value);
                          setPreview(p);
                        }}
                        className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                          ${active
                            ? "border-slate-900 bg-slate-50 dark:border-slate-300 dark:bg-slate-900/40"
                            : "border-border hover:border-slate-300 hover:bg-muted/40"
                          }`}
                      >
                        {active && (
                          <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-200">
                            <svg className="h-3 w-3 text-white dark:text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        )}
                        <p className={`text-sm font-semibold pr-6 ${active ? "text-slate-900 dark:text-slate-100" : "text-foreground"}`}>
                          {p.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground leading-snug">{p.description}</p>
                        <p className="mt-2 text-[10px] text-muted-foreground/50 md:hidden">Tap to preview ↗</p>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </CardContent>
        </Card>

        {/* Escalation Rules */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Escalation Rules</CardTitle>
            <CardDescription>
              When a customer message contains any of these keywords, a support ticket is automatically created
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="min-h-[2.5rem] flex flex-wrap gap-2">
              {escalationRules.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No rules yet — add one below</p>
              ) : (
                escalationRules.map((rule) => (
                  <Badge key={rule} variant="secondary" className="gap-1.5 pr-1.5 text-sm font-normal">
                    {rule}
                    <button
                      type="button"
                      onClick={() => removeRule(rule)}
                      className="rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
                      aria-label={`Remove ${rule}`}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <Separator />
            <div className="flex gap-2">
              <Input
                placeholder="e.g. billing issue"
                value={ruleInput}
                onChange={(e) => setRuleInput(e.target.value)}
                onKeyDown={onRuleKeyDown}
                className="flex-1 min-w-0"
              />
              <Button type="button" variant="outline" onClick={addRule} disabled={!ruleInput.trim()} className="shrink-0">
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Press Enter or click Add. Keywords are matched case-insensitively.</p>
          </CardContent>
        </Card>

        {/* Widget Embed — inside left column so it's properly constrained on all screen sizes */}
        {businessId && widgetUrl && (
          <div ref={widgetRef}><Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Widget</CardTitle>
              <CardDescription>Share this link or embed the widget on any website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Direct widget URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 text-xs bg-muted px-3 py-2 rounded-md truncate block">
                    {widgetUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(widgetUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Embed snippet</p>
                <pre className="text-xs bg-muted px-3 py-2 rounded-md overflow-x-auto break-all whitespace-pre-wrap">{`<iframe\n  src="${widgetUrl}"\n  width="400"\n  height="600"\n  frameborder="0"\n/>`}</pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Business ID</p>
                <code className="text-xs bg-muted px-3 py-2 rounded-md block break-all">{businessId}</code>
              </div>
            </CardContent>
          </Card></div>
        )}

      </div>

      {/* ── Right column: desktop sticky preview panel ────────────────────── */}
      <div
        className={`hidden md:flex flex-col rounded-2xl border bg-card overflow-hidden sticky top-6
          transition-all duration-300 ease-in-out shrink-0
          ${preview ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none border-0"}`}
        style={{ height: "calc(100vh - 8rem)" }}
      >
        {preview && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
                <span className="text-sm font-semibold truncate">{preview.label} Preview</span>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 ml-2"
                aria-label="Close preview"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <PreviewChat p={preview} botName={botName} />
            </div>
          </>
        )}
      </div>

      {/* ── Mobile preview dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
      >
        <DialogContent className="md:hidden max-w-[calc(100vw-2rem)] w-full p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />
              {preview?.label} Preview
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{preview?.description}</p>
          </DialogHeader>
          <div style={{ height: "360px" }} className="mx-4 my-4 rounded-xl border overflow-hidden flex flex-col">
            {preview && <PreviewChat p={preview} botName={botName} />}
          </div>
          <div className="px-5 pb-5 flex justify-end">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPreview(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

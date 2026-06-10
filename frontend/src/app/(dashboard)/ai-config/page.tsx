"use client";

import { useEffect, useState, KeyboardEvent } from "react";
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
import api from "@/lib/api";

// ─── Types / Schema ──────────────────────────────────────────────────────────

const schema = z.object({
  bot_name: z.string().min(1, "Bot name is required"),
  welcome_message: z.string().min(1, "Welcome message is required"),
  personality: z.enum(["professional", "friendly", "technical"]),
  escalation_rules: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const PERSONALITIES = [
  {
    value: "professional" as const,
    label: "Professional",
    description: "Formal, precise, business-focused",
  },
  {
    value: "friendly" as const,
    label: "Friendly",
    description: "Warm, casual, conversational",
  },
  {
    value: "technical" as const,
    label: "Technical",
    description: "Detailed, accurate, jargon-aware",
  },
];

const DEFAULT_RULES = ["refund", "legal", "angry", "human agent"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AiConfigPage() {
  const [loading, setLoading] = useState(true);
  const [ruleInput, setRuleInput] = useState("");

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
  const escalationRules = watch("escalation_rules");

  // ── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    api
      .get<FormValues>("/api/config")
      .then(({ data }) => {
        form.reset({
          bot_name: data.bot_name,
          welcome_message: data.welcome_message,
          personality: data.personality,
          escalation_rules:
            data.escalation_rules?.length ? data.escalation_rules : DEFAULT_RULES,
        });
      })
      .catch(() => toast.error("Failed to load config"))
      .finally(() => setLoading(false));
  }, [form]);

  // ── Save ───────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    try {
      await api.put("/api/config", values);
      toast.success("Configuration saved");
    } catch {
      toast.error("Failed to save configuration");
    }
  }

  // ── Escalation rules helpers ───────────────────────────────────────────────

  function addRule() {
    const trimmed = ruleInput.trim().toLowerCase();
    if (!trimmed || escalationRules.includes(trimmed)) return;
    setValue("escalation_rules", [...escalationRules, trimmed]);
    setRuleInput("");
  }

  function removeRule(rule: string) {
    setValue(
      "escalation_rules",
      escalationRules.filter((r) => r !== rule)
    );
  }

  function onRuleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRule();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="h-6 w-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Configuration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customise your bot&apos;s identity and behaviour
          </p>
        </div>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Identity */}
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
                  {fieldState.error && (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  )}
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
                  <Textarea
                    id="welcome_message"
                    placeholder="Hi! How can I help you today?"
                    rows={3}
                    className="resize-none"
                    {...field}
                  />
                  {fieldState.error && (
                    <p className="text-xs text-destructive">{fieldState.error.message}</p>
                  )}
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
          <CardDescription>Sets the tone and style of your bot&apos;s responses</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="personality"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-3">
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => field.onChange(p.value)}
                    className={`rounded-lg border-2 p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      ${field.value === p.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                  >
                    <p className={`text-sm font-semibold ${field.value === p.value ? "text-primary" : ""}`}>
                      {p.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-snug">
                      {p.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Escalation rules */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Escalation Rules</CardTitle>
          <CardDescription>
            When a customer message contains any of these keywords, a support ticket is
            automatically created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tag list */}
          <div className="min-h-[2.5rem] flex flex-wrap gap-2">
            {escalationRules.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No rules yet — add one below</p>
            ) : (
              escalationRules.map((rule) => (
                <Badge
                  key={rule}
                  variant="secondary"
                  className="gap-1.5 pr-1.5 text-sm font-normal"
                >
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

          {/* Add rule */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. billing issue"
              value={ruleInput}
              onChange={(e) => setRuleInput(e.target.value)}
              onKeyDown={onRuleKeyDown}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addRule} disabled={!ruleInput.trim()}>
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Press Enter or click Add. Keywords are matched case-insensitively.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}

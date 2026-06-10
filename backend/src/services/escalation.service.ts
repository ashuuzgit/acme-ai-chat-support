const ESCALATION_KEYWORDS: Record<string, string[]> = {
  urgent: ["lawsuit", "legal action", "lawyer", "sue"],
  high: ["refund", "payment failed", "charge", "outage", "not working"],
  medium: ["angry", "frustrated", "speak to human", "manager", "human agent"],
  low: ["complaint", "unhappy", "disappointed"],
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];

export function detectEscalation(
  message: string,
  customRules: string[]
): string | null {
  const lower = message.toLowerCase();

  for (const priority of PRIORITY_ORDER) {
    for (const keyword of ESCALATION_KEYWORDS[priority]) {
      if (lower.includes(keyword)) return priority;
    }
  }

  for (const rule of customRules ?? []) {
    if (rule && lower.includes(rule.toLowerCase())) return "medium";
  }

  return null;
}

const ESCALATION_KEYWORDS: Record<string, string[]> = {
  urgent: ["lawsuit", "legal action", "lawyer", "sue", "legal complaint", "legal concern", "attorney"],
  high: ["refund", "payment failed", "charge", "outage", "not working", "want my money", "cancel subscription", "demand refund"],
  medium: ["angry", "frustrated", "unacceptable", "speak to human", "talk to human", "human agent", "manager", "supervisor", "escalate", "complaint"],
  low: ["unhappy", "disappointed", "not satisfied", "poor service"],
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;

export function detectEscalation(
  message: string,
  customRules: string[]
): string | null {
  const lower = message.toLowerCase();

  for (const priority of PRIORITY_ORDER) {
    for (const keyword of ESCALATION_KEYWORDS[priority]) {
      if (lower.includes(keyword)) {
        console.log(`[escalation] triggered "${keyword}" → ${priority}`);
        return priority;
      }
    }
  }

  for (const rule of customRules ?? []) {
    if (rule && lower.includes(rule.toLowerCase())) {
      console.log(`[escalation] custom rule "${rule}" → medium`);
      return "medium";
    }
  }

  return null;
}

export type GoalExplanationItem = {
  polarity: 'negative' | 'positive';
  goal: string | null;
  text: string;
};

export type GoalExplanation = {
  items: GoalExplanationItem[];
};

function normalizePossibleJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;

  const withoutFirstFence = trimmed.replace(/^```(?:json)?\s*/i, '');
  return withoutFirstFence.replace(/\s*```$/, '').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseGoalExplanation(raw: string | null | undefined): GoalExplanation | null {
  if (!raw?.trim()) return null;

  const normalized = normalizePossibleJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;

  const items: GoalExplanationItem[] = [];
  for (const row of parsed.items) {
    if (!isRecord(row)) return null;

    const polarity = row.polarity;
    const text = row.text;
    const goal = row.goal;
    if (polarity !== 'negative' && polarity !== 'positive') return null;
    if (typeof text !== 'string' || !text.trim()) return null;

    items.push({
      polarity,
      text: text.trim(),
      goal: typeof goal === 'string' && goal.trim() ? goal.trim() : null,
    });
  }

  if (items.length === 0) return null;

  items.sort((left, right) => {
    if (left.polarity === right.polarity) return 0;
    return left.polarity === 'negative' ? -1 : 1;
  });

  return { items };
}

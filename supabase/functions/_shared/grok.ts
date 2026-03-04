const model = Deno.env.get('XAI_MODEL') ?? 'grok-2-latest';
const apiKey = Deno.env.get('XAI_API_KEY');

export type GrokExplanationItem = {
  polarity: 'negative' | 'positive';
  goal: string | null;
  text: string;
};

export type GrokExplanationPayload = {
  items: GrokExplanationItem[];
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

export function parseGrokExplanation(raw: string): GrokExplanationPayload | null {
  const normalized = normalizePossibleJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) return null;

  const items: GrokExplanationItem[] = [];
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

export async function generateGrokExplanation(prompt: string): Promise<string> {
  if (!apiKey) {
    return '{"items":[{"polarity":"negative","goal":null,"text":"AI explanation unavailable because XAI_API_KEY is not configured."}]}';
  }

  const start = Date.now();
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise nutrition assistant. Return ONLY valid JSON. No markdown. No prose outside JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const text = await response.text();
    console.error('Grok call failed', { status: response.status, latencyMs, body: text });
    return 'AI explanation is temporarily unavailable. Please try regenerate later.';
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;

  console.log('Grok success', { latencyMs });

  return typeof content === 'string' && content.trim()
    ? content.trim()
    : 'AI explanation returned no content. Please try regenerate later.';
}

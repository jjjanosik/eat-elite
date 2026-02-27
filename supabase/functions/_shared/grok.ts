const model = Deno.env.get('XAI_MODEL') ?? 'grok-2-latest';
const apiKey = Deno.env.get('XAI_API_KEY');

export async function generateGrokExplanation(prompt: string): Promise<string> {
  if (!apiKey) {
    return 'AI explanation unavailable because XAI_API_KEY is not configured. Score was still calculated and saved.';
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
            'You are a concise nutrition assistant. Keep responses factual, practical, and non-medical. Max 120 words.',
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

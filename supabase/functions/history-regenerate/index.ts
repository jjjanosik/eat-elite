import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { generateGrokExplanation } from '../_shared/grok.ts';
import { enforceRateLimit, getBucketStart } from '../_shared/rate-limit.ts';
import { parseJsonObject } from '../_shared/validation.ts';

function buildPrompt(input: {
  score: number;
  dietType: string;
  goals: string[];
  outcomes: string[];
  nutrients: Record<string, unknown>;
  additivesCount: number;
  productName: string;
}) {
  return [
    `Product: ${input.productName}`,
    `Score: ${input.score}/100`,
    `Diet type: ${input.dietType || 'unknown'}`,
    `Goals: ${input.goals.join(', ') || 'none'}`,
    `Outcomes: ${input.outcomes.join(', ') || 'none'}`,
    `Additives count: ${input.additivesCount}`,
    `Nutriments: ${JSON.stringify(input.nutrients)}`,
    'Explain score drivers and list 2 practical tips for healthier alternatives.',
    'Do not provide medical advice.',
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const requestStart = Date.now();

  const { user, supabase, errorResponse } = await requireUser(req);
  if (errorResponse || !user) return errorResponse!;

  const parsed = await parseJsonObject(req);
  if ('error' in parsed) return parsed.error;
  const body = parsed.body as { history_id?: string };

  if (!body.history_id) {
    return jsonResponse({ error: 'history_id_required' }, 400);
  }

  try {
    await enforceRateLimit({
      supabase,
      userId: user.id,
      counterType: 'regen_hourly',
      bucketStart: getBucketStart('regen_hourly'),
      maxCount: 50,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'rate_limit_exceeded') {
      return jsonResponse({ error: 'rate_limit_exceeded', detail: 'Max 50 AI regenerations per hour.' }, 429);
    }
    console.error('rate limit failure', error);
    return jsonResponse({ error: 'rate_limit_failed' }, 500);
  }

  const [{ data: historyItem, error: historyError }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from('scan_history')
      .select('id, score, barcode, inputs_snapshot')
      .eq('id', body.history_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('user_profiles').select('diet_type, diet_goals, outcomes').eq('user_id', user.id).maybeSingle(),
  ]);

  if (historyError) {
    console.error('history lookup failed', historyError);
    return jsonResponse({ error: 'history_lookup_failed' }, 500);
  }

  if (profileError) {
    console.error('profile lookup failed', profileError);
    return jsonResponse({ error: 'profile_lookup_failed' }, 500);
  }

  if (!historyItem) {
    return jsonResponse({ error: 'history_not_found' }, 404);
  }

  const snapshot = (historyItem.inputs_snapshot ?? {}) as Record<string, unknown>;
  const immutableProductName =
    typeof snapshot.product_name === 'string' && snapshot.product_name.trim()
      ? snapshot.product_name
      : historyItem.barcode;
  const prompt = buildPrompt({
    score: historyItem.score,
    dietType: String(profile?.diet_type ?? ''),
    goals: Array.isArray(profile?.diet_goals) ? (profile?.diet_goals as string[]) : [],
    outcomes: Array.isArray(profile?.outcomes) ? (profile?.outcomes as string[]) : [],
    nutrients: (snapshot.nutriments ?? {}) as Record<string, unknown>,
    additivesCount: Number(snapshot.additives_count ?? 0),
    productName: immutableProductName,
  });

  const aiResponse = await generateGrokExplanation(prompt);

  const { error: updateError } = await supabase
    .from('scan_history')
    .update({ ai_response: aiResponse, ai_cached: false })
    .eq('id', historyItem.id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('history update failed', updateError);
    return jsonResponse({ error: 'history_update_failed' }, 500);
  }

  console.log('history regenerate completed', {
    userId: user.id,
    historyId: historyItem.id,
    totalLatencyMs: Date.now() - requestStart,
  });

  return jsonResponse({ id: historyItem.id, ai_response: aiResponse });
});

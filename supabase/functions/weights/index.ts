import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseJsonObject } from '../_shared/validation.ts';

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const { user, supabase, errorResponse } = await requireUser(req);
  if (errorResponse || !user) return errorResponse!;

  const parsed = await parseJsonObject(req);
  if ('error' in parsed) return parsed.error;
  const body = parsed.body;

  const nutritionWeight = toInt(body.nutrition_weight);
  const additivesWeight = toInt(body.additives_weight);

  if (nutritionWeight === null || additivesWeight === null) {
    return jsonResponse({ error: 'invalid_weight_payload' }, 400);
  }

  if (nutritionWeight < 0 || nutritionWeight > 100 || additivesWeight < 0 || additivesWeight > 100) {
    return jsonResponse({ error: 'weights_out_of_range' }, 400);
  }

  if (nutritionWeight + additivesWeight !== 100) {
    return jsonResponse({ error: 'weights_must_sum_to_100' }, 400);
  }

  const nutritionSubweights =
    typeof body.nutrition_subweights === 'object' && body.nutrition_subweights && !Array.isArray(body.nutrition_subweights)
      ? body.nutrition_subweights
      : {};

  const additivesSubweights =
    typeof body.additives_subweights === 'object' && body.additives_subweights && !Array.isArray(body.additives_subweights)
      ? body.additives_subweights
      : {};

  const { data: existing, error: existingError } = await supabase
    .from('user_score_weights')
    .select('id, score_version, weights_version')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) {
    console.error('weights fetch failed', existingError);
    return jsonResponse({ error: 'weights_fetch_failed' }, 500);
  }

  const next = {
    id: existing?.id,
    user_id: user.id,
    score_version: 1,
    weights_version: existing ? existing.weights_version + 1 : 1,
    nutrition_weight: nutritionWeight,
    additives_weight: additivesWeight,
    nutrition_subweights: nutritionSubweights,
    additives_subweights: additivesSubweights,
  };

  const { data, error } = await supabase
    .from('user_score_weights')
    .upsert(next, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    console.error('weights upsert failed', error);
    return jsonResponse({ error: 'weights_upsert_failed' }, 500);
  }

  return jsonResponse({ weights: data });
});

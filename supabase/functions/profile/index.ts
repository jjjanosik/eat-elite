import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseJsonObject } from '../_shared/validation.ts';

const SEX_VALUES = new Set(['male', 'female', 'other']);
const DIET_VALUES = new Set(['classic', 'vegetarian', 'vegan', 'pescetarian']);

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

  const update: Record<string, unknown> = { user_id: user.id };

  if (body.sex !== undefined) {
    if (body.sex !== null && !SEX_VALUES.has(String(body.sex))) {
      return jsonResponse({ error: 'invalid_sex' }, 400);
    }
    update.sex = body.sex;
  }

  if (body.birthdate !== undefined) {
    if (body.birthdate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.birthdate))) {
      return jsonResponse({ error: 'invalid_birthdate' }, 400);
    }
    update.birthdate = body.birthdate;
  }

  if (body.diet_type !== undefined) {
    if (body.diet_type !== null && !DIET_VALUES.has(String(body.diet_type))) {
      return jsonResponse({ error: 'invalid_diet_type' }, 400);
    }
    update.diet_type = body.diet_type;
  }

  if (body.diet_goals !== undefined) {
    if (!Array.isArray(body.diet_goals)) {
      return jsonResponse({ error: 'invalid_diet_goals' }, 400);
    }
    update.diet_goals = body.diet_goals;
  }

  if (body.outcomes !== undefined) {
    if (!Array.isArray(body.outcomes)) {
      return jsonResponse({ error: 'invalid_outcomes' }, 400);
    }
    update.outcomes = body.outcomes;
  }

  if (body.notifications_enabled !== undefined) {
    update.notifications_enabled = Boolean(body.notifications_enabled);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(update, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    console.error('profile upsert failed', error);
    return jsonResponse({ error: 'profile_upsert_failed' }, 500);
  }

  return jsonResponse({ profile: data });
});

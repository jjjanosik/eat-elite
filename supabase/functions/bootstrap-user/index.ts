import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseJsonObject, validateOnboardingPayload } from '../_shared/validation.ts';

function hasRequiredProfileFields(profile: Record<string, unknown> | null): boolean {
  return Boolean(profile?.sex && profile?.birthdate && profile?.diet_type);
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

  const fromOnboarding = Boolean(parsed.body.from_onboarding);
  const onboardingPayload = parsed.body.onboarding;

  const [{ data: profileData, error: profileError }, { data: weightsData, error: weightsError }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('user_score_weights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileError) {
    console.error('bootstrap profile fetch failed', profileError);
    return jsonResponse({ error: 'profile_fetch_failed' }, 500);
  }

  if (weightsError) {
    console.error('bootstrap weights fetch failed', weightsError);
    return jsonResponse({ error: 'weights_fetch_failed' }, 500);
  }

  let profile = (profileData as Record<string, unknown> | null) ?? null;
  let synced = false;

  if (!hasRequiredProfileFields(profile) && fromOnboarding) {
    const validated = validateOnboardingPayload(onboardingPayload);
    if ('error' in validated) return validated.error;

    if (!validated.value.sex || !validated.value.birthdate || !validated.value.diet_type) {
      return jsonResponse({ error: 'onboarding_incomplete' }, 400);
    }

    const { data: upsertedProfile, error: upsertProfileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          sex: validated.value.sex,
          birthdate: validated.value.birthdate,
          diet_type: validated.value.diet_type,
          diet_goals: validated.value.diet_goals,
          outcomes: validated.value.outcomes,
          notifications_enabled: validated.value.notifications_enabled,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (upsertProfileError) {
      console.error('bootstrap profile upsert failed', upsertProfileError);
      return jsonResponse({ error: 'profile_upsert_failed' }, 500);
    }

    profile = upsertedProfile as Record<string, unknown>;
    synced = true;
  }

  let weights = (weightsData as Record<string, unknown> | null) ?? null;

  if (!weights) {
    const { data: upsertedWeights, error: upsertWeightsError } = await supabase
      .from('user_score_weights')
      .upsert(
        {
          user_id: user.id,
          score_version: 1,
          weights_version: 1,
          nutrition_weight: 70,
          additives_weight: 30,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (upsertWeightsError) {
      console.error('bootstrap weights upsert failed', upsertWeightsError);
      return jsonResponse({ error: 'weights_upsert_failed' }, 500);
    }

    weights = upsertedWeights as Record<string, unknown>;
  }

  return jsonResponse({
    profile,
    weights,
    needs_onboarding: !hasRequiredProfileFields(profile),
    synced,
  });
});

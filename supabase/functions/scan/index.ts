import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, requireUser } from '../_shared/auth.ts';
import { extractServingInfoFromOffPayload, fetchOpenFoodFactsProduct } from '../_shared/off.ts';
import { computeScore } from '../_shared/scoring.ts';
import { parseGrokExplanation } from '../_shared/grok.ts';
import { enforceRateLimit, getBucketStart } from '../_shared/rate-limit.ts';
import { isRecord, parseJsonObject } from '../_shared/validation.ts';

const PRODUCT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function logCheckpoint(requestId: string, checkpoint: string, details: Record<string, unknown> = {}) {
  console.log('scan checkpoint', {
    requestId,
    checkpoint,
    ...details,
  });
}

function logFailure(requestId: string, checkpoint: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error('scan failure', {
    requestId,
    checkpoint,
    ...details,
    error,
  });
}

function normalizeBarcode(raw: string): string {
  return raw.replace(/[^0-9]/g, '').trim();
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    logCheckpoint(requestId, 'preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  logCheckpoint(requestId, 'request_received', {
    method: req.method,
    hasAuthorizationHeader: Boolean(req.headers.get('Authorization')),
  });

  if (req.method !== 'POST') {
    logCheckpoint(requestId, 'method_not_allowed', { method: req.method });
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const requestStart = Date.now();

  const { user, supabase, errorResponse } = await requireUser(req);
  if (errorResponse || !user) {
    logCheckpoint(requestId, 'auth_failed');
    return errorResponse!;
  }
  logCheckpoint(requestId, 'auth_ok', { userId: user.id });

  const parsedBody = await parseJsonObject(req);
  if ('error' in parsedBody) {
    logCheckpoint(requestId, 'invalid_json');
    return parsedBody.error;
  }
  const body = parsedBody.body as { barcode?: string };

  const barcode = normalizeBarcode(body.barcode ?? '');
  if (!barcode) {
    logCheckpoint(requestId, 'barcode_required');
    return jsonResponse({ error: 'barcode_required' }, 400);
  }
  logCheckpoint(requestId, 'barcode_received', { barcode });

  try {
    logCheckpoint(requestId, 'rate_limit_check_start');
    await enforceRateLimit({
      supabase,
      userId: user.id,
      counterType: 'scan_monthly',
      bucketStart: getBucketStart('scan_monthly'),
      maxCount: 1000,
    });
    logCheckpoint(requestId, 'rate_limit_check_ok');
  } catch (error) {
    if (error instanceof Error && error.message === 'rate_limit_exceeded') {
      logFailure(requestId, 'rate_limit_exceeded', error);
      return jsonResponse({ error: 'rate_limit_exceeded', detail: 'Max 1000 scans per month.' }, 429);
    }
    logFailure(requestId, 'rate_limit_failed', error);
    return jsonResponse({ error: 'rate_limit_failed' }, 500);
  }

  let adminSupabase;
  try {
    adminSupabase = getAdminClient();
  } catch (error) {
    logFailure(requestId, 'admin_client_init_failed', error);
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  const offStart = Date.now();
  logCheckpoint(requestId, 'product_cache_lookup_start');
  const { data: cachedProduct, error: cachedProductError } = await adminSupabase
    .from('products')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();

  if (cachedProductError) {
    logFailure(requestId, 'product_cache_lookup_failed', cachedProductError);
    return jsonResponse({ error: 'product_lookup_failed' }, 500);
  }

  const isFresh =
    !!cachedProduct?.source_last_fetched_at &&
    Date.now() - new Date(cachedProduct.source_last_fetched_at).getTime() < PRODUCT_TTL_MS;
  logCheckpoint(requestId, 'product_cache_lookup_ok', {
    cached: Boolean(cachedProduct),
    isFresh,
  });

  let product = cachedProduct;
  let offHit = false;

  if (!cachedProduct || !isFresh) {
    offHit = true;
    let offProduct;
    try {
      logCheckpoint(requestId, 'off_fetch_start');
      offProduct = await fetchOpenFoodFactsProduct(barcode);
    } catch (error) {
      logFailure(requestId, 'off_fetch_failed', error);
      return jsonResponse({ error: 'product_fetch_failed' }, 502);
    }
    if (!offProduct) {
      logCheckpoint(requestId, 'off_product_not_found');
      return jsonResponse({ error: 'product_not_found' }, 404);
    }
    logCheckpoint(requestId, 'off_fetch_ok', {
      productName: offProduct.name ?? null,
      additivesCount: offProduct.additives_tags.length,
    });

    const upsertPayload = {
      barcode: offProduct.barcode,
      name: offProduct.name,
      brands: offProduct.brands,
      image_url: offProduct.image_url,
      ingredients_text: offProduct.ingredients_text,
      additives_tags: offProduct.additives_tags,
      nutriments: offProduct.nutriments,
      off_payload: offProduct.off_payload,
      source: 'OFF',
      source_last_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await adminSupabase
      .from('products')
      .upsert(upsertPayload, { onConflict: 'barcode' })
      .select('*')
      .single();

    if (upsertError) {
      logFailure(requestId, 'product_upsert_failed', upsertError);
      return jsonResponse({ error: 'product_upsert_failed' }, 500);
    }

    product = upserted;
    logCheckpoint(requestId, 'product_upsert_ok');
  }

  const servingInfo = extractServingInfoFromOffPayload(isRecord(product?.off_payload) ? product.off_payload : {});

  logCheckpoint(requestId, 'profile_weights_lookup_start');
  const [{ data: profile, error: profileError }, { data: weights, error: weightsError }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('user_score_weights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  logCheckpoint(requestId, 'profile_weights_lookup_ok', {
    hasProfile: Boolean(profile),
    hasWeights: Boolean(weights),
  });

  if (profileError) {
    logFailure(requestId, 'profile_lookup_failed', profileError);
    return jsonResponse({ error: 'profile_lookup_failed' }, 500);
  }

  if (!profile?.sex || !profile?.birthdate || !profile?.diet_type) {
    logCheckpoint(requestId, 'onboarding_incomplete', {
      hasSex: Boolean(profile?.sex),
      hasBirthdate: Boolean(profile?.birthdate),
      hasDietType: Boolean(profile?.diet_type),
    });
    return jsonResponse({ error: 'onboarding_incomplete' }, 400);
  }

  if (weightsError) {
    logFailure(requestId, 'weights_lookup_failed', weightsError);
    return jsonResponse({ error: 'weights_lookup_failed' }, 500);
  }

  let activeWeights = weights;
  if (!activeWeights) {
    logCheckpoint(requestId, 'weights_default_create_start');
    const { data: upsertedWeights, error: upsertedWeightsError } = await supabase
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

    if (upsertedWeightsError) {
      logFailure(requestId, 'weights_default_create_failed', upsertedWeightsError);
      return jsonResponse({ error: 'weights_default_create_failed' }, 500);
    }

    activeWeights = upsertedWeights;
    logCheckpoint(requestId, 'weights_default_create_ok');
  }

  if (!activeWeights) {
    logCheckpoint(requestId, 'weights_missing');
    return jsonResponse({ error: 'weights_missing' }, 500);
  }

  logCheckpoint(requestId, 'scoring_start');
  const scoring = computeScore({
    nutriments: (product?.nutriments ?? {}) as Record<string, unknown>,
    additivesTags: Array.isArray(product?.additives_tags) ? (product?.additives_tags as string[]) : [],
    weights: {
      nutritionWeight: activeWeights.nutrition_weight,
      additivesWeight: activeWeights.additives_weight,
    },
  });
  logCheckpoint(requestId, 'scoring_ok', {
    score: scoring.score,
    nutritionScore: scoring.nutritionScore,
    additivesScore: scoring.additivesScore,
  });

  const inputsSnapshot = {
    product_name: product?.name ?? null,
    product_brands: product?.brands ?? null,
    product_image_url: product?.image_url ?? null,
    ingredients_text: product?.ingredients_text ?? null,
    nutriments: product?.nutriments ?? {},
    serving_size: servingInfo.serving_size,
    serving_quantity: servingInfo.serving_quantity,
    package_quantity: servingInfo.package_quantity,
    nutrition_data_per: servingInfo.nutrition_data_per,
    additives_tags: product?.additives_tags ?? [],
    additives_count: scoring.additivesCount,
    nutrition_score: scoring.nutritionScore,
    additives_score: scoring.additivesScore,
    score_features: scoring.features,
    weights: {
      nutrition_weight: activeWeights.nutrition_weight,
      additives_weight: activeWeights.additives_weight,
      nutrition_subweights: activeWeights.nutrition_subweights,
      additives_subweights: activeWeights.additives_subweights,
    },
    goals: profile.diet_goals,
    outcomes: profile.outcomes,
  };

  const { data: lastHistoryWithSameBarcode } = await supabase
    .from('scan_history')
    .select('ai_response')
    .eq('user_id', user.id)
    .eq('barcode', barcode)
    .not('ai_response', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cachedAiResponseRaw =
    typeof lastHistoryWithSameBarcode?.ai_response === 'string'
      ? lastHistoryWithSameBarcode.ai_response
      : null;
  const parsedCachedAiResponse = cachedAiResponseRaw ? parseGrokExplanation(cachedAiResponseRaw) : null;
  const aiResponse = parsedCachedAiResponse ? JSON.stringify(parsedCachedAiResponse) : null;
  const aiCached = aiResponse !== null;
  const aiPending = !aiCached;
  const aiError: string | null = null;
  logCheckpoint(requestId, 'ai_lookup_ok', { aiCached, aiPending });

  logCheckpoint(requestId, 'history_insert_start');
  const { data: history, error: historyError } = await supabase
    .from('scan_history')
    .insert({
      user_id: user.id,
      barcode,
      score: scoring.score,
      score_version: 1,
      weights_version: activeWeights.weights_version,
      inputs_snapshot: inputsSnapshot,
      ai_model: 'grok',
      ai_response: aiResponse,
      ai_cached: aiCached,
    })
    .select('id')
    .single();

  if (historyError) {
    logFailure(requestId, 'history_insert_failed', historyError);
    return jsonResponse({ error: 'history_insert_failed' }, 500);
  }
  logCheckpoint(requestId, 'history_insert_ok', { historyId: history.id });

  logCheckpoint(requestId, 'scan_completed', {
    userId: user.id,
    barcode,
    offCacheHit: !offHit,
    offLatencyMs: Date.now() - offStart,
    aiPending,
    totalLatencyMs: Date.now() - requestStart,
  });

  return jsonResponse({
    history_id: history.id,
    product: {
      barcode: product?.barcode,
      name: product?.name,
      brands: product?.brands,
      image_url: product?.image_url,
      ingredients_text: product?.ingredients_text,
      serving_size: servingInfo.serving_size,
      serving_quantity: servingInfo.serving_quantity,
      package_quantity: servingInfo.package_quantity,
      nutrition_data_per: servingInfo.nutrition_data_per,
      additives_tags: product?.additives_tags ?? [],
      nutriments: product?.nutriments ?? {},
    },
    score: scoring.score,
    ai_response: aiResponse,
    ai_cached: aiCached,
    ai_pending: aiPending,
    ai_error: aiError,
    score_version: 1,
    weights_version: activeWeights.weights_version,
  });
});

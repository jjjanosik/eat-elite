import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { extractServingInfoFromOffPayload } from '../_shared/off.ts';
import { isRecord, parseJsonObject } from '../_shared/validation.ts';

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

  const historyId = typeof parsed.body.history_id === 'string' ? parsed.body.history_id.trim() : '';
  if (!historyId) {
    return jsonResponse({ error: 'history_id_required' }, 400);
  }

  const { data, error } = await supabase
    .from('scan_history')
    .select(
      'id, barcode, score, score_version, weights_version, ai_response, ai_cached, created_at, inputs_snapshot, products(name, brands, image_url, ingredients_text, additives_tags, nutriments, off_payload)',
    )
    .eq('id', historyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('history item query failed', error);
    return jsonResponse({ error: 'history_item_fetch_failed' }, 500);
  }

  if (!data) {
    return jsonResponse({ error: 'history_item_not_found' }, 404);
  }

  const snapshot = isRecord(data.inputs_snapshot) ? data.inputs_snapshot : {};
  const productRelation = Array.isArray(data.products) ? data.products[0] : data.products;
  const productRecord = isRecord(productRelation) ? productRelation : null;
  const servingInfo = extractServingInfoFromOffPayload(productRecord?.off_payload);

  const product = productRecord
    ? {
        name: typeof snapshot.product_name === 'string' ? snapshot.product_name : (productRecord.name as string | null) ?? null,
        brands:
          typeof snapshot.product_brands === 'string'
            ? snapshot.product_brands
            : (productRecord.brands as string | null) ?? null,
        image_url:
          typeof snapshot.product_image_url === 'string'
            ? snapshot.product_image_url
            : (productRecord.image_url as string | null) ?? null,
        ingredients_text:
          typeof snapshot.ingredients_text === 'string'
            ? snapshot.ingredients_text
            : (productRecord.ingredients_text as string | null) ?? null,
        serving_size:
          typeof snapshot.serving_size === 'string'
            ? snapshot.serving_size
            : servingInfo.serving_size,
        serving_quantity:
          asNullableNumber(snapshot.serving_quantity) ?? servingInfo.serving_quantity,
        package_quantity:
          typeof snapshot.package_quantity === 'string'
            ? snapshot.package_quantity
            : servingInfo.package_quantity,
        nutrition_data_per:
          typeof snapshot.nutrition_data_per === 'string'
            ? snapshot.nutrition_data_per
            : servingInfo.nutrition_data_per,
        additives_tags:
          snapshot.additives_tags && Array.isArray(snapshot.additives_tags)
            ? asStringArray(snapshot.additives_tags)
            : asStringArray(productRecord.additives_tags),
        nutriments:
          snapshot.nutriments && isRecord(snapshot.nutriments)
            ? snapshot.nutriments
            : (isRecord(productRecord.nutriments) ? productRecord.nutriments : {}),
      }
    : null;

  return jsonResponse({
    id: data.id,
    barcode: data.barcode,
    score: data.score,
    score_version: data.score_version,
    weights_version: data.weights_version,
    ai_response: data.ai_response,
    ai_cached: data.ai_cached,
    created_at: data.created_at,
    inputs_snapshot: snapshot,
    product,
  });
});

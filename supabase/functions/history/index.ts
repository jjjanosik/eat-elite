import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseBoundedInt, parseJsonObject } from '../_shared/validation.ts';

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
  const limit = parseBoundedInt(parsed.body.limit, 50, 1, 200);

  const { data, error } = await supabase
    .from('scan_history')
    .select('id, score, created_at, products(name, brands, image_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('history query failed', error);
    return jsonResponse({ error: 'history_fetch_failed' }, 500);
  }

  const items = (data ?? []).map((item) => ({
    id: item.id,
    score: item.score,
    created_at: item.created_at,
    product: Array.isArray(item.products)
      ? item.products[0]
      : item.products,
  }));

  return jsonResponse({ items });
});

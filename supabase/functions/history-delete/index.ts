import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { parseJsonObject } from '../_shared/validation.ts';

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

  const { error } = await supabase.from('scan_history').delete().eq('id', historyId).eq('user_id', user.id);
  if (error) {
    console.error('history delete failed', error);
    return jsonResponse({ error: 'history_delete_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});

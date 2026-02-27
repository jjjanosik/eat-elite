import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getAdminClient, requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const { user, errorResponse } = await requireUser(req);
  if (errorResponse || !user) return errorResponse!;

  let admin;
  try {
    admin = getAdminClient();
  } catch (error) {
    console.error('admin client init failed', error);
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete user failed', error);
    return jsonResponse({ error: 'delete_user_failed' }, 500);
  }

  return jsonResponse({ ok: true });
});

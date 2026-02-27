import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { jsonResponse } from './cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.');
}

export function getUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

export function getAdminClient() {
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY env var.');
  }
  return createClient(supabaseUrl!, serviceRoleKey);
}

export async function requireUser(req: Request) {
  const supabase = getUserClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      supabase,
      errorResponse: jsonResponse({ error: 'unauthorized' }, 401),
    };
  }

  return {
    user: data.user,
    supabase,
    errorResponse: null,
  };
}

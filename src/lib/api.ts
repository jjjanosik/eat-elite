import { supabase } from '@/lib/supabase';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import {
  parseHistoryDetailResponse,
  parseHistoryListResponse,
  parseScanResult,
} from '@/lib/contracts';
import type {
  HistoryDetailItem,
  HistoryListItem,
  OnboardingAnswers,
  ScanResult,
  UserProfile,
  UserScoreWeights,
} from '@/lib/types';

type BootstrapUserResult = {
  profile: UserProfile | null;
  weights: UserScoreWeights | null;
  needs_onboarding: boolean;
  synced: boolean;
};

function needsOnboarding(profile: UserProfile | null): boolean {
  return !profile?.sex || !profile?.birthdate || !profile?.diet_type;
}

async function unwrapError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    let detail = '';

    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const json = await response.clone().json();
        detail = typeof json === 'string' ? json : JSON.stringify(json);
      } else {
        detail = await response.clone().text();
      }
    } catch {
      detail = '';
    }

    const statusPart = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    return new Error(detail ? `${fallback} (${statusPart}): ${detail}` : `${fallback} (${statusPart}).`);
  }

  if (error instanceof FunctionsRelayError) {
    return new Error(`${fallback}: Relay error invoking edge function.`);
  }

  if (error instanceof FunctionsFetchError) {
    return new Error(`${fallback}: Network error invoking edge function.`);
  }

  if (error instanceof Error) return error;
  return new Error(fallback);
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You are not signed in. Please sign in and try again.');
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    throw new Error('You are not signed in. Please sign in and try again.');
  }

  return session.user.id;
}

function isMissingFunctionError(error: unknown): boolean {
  if (!(error instanceof FunctionsHttpError)) return false;
  const response = error.context as Response;
  return response.status === 404;
}

async function bootstrapUserFallback(payload?: {
  onboarding?: OnboardingAnswers;
  fromOnboarding?: boolean;
}): Promise<BootstrapUserResult> {
  const userId = await getCurrentUserId();

  const [profileResult, weightsResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_score_weights')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new Error(`Failed to load profile: ${profileResult.error.message}`);
  }

  if (weightsResult.error) {
    throw new Error(`Failed to load score weights: ${weightsResult.error.message}`);
  }

  let profile = (profileResult.data as UserProfile | null) ?? null;
  let weights = (weightsResult.data as UserScoreWeights | null) ?? null;
  let synced = false;

  if (needsOnboarding(profile) && payload?.fromOnboarding) {
    const onboarding = payload.onboarding;
    if (!onboarding?.sex || !onboarding.birthdate || !onboarding.diet_type) {
      return {
        profile,
        weights,
        needs_onboarding: true,
        synced: false,
      };
    }

    const { data: upsertedProfile, error: upsertProfileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          sex: onboarding.sex,
          birthdate: onboarding.birthdate,
          diet_type: onboarding.diet_type,
          diet_goals: onboarding.diet_goals,
          outcomes: onboarding.outcomes,
          notifications_enabled: onboarding.notifications_enabled,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (upsertProfileError) {
      throw new Error(`Failed to sync onboarding profile: ${upsertProfileError.message}`);
    }

    profile = upsertedProfile as UserProfile;
    synced = true;
  }

  if (!weights) {
    const { data: upsertedWeights, error: upsertWeightsError } = await supabase
      .from('user_score_weights')
      .upsert(
        {
          user_id: userId,
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
      throw new Error(`Failed to initialize score weights: ${upsertWeightsError.message}`);
    }

    weights = upsertedWeights as UserScoreWeights;
  }

  return {
    profile,
    weights,
    needs_onboarding: needsOnboarding(profile),
    synced,
  };
}

async function fetchHistoryItemFallback(historyId: string): Promise<HistoryDetailItem> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('scan_history')
    .select(
      'id, barcode, score, score_version, weights_version, ai_response, ai_cached, created_at, inputs_snapshot, products(name, brands, image_url, ingredients_text, additives_tags, nutriments)',
    )
    .eq('id', historyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch history item: ${error.message}`);
  }

  if (!data) {
    throw new Error('History item not found.');
  }

  const product = Array.isArray(data.products) ? data.products[0] : data.products;

  return parseHistoryDetailResponse({
    id: data.id,
    barcode: data.barcode,
    score: data.score,
    score_version: data.score_version,
    weights_version: data.weights_version,
    ai_response: data.ai_response,
    ai_cached: data.ai_cached,
    created_at: data.created_at,
    inputs_snapshot: data.inputs_snapshot,
    product,
  });
}

async function deleteHistoryItemFallback(historyId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from('scan_history').delete().eq('id', historyId).eq('user_id', userId);
  if (error) {
    throw new Error(`Failed to delete history item: ${error.message}`);
  }
}

async function invokeEdgeFunction<T>({
  name,
  fallback,
  body,
  parse,
  onMissingFunction,
}: {
  name: string;
  fallback: string;
  body?: unknown;
  parse?: (raw: unknown) => T;
  onMissingFunction?: () => Promise<T>;
}): Promise<T> {
  const headers = await getAuthHeader();
  const { data, error } = await supabase.functions.invoke(name, {
    method: 'POST',
    body: body ?? {},
    headers,
  });

  if (error) {
    if (onMissingFunction && isMissingFunctionError(error)) {
      return onMissingFunction();
    }
    throw await unwrapError(error, fallback);
  }
  return parse ? parse(data) : (data as T);
}

export async function saveProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  const data = await invokeEdgeFunction<{ profile: UserProfile }>({
    name: 'profile',
    fallback: 'Failed to save profile',
    body: payload,
  });
  return data.profile;
}

export async function saveWeights(payload: {
  nutrition_weight: number;
  additives_weight: number;
  nutrition_subweights?: Record<string, number>;
  additives_subweights?: Record<string, number>;
}): Promise<UserScoreWeights> {
  const data = await invokeEdgeFunction<{ weights: UserScoreWeights }>({
    name: 'weights',
    fallback: 'Failed to save weights',
    body: payload,
  });
  return data.weights;
}

export async function bootstrapUser(payload?: {
  onboarding?: OnboardingAnswers;
  fromOnboarding?: boolean;
}): Promise<BootstrapUserResult> {
  return invokeEdgeFunction<BootstrapUserResult>({
    name: 'bootstrap-user',
    fallback: 'Failed to bootstrap user',
    body: {
      onboarding: payload?.onboarding,
      from_onboarding: Boolean(payload?.fromOnboarding),
    },
    onMissingFunction: () => bootstrapUserFallback(payload),
  });
}

export async function scanProduct(barcode: string): Promise<ScanResult> {
  return invokeEdgeFunction<ScanResult>({
    name: 'scan',
    fallback: 'Scan failed',
    body: { barcode },
    parse: parseScanResult,
  });
}

export async function fetchHistory(limit = 50): Promise<HistoryListItem[]> {
  return invokeEdgeFunction<HistoryListItem[]>({
    name: 'history',
    fallback: 'Failed to fetch history',
    body: { limit },
    parse: parseHistoryListResponse,
  });
}

export async function fetchHistoryItem(historyId: string): Promise<HistoryDetailItem> {
  return invokeEdgeFunction<HistoryDetailItem>({
    name: 'history-item',
    fallback: 'Failed to fetch history item',
    body: { history_id: historyId },
    parse: parseHistoryDetailResponse,
    onMissingFunction: () => fetchHistoryItemFallback(historyId),
  });
}

export async function regenerateHistoryExplanation(historyId: string): Promise<{ id: string; ai_response: string }> {
  return invokeEdgeFunction<{ id: string; ai_response: string }>({
    name: 'history-regenerate',
    fallback: 'Failed to regenerate explanation',
    body: { history_id: historyId },
  });
}

export async function deleteHistoryItem(historyId: string): Promise<void> {
  await invokeEdgeFunction<{ ok: boolean }>({
    name: 'history-delete',
    fallback: 'Failed to delete history item',
    body: { history_id: historyId },
    onMissingFunction: () => deleteHistoryItemFallback(historyId).then(() => ({ ok: true })),
  });
}

export async function deleteAccount(): Promise<void> {
  await invokeEdgeFunction<{ ok: boolean }>({
    name: 'delete-account',
    fallback: 'Failed to delete account',
  });
}

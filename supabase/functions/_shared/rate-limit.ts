import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type CounterType = 'scan_monthly' | 'regen_hourly';

export function getBucketStart(type: CounterType, now = new Date()): string {
  const dt = new Date(now);
  if (type === 'scan_monthly') {
    dt.setUTCDate(1);
    dt.setUTCHours(0, 0, 0, 0);
    return dt.toISOString();
  }

  dt.setUTCMinutes(0, 0, 0);
  return dt.toISOString();
}

export async function enforceRateLimit({
  supabase,
  userId,
  counterType,
  bucketStart,
  maxCount,
}: {
  supabase: SupabaseClient;
  userId: string;
  counterType: CounterType;
  bucketStart: string;
  maxCount: number;
}) {
  const { data, error } = await supabase.rpc('increment_usage_counter', {
    p_user_id: userId,
    p_counter_type: counterType,
    p_bucket_start: bucketStart,
    p_max_count: maxCount,
  });

  if (error) {
    if (error.message.includes('rate_limit_exceeded')) {
      throw new Error('rate_limit_exceeded');
    }

    throw new Error(`rate_limit_failed:${error.message}`);
  }

  return data as number;
}

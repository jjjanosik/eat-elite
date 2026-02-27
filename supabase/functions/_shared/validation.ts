import { jsonResponse } from './cors.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function parseJsonObject(req: Request): Promise<{ body: Record<string, unknown> } | { error: Response }> {
  try {
    const body = (await req.json()) as unknown;
    if (!isRecord(body)) {
      return { error: jsonResponse({ error: 'invalid_json_object' }, 400) };
    }
    return { body };
  } catch {
    return { error: jsonResponse({ error: 'invalid_json' }, 400) };
  }
}

export function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

const SEX_VALUES = new Set(['male', 'female', 'other']);
const DIET_VALUES = new Set(['classic', 'vegetarian', 'vegan', 'pescetarian']);

export function validateOnboardingPayload(value: unknown):
  | { value: {
      sex: 'male' | 'female' | 'other' | null;
      birthdate: string | null;
      diet_type: 'classic' | 'vegetarian' | 'vegan' | 'pescetarian' | null;
      diet_goals: string[];
      outcomes: string[];
      notifications_enabled: boolean;
    } }
  | { error: Response } {
  if (!isRecord(value)) {
    return { error: jsonResponse({ error: 'invalid_onboarding_payload' }, 400) };
  }

  const sexRaw = value.sex;
  const dietRaw = value.diet_type;
  const birthdateRaw = value.birthdate;

  if (sexRaw !== null && sexRaw !== undefined && !SEX_VALUES.has(String(sexRaw))) {
    return { error: jsonResponse({ error: 'invalid_sex' }, 400) };
  }

  if (dietRaw !== null && dietRaw !== undefined && !DIET_VALUES.has(String(dietRaw))) {
    return { error: jsonResponse({ error: 'invalid_diet_type' }, 400) };
  }

  if (
    birthdateRaw !== null &&
    birthdateRaw !== undefined &&
    (typeof birthdateRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw))
  ) {
    return { error: jsonResponse({ error: 'invalid_birthdate' }, 400) };
  }

  return {
    value: {
      sex: sexRaw === undefined ? null : ((sexRaw ?? null) as 'male' | 'female' | 'other' | null),
      birthdate: birthdateRaw === undefined ? null : (birthdateRaw ?? null ? String(birthdateRaw) : null),
      diet_type:
        dietRaw === undefined ? null : ((dietRaw ?? null) as 'classic' | 'vegetarian' | 'vegan' | 'pescetarian' | null),
      diet_goals: asStringArray(value.diet_goals),
      outcomes: asStringArray(value.outcomes),
      notifications_enabled: asBoolean(value.notifications_enabled),
    },
  };
}

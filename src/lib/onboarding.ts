import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingAnswers } from '@/lib/types';

const onboardingKeyForInstall = (installId: string) => `onboarding_state:${installId}`;

export const DEFAULT_ONBOARDING_ANSWERS: OnboardingAnswers = {
  sex: null,
  birthdate: '',
  diet_type: null,
  diet_goals: [],
  outcomes: [],
  notifications_enabled: false,
};

type OnboardingState = {
  completed: boolean;
  answers: OnboardingAnswers;
};

function cloneDefaultAnswers(): OnboardingAnswers {
  return {
    ...DEFAULT_ONBOARDING_ANSWERS,
    diet_goals: [],
    outcomes: [],
  };
}

function normalizeAnswers(input: unknown): OnboardingAnswers {
  const raw = typeof input === 'object' && input ? (input as Record<string, unknown>) : {};

  const sex = raw.sex;
  const dietType = raw.diet_type;

  return {
    sex: sex === 'male' || sex === 'female' || sex === 'other' ? sex : null,
    birthdate: typeof raw.birthdate === 'string' ? raw.birthdate : '',
    diet_type:
      dietType === 'classic' || dietType === 'vegetarian' || dietType === 'vegan' || dietType === 'pescetarian'
        ? dietType
        : null,
    diet_goals: Array.isArray(raw.diet_goals) ? raw.diet_goals.map((value) => String(value)) : [],
    outcomes: Array.isArray(raw.outcomes) ? raw.outcomes.map((value) => String(value)) : [],
    notifications_enabled: Boolean(raw.notifications_enabled),
  };
}

export async function getOnboardingState(installId: string): Promise<OnboardingState> {
  const raw = await AsyncStorage.getItem(onboardingKeyForInstall(installId));
  if (!raw) {
    return {
      completed: false,
      answers: cloneDefaultAnswers(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      completed: Boolean(parsed.completed),
      answers: normalizeAnswers(parsed.answers),
    };
  } catch {
    return {
      completed: false,
      answers: cloneDefaultAnswers(),
    };
  }
}

export async function patchOnboardingAnswers(
  installId: string,
  patch: Partial<OnboardingAnswers>,
): Promise<OnboardingState> {
  const current = await getOnboardingState(installId);
  const next: OnboardingState = {
    completed: current.completed,
    answers: normalizeAnswers({ ...current.answers, ...patch }),
  };

  await AsyncStorage.setItem(onboardingKeyForInstall(installId), JSON.stringify(next));
  return next;
}

export async function setOnboardingCompleted(installId: string, completed: boolean): Promise<OnboardingState> {
  const current = await getOnboardingState(installId);
  const next: OnboardingState = {
    completed,
    answers: current.answers,
  };

  await AsyncStorage.setItem(onboardingKeyForInstall(installId), JSON.stringify(next));
  return next;
}

export async function resetOnboardingState(installId: string): Promise<void> {
  await AsyncStorage.removeItem(onboardingKeyForInstall(installId));
}

export function getDefaultOnboardingAnswers(): OnboardingAnswers {
  return cloneDefaultAnswers();
}

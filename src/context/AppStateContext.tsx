import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getOrCreateInstallId } from '@/lib/install';
import { clearLocalCache, unlockPaywall } from '@/lib/paywall';
import {
  getDefaultOnboardingAnswers,
  patchOnboardingAnswers,
  resetOnboardingState,
  setOnboardingCompleted,
} from '@/lib/onboarding';
import { bootstrapUser } from '@/lib/api';
import { loadLocalInstallState } from '@/context/state/loadLocalInstallState';
import type { OnboardingAnswers, UserProfile, UserScoreWeights } from '@/lib/types';

type AppStateContextValue = {
  installId: string | null;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  weights: UserScoreWeights | null;
  paywallUnlocked: boolean;
  onboardingComplete: boolean;
  onboardingAnswers: OnboardingAnswers;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  saveOnboardingAnswers: (patch: Partial<OnboardingAnswers>) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  reopenOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  unlockPaywallForInstall: () => Promise<void>;
  clearInstallPaywallCache: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  setWeights: (weights: UserScoreWeights | null) => void;
  setPaywallUnlocked: (unlocked: boolean) => void;
  signOut: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [installId, setInstallId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weights, setWeights] = useState<UserScoreWeights | null>(null);
  const [paywallUnlocked, setPaywallUnlocked] = useState(false);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [onboardingAnswers, setOnboardingAnswersState] = useState<OnboardingAnswers>(getDefaultOnboardingAnswers);
  const [loading, setLoading] = useState(true);
  const hydratedRef = useRef(false);

  const user = session?.user ?? null;

  const refreshUserData = useCallback(async () => {
    if (!installId) return;

    const { onboardingState, paywallUnlocked: unlocked } = await loadLocalInstallState(installId);

    setOnboardingAnswersState(onboardingState.answers);
    setOnboardingCompleteState(onboardingState.completed);
    setPaywallUnlocked(unlocked);

    if (!user) {
      setProfile(null);
      setWeights(null);
      return;
    }

    const bootstrap = await bootstrapUser({ fromOnboarding: false });
    setProfile(bootstrap.profile);
    setWeights(bootstrap.weights);
  }, [installId, user]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [{ data }, nextInstallId] = await Promise.all([supabase.auth.getSession(), getOrCreateInstallId()]);
        if (!mounted) return;
        setSession(data.session ?? null);
        setInstallId(nextInstallId);
      } catch (error) {
        console.error('Failed to bootstrap app state', error);
        if (!mounted) return;
        setSession(null);
        setInstallId(null);
        setLoading(false);
      }
    };

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        supabase.auth.startAutoRefresh();
        void supabase.auth
          .getSession()
          .then(({ data }) => {
            if (!mounted) return;
            setSession(data.session ?? null);
          })
          .catch((error) => {
            console.error('Failed to refresh auth session on app foreground', error);
          });
        return;
      }

      supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();

    return () => {
      mounted = false;
      appStateSubscription.remove();
      supabase.auth.stopAutoRefresh();
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!installId) return;

    let mounted = true;
    if (!hydratedRef.current) {
      setLoading(true);
    }

    refreshUserData()
      .catch((error) => {
        console.error('Failed to refresh user data', error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
        hydratedRef.current = true;
      });

    return () => {
      mounted = false;
    };
  }, [installId, refreshUserData, user?.id]);

  const saveOnboardingAnswers = useCallback(
    async (patch: Partial<OnboardingAnswers>) => {
      if (!installId) return;
      const next = await patchOnboardingAnswers(installId, patch);
      setOnboardingAnswersState(next.answers);
      setOnboardingCompleteState(next.completed);
    },
    [installId],
  );

  const finishOnboarding = useCallback(async () => {
    if (!installId) return;
    const next = await setOnboardingCompleted(installId, true);
    setOnboardingCompleteState(next.completed);
    setOnboardingAnswersState(next.answers);
  }, [installId]);

  const reopenOnboarding = useCallback(async () => {
    if (!installId) return;
    const next = await setOnboardingCompleted(installId, false);
    setOnboardingCompleteState(next.completed);
    setOnboardingAnswersState(next.answers);
  }, [installId]);

  const resetOnboarding = useCallback(async () => {
    if (!installId) return;
    await resetOnboardingState(installId);
    setOnboardingCompleteState(false);
    setOnboardingAnswersState(getDefaultOnboardingAnswers());
  }, [installId]);

  const unlockPaywallForInstall = useCallback(async () => {
    if (!installId) return;
    await unlockPaywall(installId);
    setPaywallUnlocked(true);
  }, [installId]);

  const clearInstallPaywallCache = useCallback(async () => {
    if (!installId) return;
    await clearLocalCache(installId);
    setPaywallUnlocked(false);
  }, [installId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setWeights(null);
  }, []);

  const value = useMemo<AppStateContextValue>(
    () => ({
      installId,
      session,
      user,
      profile,
      weights,
      paywallUnlocked,
      onboardingComplete,
      onboardingAnswers,
      loading,
      refreshUserData,
      saveOnboardingAnswers,
      finishOnboarding,
      reopenOnboarding,
      resetOnboarding,
      unlockPaywallForInstall,
      clearInstallPaywallCache,
      setProfile,
      setWeights,
      setPaywallUnlocked,
      signOut,
    }),
    [
      installId,
      session,
      user,
      profile,
      weights,
      paywallUnlocked,
      onboardingComplete,
      onboardingAnswers,
      loading,
      refreshUserData,
      saveOnboardingAnswers,
      finishOnboarding,
      reopenOnboarding,
      resetOnboarding,
      unlockPaywallForInstall,
      clearInstallPaywallCache,
      signOut,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

export function getNextRoute({
  session,
  onboardingComplete,
  paywallUnlocked,
}: {
  session: Session | null;
  onboardingComplete: boolean;
  paywallUnlocked: boolean;
}) {
  if (!onboardingComplete) return '/onboarding/sex';
  if (!session) return '/auth?mode=signup&from=onboarding';
  if (!paywallUnlocked) return '/paywall';
  return '/(tabs)/scan';
}

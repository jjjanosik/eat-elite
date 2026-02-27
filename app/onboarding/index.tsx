import { Redirect } from 'expo-router';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

export default function OnboardingIndex() {
  const { session, onboardingComplete, paywallUnlocked } = useAppState();

  const nextRoute = getNextRoute({ session, onboardingComplete, paywallUnlocked });
  if (nextRoute !== '/onboarding/sex') {
    return <Redirect href={nextRoute} />;
  }

  return <Redirect href="/onboarding/sex" />;
}

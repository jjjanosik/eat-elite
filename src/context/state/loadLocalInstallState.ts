import { isPaywallUnlocked } from '@/lib/paywall';
import { getOnboardingState } from '@/lib/onboarding';

export async function loadLocalInstallState(installId: string) {
  const [onboardingState, paywallUnlocked] = await Promise.all([
    getOnboardingState(installId),
    isPaywallUnlocked(installId),
  ]);

  return {
    onboardingState,
    paywallUnlocked,
  };
}

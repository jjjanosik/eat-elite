import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

export default function OnboardingLayout() {
  const { session, onboardingComplete, paywallUnlocked, loading } = useAppState();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f8fa' }}>
        <ActivityIndicator color="#1f883d" />
      </View>
    );
  }

  if (onboardingComplete) {
    const nextRoute = getNextRoute({ session, onboardingComplete, paywallUnlocked });
    if (nextRoute !== '/onboarding/sex') {
      return <Redirect href={nextRoute} />;
    }
  }

  return <Stack screenOptions={{ headerShown: false, animationTypeForReplace: 'pop' }} />;
}

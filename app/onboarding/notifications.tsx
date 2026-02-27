import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;

export default function OnboardingNotificationsScreen() {
  const { onboardingAnswers, saveOnboardingAnswers, finishOnboarding } = useAppState();
  const [loading, setLoading] = useState(false);

  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/scoring');
  };

  const requestPermission = async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      await saveOnboardingAnswers({ notifications_enabled: true });
      return;
    }

    const next = await Notifications.requestPermissionsAsync();
    await saveOnboardingAnswers({ notifications_enabled: Boolean(next.granted) });
  };

  const finish = async () => {
    setLoading(true);
    try {
      await finishOnboarding();
      router.replace('/auth?mode=signup&from=onboarding');
    } catch (error) {
      Alert.alert('Could not finish onboarding', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingStepShell
      step={7}
      total={TOTAL}
      title="Notification permission"
      description="Optional for now. You can always update this later in settings."
      onBack={goToPreviousStep}
      onNext={() => {
        void finish();
      }}
      nextLabel="Continue"
      nextLoading={loading}
    >
      <View style={styles.card}>
        <Text style={styles.statusLabel}>Current status</Text>
        <Text style={styles.statusValue}>{onboardingAnswers.notifications_enabled ? 'Enabled' : 'Not enabled'}</Text>
        <PrimaryButton
          label={onboardingAnswers.notifications_enabled ? 'Enabled' : 'Enable notifications'}
          variant="secondary"
          onPress={() => {
            void requestPermission();
          }}
        />
      </View>
    </OnboardingStepShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8dee4',
    borderRadius: 12,
    padding: 14,
  },
  statusLabel: {
    color: '#6e7781',
    fontSize: 13,
    marginBottom: 4,
  },
  statusValue: {
    color: '#1f2328',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
});

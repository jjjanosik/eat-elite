import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';

const TOTAL = 7;

export default function OnboardingScoringScreen() {
  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/outcomes');
  };

  return (
    <OnboardingStepShell
      step={6}
      total={TOTAL}
      title="How scoring works"
      description="Every product gets a 0-100 score based on nutrition and additives."
      onBack={goToPreviousStep}
      onNext={() => router.push('/onboarding/notifications')}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Score Formula (v1)</Text>
        <Text style={styles.cardText}>Total Score = weighted average of Nutrition Score and Additives Score.</Text>
        <Text style={styles.cardText}>Your goals and outcomes are used to personalize explanations and emphasis.</Text>
        <Text style={styles.cardText}>Each scan keeps an input snapshot so old scores stay stable over time.</Text>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  cardText: {
    color: '#4f5d6b',
    lineHeight: 22,
    marginBottom: 8,
  },
});

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { DIET_TYPES } from '@/lib/constants';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;

export default function OnboardingDietTypeScreen() {
  const { onboardingAnswers, saveOnboardingAnswers } = useAppState();

  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/birthdate');
  };

  const onNext = () => {
    if (!onboardingAnswers.diet_type) {
      Alert.alert('Select diet type', 'Pick one option to continue.');
      return;
    }

    router.push('/onboarding/diet-goals');
  };

  return (
    <OnboardingStepShell
      step={3}
      total={TOTAL}
      title="Select your diet type"
      description="This helps us align recommendations with your eating pattern."
      onBack={goToPreviousStep}
      onNext={onNext}
      disableNext={!onboardingAnswers.diet_type}
    >
      <View style={styles.rowWrap}>
        {DIET_TYPES.map((option) => (
          <Pressable
            key={option}
            style={[styles.optionButton, onboardingAnswers.diet_type === option && styles.optionButtonSelected]}
            onPress={() => {
              void saveOnboardingAnswers({ diet_type: option });
            }}
          >
            <Text style={[styles.optionText, onboardingAnswers.diet_type === option && styles.optionTextSelected]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </OnboardingStepShell>
  );
}

const styles = StyleSheet.create({
  rowWrap: {
    width: '100%',
    gap: 10,
  },
  optionButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    backgroundColor: '#1f883d',
    borderColor: '#1f883d',
  },
  optionText: {
    color: '#1f2328',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  optionTextSelected: {
    color: '#fff',
  },
});

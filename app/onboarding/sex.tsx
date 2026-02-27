import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { SEX_OPTIONS } from '@/lib/constants';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;

export default function OnboardingSexScreen() {
  const { onboardingAnswers, saveOnboardingAnswers } = useAppState();

  const goBackToIntro = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/intro');
  };

  const onNext = () => {
    if (!onboardingAnswers.sex) {
      Alert.alert('Select gender', 'Pick one option to continue.');
      return;
    }

    router.push('/onboarding/birthdate');
  };

  return (
    <OnboardingStepShell
      step={1}
      total={TOTAL}
      title="Tell us your gender"
      description="This helps us personalize your scoring profile."
      onBack={goBackToIntro}
      onNext={onNext}
      disableNext={!onboardingAnswers.sex}
    >
      <View style={styles.rowWrap}>
        {SEX_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={[styles.optionButton, onboardingAnswers.sex === option && styles.optionButtonSelected]}
            onPress={() => {
              void saveOnboardingAnswers({ sex: option });
            }}
          >
            <Text style={[styles.optionText, onboardingAnswers.sex === option && styles.optionTextSelected]}>{option}</Text>
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

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { DIET_GOAL_OPTIONS } from '@/lib/constants';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function OnboardingDietGoalsScreen() {
  const { onboardingAnswers, saveOnboardingAnswers } = useAppState();
  const [selected, setSelected] = useState<string[]>(onboardingAnswers.diet_goals);

  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/diet-type');
  };

  const onNext = async () => {
    await saveOnboardingAnswers({ diet_goals: selected });
    router.push('/onboarding/outcomes');
  };

  return (
    <OnboardingStepShell
      step={4}
      total={TOTAL}
      title="Choose your diet goals"
      description="Pick any that apply. You can change these later."
      onBack={goToPreviousStep}
      onNext={() => {
        void onNext();
      }}
    >
      <View style={styles.rowWrap}>
        {DIET_GOAL_OPTIONS.map((goal) => (
          <Pressable key={goal} style={styles.optionRow} onPress={() => setSelected((current) => toggleValue(current, goal))}>
            <View style={[styles.checkbox, selected.includes(goal) && styles.checkboxSelected]}>
              {selected.includes(goal) ? <Text style={styles.checkboxCheck}>✓</Text> : null}
            </View>
            <Text style={styles.optionText}>{goal}</Text>
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c3cbd3',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1f883d',
    borderColor: '#1f883d',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  optionText: {
    color: '#1f2328',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
    flex: 1,
  },
});

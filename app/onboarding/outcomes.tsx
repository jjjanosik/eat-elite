import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { OUTCOME_OPTIONS } from '@/lib/constants';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function OnboardingOutcomesScreen() {
  const { onboardingAnswers, saveOnboardingAnswers } = useAppState();
  const [selected, setSelected] = useState<string[]>(onboardingAnswers.outcomes);

  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/diet-goals');
  };

  const onNext = async () => {
    await saveOnboardingAnswers({ outcomes: selected });
    router.push('/onboarding/scoring');
  };

  return (
    <OnboardingStepShell
      step={5}
      total={TOTAL}
      title="What outcomes matter most?"
      description="Pick your priorities to tailor explanation tone and scoring emphasis."
      onBack={goToPreviousStep}
      onNext={() => {
        void onNext();
      }}
    >
      <View style={styles.rowWrap}>
        {OUTCOME_OPTIONS.map((outcome) => (
          <Pressable key={outcome} style={styles.optionRow} onPress={() => setSelected((current) => toggleValue(current, outcome))}>
            <View style={[styles.checkbox, selected.includes(outcome) && styles.checkboxSelected]}>
              {selected.includes(outcome) ? <Text style={styles.checkboxCheck}>✓</Text> : null}
            </View>
            <Text style={styles.optionText}>{outcome}</Text>
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

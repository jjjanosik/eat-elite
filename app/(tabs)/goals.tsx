import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { Screen } from '@/components/Screen';
import { OptionChip } from '@/components/OptionChip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppState } from '@/context/AppStateContext';
import { DIET_GOAL_OPTIONS, OUTCOME_OPTIONS } from '@/lib/constants';
import { saveProfile, saveWeights } from '@/lib/api';

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function GoalsScreen() {
  const { profile, weights, setProfile, setWeights } = useAppState();
  const [saving, setSaving] = useState(false);

  const [dietGoals, setDietGoals] = useState<string[]>(profile?.diet_goals ?? []);
  const [outcomes, setOutcomes] = useState<string[]>(profile?.outcomes ?? []);
  const [nutritionWeight, setNutritionWeight] = useState(String(weights?.nutrition_weight ?? 70));
  const [additivesWeight, setAdditivesWeight] = useState(String(weights?.additives_weight ?? 30));
  const colorScheme = useColorScheme();
  const keyboardAppearance = colorScheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (profile) {
      setDietGoals(profile.diet_goals ?? []);
      setOutcomes(profile.outcomes ?? []);
    }
  }, [profile]);

  useEffect(() => {
    if (weights) {
      setNutritionWeight(String(weights.nutrition_weight));
      setAdditivesWeight(String(weights.additives_weight));
    }
  }, [weights]);

  const totals = useMemo(() => {
    const nutrition = Number.parseInt(nutritionWeight, 10) || 0;
    const additives = Number.parseInt(additivesWeight, 10) || 0;
    return { nutrition, additives, sum: nutrition + additives };
  }, [nutritionWeight, additivesWeight]);

  const save = async () => {
    if (!profile) {
      Alert.alert('Missing profile', 'Complete onboarding first.');
      return;
    }

    if (totals.sum !== 100) {
      Alert.alert('Invalid weights', 'Nutrition + additives must equal 100.');
      return;
    }

    setSaving(true);
    try {
      const [nextProfile, nextWeights] = await Promise.all([
        saveProfile({ diet_goals: dietGoals, outcomes }),
        saveWeights({
          nutrition_weight: totals.nutrition,
          additives_weight: totals.additives,
        }),
      ]);

      setProfile(nextProfile);
      setWeights(nextWeights);
      Alert.alert('Saved', 'Goals and scoring weights updated.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen topInset={false}>
      <Text style={styles.title}>Goals & Weights</Text>
      <Text style={styles.subtitle}>Customize what the score emphasizes for your profile.</Text>

      <Text style={styles.sectionTitle}>Diet Goals</Text>
      <View style={styles.rowWrap}>
        {DIET_GOAL_OPTIONS.map((goal) => (
          <OptionChip
            key={goal}
            label={goal}
            selected={dietGoals.includes(goal)}
            onPress={() => setDietGoals((current) => toggleValue(current, goal))}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Outcomes</Text>
      <View style={styles.rowWrap}>
        {OUTCOME_OPTIONS.map((outcome) => (
          <OptionChip
            key={outcome}
            label={outcome}
            selected={outcomes.includes(outcome)}
            onPress={() => setOutcomes((current) => toggleValue(current, outcome))}
          />
        ))}
      </View>

      <View style={styles.weightCard}>
        <Text style={styles.sectionTitle}>Score Weights</Text>

        <Text style={styles.label}>Nutrition Weight</Text>
        <TextInput
          value={nutritionWeight}
          onChangeText={setNutritionWeight}
          keyboardType="number-pad"
          keyboardAppearance={keyboardAppearance}
          style={styles.input}
        />

        <Text style={styles.label}>Additives Weight</Text>
        <TextInput
          value={additivesWeight}
          onChangeText={setAdditivesWeight}
          keyboardType="number-pad"
          keyboardAppearance={keyboardAppearance}
          style={styles.input}
        />

        <Text style={[styles.total, totals.sum === 100 ? styles.totalValid : styles.totalInvalid]}>Current total: {totals.sum}</Text>
      </View>

      <PrimaryButton label="Save" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  subtitle: {
    color: '#4f5d6b',
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2328',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  weightCard: {
    backgroundColor: '#fff',
    borderColor: '#d8dee4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  label: {
    color: '#1f2328',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderColor: '#d0d7de',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  total: {
    fontWeight: '700',
  },
  totalValid: {
    color: '#1f883d',
  },
  totalInvalid: {
    color: '#d1242f',
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Picker } from '@react-native-picker/picker';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppState } from '@/context/AppStateContext';
import { DIET_GOAL_OPTIONS, OUTCOME_OPTIONS } from '@/lib/constants';
import { saveProfile, saveWeights } from '@/lib/api';

const SAVE_SUCCESS_VISIBLE_MS = 4000;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 100;
const GOALS_BOTTOM_PADDING = 72;
const GOALS_BOTTOM_PADDING_WITH_SAVE = 150;
const WEIGHT_OPTIONS = Array.from({ length: WEIGHT_MAX - WEIGHT_MIN + 1 }, (_, index) => WEIGHT_MIN + index);

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function normalizeValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function clampWeight(value: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(value)));
}

function WeightSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <View style={styles.nativePickerWrap}>
      <Picker selectedValue={value} onValueChange={(nextValue) => onChange(clampWeight(Number(nextValue)))} itemStyle={styles.nativePickerItem}>
        {WEIGHT_OPTIONS.map((option) => (
          <Picker.Item key={option} label={`${option}`} value={option} />
        ))}
      </Picker>
    </View>
  );
}

type WeightPickerTarget = 'nutrition' | 'additives';

export default function GoalsScreen() {
  const { profile, weights, setProfile, setWeights } = useAppState();
  const [saving, setSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);

  const [dietGoals, setDietGoals] = useState<string[]>(profile?.diet_goals ?? []);
  const [outcomes, setOutcomes] = useState<string[]>(profile?.outcomes ?? []);
  const [nutritionWeight, setNutritionWeight] = useState<number>(weights?.nutrition_weight ?? 70);
  const [additivesWeight, setAdditivesWeight] = useState<number>(weights?.additives_weight ?? 30);
  const [weightPickerVisible, setWeightPickerVisible] = useState(false);
  const [weightPickerTarget, setWeightPickerTarget] = useState<WeightPickerTarget>('nutrition');
  const [weightPickerValue, setWeightPickerValue] = useState<number>(weights?.nutrition_weight ?? 70);
  const tabBarHeight = useBottomTabBarHeight();
  const saveVisibility = useRef(new Animated.Value(0)).current;
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile) {
      setDietGoals(profile.diet_goals ?? []);
      setOutcomes(profile.outcomes ?? []);
    }
  }, [profile]);

  useEffect(() => {
    if (weights) {
      setNutritionWeight(weights.nutrition_weight);
      setAdditivesWeight(weights.additives_weight);
    }
  }, [weights]);

  const totals = useMemo(() => {
    const nutrition = clampWeight(nutritionWeight);
    const additives = clampWeight(additivesWeight);
    return { nutrition, additives, sum: nutrition + additives };
  }, [nutritionWeight, additivesWeight]);

  const baseline = useMemo(
    () => ({
      dietGoals: normalizeValues(profile?.diet_goals ?? []),
      outcomes: normalizeValues(profile?.outcomes ?? []),
      nutrition: weights?.nutrition_weight ?? 70,
      additives: weights?.additives_weight ?? 30,
    }),
    [profile, weights],
  );

  const hasChanges = useMemo(() => {
    const currentDietGoals = normalizeValues(dietGoals);
    const currentOutcomes = normalizeValues(outcomes);
    const currentNutrition = clampWeight(nutritionWeight);
    const currentAdditives = clampWeight(additivesWeight);

    if (!arraysEqual(currentDietGoals, baseline.dietGoals)) return true;
    if (!arraysEqual(currentOutcomes, baseline.outcomes)) return true;
    if (currentNutrition !== baseline.nutrition) return true;
    if (currentAdditives !== baseline.additives) return true;

    return false;
  }, [additivesWeight, baseline, dietGoals, nutritionWeight, outcomes]);

  const setNutritionAndSync = useCallback((nextValue: number) => {
    const nextNutrition = clampWeight(nextValue);
    setNutritionWeight(nextNutrition);
    setAdditivesWeight(100 - nextNutrition);
  }, []);

  const setAdditivesAndSync = useCallback((nextValue: number) => {
    const nextAdditives = clampWeight(nextValue);
    setAdditivesWeight(nextAdditives);
    setNutritionWeight(100 - nextAdditives);
  }, []);

  const openWeightPicker = useCallback(
    (target: WeightPickerTarget) => {
      setWeightPickerTarget(target);
      setWeightPickerValue(target === 'nutrition' ? nutritionWeight : additivesWeight);
      setWeightPickerVisible(true);
    },
    [additivesWeight, nutritionWeight],
  );

  const closeWeightPicker = useCallback(() => {
    setWeightPickerVisible(false);
  }, []);

  const confirmWeightPicker = useCallback(() => {
    if (weightPickerTarget === 'nutrition') {
      setNutritionAndSync(weightPickerValue);
    } else {
      setAdditivesAndSync(weightPickerValue);
    }
    setWeightPickerVisible(false);
  }, [setAdditivesAndSync, setNutritionAndSync, weightPickerTarget, weightPickerValue]);

  const showStickySave = hasChanges || saving || savedVisible;

  useEffect(() => {
    Animated.spring(saveVisibility, {
      toValue: showStickySave ? 1 : 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
  }, [saveVisibility, showStickySave]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!hasChanges || !savedVisible) return;
    setSavedVisible(false);
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, [hasChanges, savedVisible]);

  const save = useCallback(async () => {
    if (saving || !hasChanges) return;

    if (!profile) {
      Alert.alert('Missing profile', 'Complete onboarding first.');
      return;
    }

    if (totals.sum !== 100) {
      Alert.alert('Invalid weights', 'Nutrition + additives must equal 100.');
      return;
    }

    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }

    setSavedVisible(false);
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
      setSavedVisible(true);
      savedTimerRef.current = setTimeout(() => {
        setSavedVisible(false);
        savedTimerRef.current = null;
      }, SAVE_SUCCESS_VISIBLE_MS);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }, [dietGoals, hasChanges, outcomes, profile, saving, setProfile, setWeights, totals]);

  const saveBarStyle = useMemo(
    () => ({
      opacity: saveVisibility,
      transform: [
        {
          translateY: saveVisibility.interpolate({
            inputRange: [0, 1],
            outputRange: [80, 0],
          }),
        },
      ],
    }),
    [saveVisibility],
  );

  const saveLabel = hasChanges ? 'Save' : 'Saved! 🤗';

  return (
    <Screen topInset={false} scroll={false} bottomInset={false}>
      <View style={styles.page}>
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: showStickySave
                ? tabBarHeight + GOALS_BOTTOM_PADDING_WITH_SAVE
                : tabBarHeight + GOALS_BOTTOM_PADDING,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Goals & Weights</Text>
          <Text style={styles.subtitle}>Customize what the score emphasizes for your profile.</Text>

          <Text style={styles.sectionTitle}>Diet Goals</Text>
          <View style={styles.optionList}>
            {DIET_GOAL_OPTIONS.map((goal) => (
              <Pressable
                key={goal}
                onPress={() => setDietGoals((current) => toggleValue(current, goal))}
                style={styles.optionRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dietGoals.includes(goal) }}
              >
                <View style={[styles.checkbox, dietGoals.includes(goal) ? styles.checkboxSelected : undefined]}>
                  {dietGoals.includes(goal) ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                </View>
                <Text style={styles.optionText}>{goal}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Outcomes</Text>
          <View style={styles.optionList}>
            {OUTCOME_OPTIONS.map((outcome) => (
              <Pressable
                key={outcome}
                onPress={() => setOutcomes((current) => toggleValue(current, outcome))}
                style={styles.optionRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: outcomes.includes(outcome) }}
              >
                <View style={[styles.checkbox, outcomes.includes(outcome) ? styles.checkboxSelected : undefined]}>
                  {outcomes.includes(outcome) ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                </View>
                <Text style={styles.optionText}>{outcome}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.weightSection}>
            <Text style={styles.sectionTitle}>Score Weights</Text>

            <Pressable style={styles.weightField} onPress={() => openWeightPicker('nutrition')}>
              <Text style={styles.weightFieldValue}>{nutritionWeight}</Text>
              <Text style={styles.weightFieldPercent}>%</Text>
              <Text style={styles.weightFieldTitle}>Nutrition Weight</Text>
            </Pressable>

            <Pressable style={styles.weightField} onPress={() => openWeightPicker('additives')}>
              <Text style={styles.weightFieldValue}>{additivesWeight}</Text>
              <Text style={styles.weightFieldPercent}>%</Text>
              <Text style={styles.weightFieldTitle}>Additives Weight</Text>
            </Pressable>

          </View>
        </ScrollView>

        <Animated.View
          pointerEvents={showStickySave ? 'auto' : 'none'}
          style={[styles.saveBarWrap, { bottom: 6 }, saveBarStyle]}
        >
          <PrimaryButton label={saveLabel} onPress={save} loading={saving} style={styles.saveButton} />
        </Animated.View>
      </View>

      <Modal transparent visible={weightPickerVisible} animationType="slide" onRequestClose={closeWeightPicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {weightPickerTarget === 'nutrition' ? 'Nutrition Weight' : 'Additives Weight'}
              </Text>
              <Pressable onPress={closeWeightPicker}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            <WeightSelector value={weightPickerValue} onChange={setWeightPickerValue} />

            <Pressable style={styles.doneButton} onPress={confirmWeightPicker}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
  },
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
  optionList: {
    marginBottom: 16,
  },
  optionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#18B84A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    borderColor: '#18B84A',
    backgroundColor: '#18B84A',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  optionText: {
    flex: 1,
    color: '#1f2328',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  weightSection: {
    marginBottom: 16,
  },
  weightField: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  weightFieldValue: {
    color: '#18B84A',
    fontWeight: '700',
    fontSize: 26,
    minWidth: 44,
  },
  weightFieldPercent: {
    color: '#18B84A',
    fontWeight: '700',
    fontSize: 22,
    marginRight: 10,
  },
  weightFieldTitle: {
    color: '#1f2328',
    fontSize: 16,
    fontWeight: '600',
  },
  nativePickerWrap: {
    width: '100%',
    height: 216,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  nativePickerItem: {
    color: '#1f2328',
    fontSize: 24,
    fontWeight: '700',
  },
  saveBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  saveButton: {
    marginBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2328',
  },
  modalClose: {
    color: '#6e7781',
    fontWeight: '600',
  },
  doneButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#1f883d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

import { useMemo, useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { OnboardingStepShell } from '@/components/OnboardingStepShell';
import { useAppState } from '@/context/AppStateContext';

const TOTAL = 7;
const CURRENT_YEAR = new Date().getFullYear();

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function parseBirthdate(value: string): { year: number | null; month: number | null; day: number | null } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { year: null, month: null, day: null };
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);

  if (!year || !month || !day) {
    return { year: null, month: null, day: null };
  }

  return { year, month, day };
}

function toMonthLabel(month: number | null): string | null {
  if (!month) return null;
  const d = new Date(2000, month - 1, 1);
  return d.toLocaleString('en-US', { month: 'long' });
}

function SelectorField({
  label,
  value,
  placeholder,
  onPress,
  style,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable style={[styles.selectorField, style]} onPress={onPress}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <Text style={[styles.selectorValue, !value && styles.selectorPlaceholder]}>{value ?? placeholder}</Text>
    </Pressable>
  );
}

export default function OnboardingBirthdateScreen() {
  const { onboardingAnswers, saveOnboardingAnswers } = useAppState();
  const parsedBirthdate = parseBirthdate(onboardingAnswers.birthdate);

  const [month, setMonth] = useState<number | null>(parsedBirthdate.month);
  const [day, setDay] = useState<number | null>(parsedBirthdate.day);
  const [year, setYear] = useState<number | null>(parsedBirthdate.year);
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedDate = useMemo(() => {
    if (year && month && day) {
      return new Date(year, month - 1, day);
    }

    return new Date(CURRENT_YEAR - 25, 0, 1);
  }, [day, month, year]);

  const [pickerDate, setPickerDate] = useState<Date>(selectedDate);

  const monthLabel = toMonthLabel(month);
  const dayLabel = day ? String(day) : null;
  const yearLabel = year ? String(year) : null;
  const iosPickerProps =
    Platform.OS === 'ios'
      ? {
          // Keep spinner text readable in Expo Go when the device is in dark mode.
          themeVariant: 'light' as const,
          textColor: '#1f2328',
        }
      : undefined;

  const openPicker = () => {
    setPickerDate(selectedDate);
    setPickerVisible(true);
  };

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') return;
    if (!date) return;
    setPickerDate(date);
  };

  const confirmPicker = () => {
    setMonth(pickerDate.getMonth() + 1);
    setDay(pickerDate.getDate());
    setYear(pickerDate.getFullYear());
    setPickerVisible(false);
  };

  const onNext = async () => {
    if (!year || !month || !day) {
      Alert.alert('Select complete birthdate', 'Please choose month, day, and year.');
      return;
    }

    const normalized = `${year}-${pad(month)}-${pad(day)}`;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    const valid =
      !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day;

    if (!valid) {
      Alert.alert('Invalid date', 'Please choose a valid calendar date.');
      return;
    }

    await saveOnboardingAnswers({ birthdate: normalized });
    router.push('/onboarding/diet-type');
  };

  const goToPreviousStep = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/onboarding/sex');
  };

  return (
    <>
      <OnboardingStepShell
        step={2}
        total={TOTAL}
        title="What is your birthday?"
        description="Use the iOS date selector to choose Month, Day, and Year."
        onBack={goToPreviousStep}
        onNext={() => {
          void onNext();
        }}
        disableNext={!month || !day || !year}
      >
        <View style={styles.selectorRow}>
          <SelectorField label="Month" value={monthLabel} placeholder="Month" onPress={openPicker} style={styles.monthField} />
          <SelectorField label="Day" value={dayLabel} placeholder="Day" onPress={openPicker} style={styles.dayField} />
          <SelectorField label="Year" value={yearLabel} placeholder="Year" onPress={openPicker} style={styles.yearField} />
        </View>
      </OnboardingStepShell>

      <Modal transparent visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Birthday</Text>
              <Pressable onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>

            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={onPickerChange}
              {...iosPickerProps}
              style={styles.nativePicker}
            />

            <Pressable style={styles.doneButton} onPress={confirmPicker}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  selectorField: {
    minWidth: 0,
    borderColor: '#d0d7de',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  selectorLabel: {
    color: '#6e7781',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  selectorValue: {
    color: '#1f2328',
    fontSize: 16,
    fontWeight: '600',
  },
  selectorPlaceholder: {
    color: '#8c959f',
    fontWeight: '500',
  },
  monthField: {
    flex: 1.4,
  },
  dayField: {
    flex: 0.8,
  },
  yearField: {
    flex: 1,
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
  nativePicker: {
    alignSelf: 'center',
    width: '100%',
    height: 216,
    backgroundColor: '#fff',
  },
  doneButton: {
    marginTop: 10,
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

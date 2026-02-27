import { StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { Pressable } from 'react-native';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';

export function OnboardingStepShell({
  step,
  total,
  title,
  description,
  onNext,
  nextLabel = 'Continue',
  onBack,
  backLabel = 'Back',
  disableNext,
  nextLoading,
  children,
}: {
  step: number;
  total: number;
  title: string;
  description?: string;
  onNext: () => void;
  nextLabel?: string;
  onBack?: () => void;
  backLabel?: string;
  disableNext?: boolean;
  nextLoading?: boolean;
  children: React.ReactNode;
}) {
  const progressPercent: DimensionValue = `${Math.max(0, Math.min(100, (step / total) * 100))}%`;

  return (
    <Screen>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backIconButton} accessibilityRole="button" accessibilityLabel={backLabel}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.progress}>{`Step ${step} of ${total}`}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressPercent }]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      <View style={styles.content}>{children}</View>

      <View style={styles.footer}>
        <PrimaryButton label={nextLabel} onPress={onNext} loading={nextLoading} />
        {disableNext ? <Text style={styles.hint}>Select or enter a value to continue.</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  progress: {
    color: '#1f883d',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  backIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d7de',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  backIcon: {
    color: '#1f2328',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d8dee4',
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1f883d',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  description: {
    color: '#4f5d6b',
    lineHeight: 22,
    marginBottom: 14,
  },
  content: {
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
  },
  hint: {
    color: '#6e7781',
    marginTop: 4,
    fontSize: 12,
  },
});

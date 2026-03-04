import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AsteriskBoldText } from '@/components/AsteriskBoldText';
import { parseGoalExplanation } from '@/lib/explanations';

export function GoalExplanationBlock({
  rawExplanation,
  pending,
  retrying,
  onRetry,
}: {
  rawExplanation: string | null | undefined;
  pending?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  if (pending) {
    return (
      <View style={styles.pendingWrap}>
        <Text style={styles.pendingText}>Generating explanation...</Text>
      </View>
    );
  }

  const parsed = parseGoalExplanation(rawExplanation);

  if (!parsed) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>Couldn&apos;t generate explanation.</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} disabled={retrying} style={[styles.retryButton, retrying ? styles.retryButtonDisabled : undefined]}>
            <Text style={styles.retryButtonText}>{retrying ? 'Trying...' : 'Try again'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.listWrap}>
      {parsed.items.map((item, index) => (
        <View key={`${index}-${item.polarity}-${item.text}`} style={styles.row}>
          <Text style={styles.emoji}>{item.polarity === 'negative' ? '❌' : '✅'}</Text>
          <AsteriskBoldText text={item.text} style={styles.rowText} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listWrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  emoji: {
    fontSize: 15,
    lineHeight: 21,
  },
  rowText: {
    flex: 1,
    color: '#1f2328',
    lineHeight: 21,
  },
  errorWrap: {
    gap: 10,
  },
  pendingWrap: {
    gap: 10,
  },
  pendingText: {
    color: '#4f5d6b',
  },
  errorText: {
    color: '#b42318',
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1f883d',
  },
  retryButtonDisabled: {
    opacity: 0.7,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

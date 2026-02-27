import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';

export function Screen({
  children,
  scroll = true,
  topInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  topInset?: boolean;
}) {
  const edges = topInset ? (['top', 'left', 'right', 'bottom'] as const) : (['left', 'right', 'bottom'] as const);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={edges}>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  content: {
    flexGrow: 1,
    padding: 16,
  },
});

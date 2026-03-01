import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

export function Screen({
  children,
  scroll = true,
  topInset = true,
  bottomInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  topInset?: boolean;
  bottomInset?: boolean;
}) {
  const { height } = useWindowDimensions();
  const edges = ([
    ...(topInset ? (['top'] as const) : []),
    'left',
    'right',
    ...(bottomInset ? (['bottom'] as const) : []),
  ] as const);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={edges}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { minHeight: height }]}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.fixedContent, { minHeight: height }]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  fixedContent: {
    flex: 1,
    padding: 16,
  },
});

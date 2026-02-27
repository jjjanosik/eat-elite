import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

export default function IndexScreen() {
  const { session, onboardingComplete, paywallUnlocked, loading } = useAppState();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1f883d" />
      </View>
    );
  }

  return <Redirect href={getNextRoute({ session, onboardingComplete, paywallUnlocked })} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8fa',
  },
});

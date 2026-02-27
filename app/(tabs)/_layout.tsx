import { Redirect, Tabs, router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

function SettingsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#1f883d"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const { session, onboardingComplete, paywallUnlocked, loading } = useAppState();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f6f8fa' }}>
        <ActivityIndicator color="#1f883d" />
      </View>
    );
  }

  const nextRoute = getNextRoute({ session, onboardingComplete, paywallUnlocked });
  if (nextRoute !== '/(tabs)/scan') {
    return <Redirect href={nextRoute} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        tabBarActiveTintColor: '#1f883d',
        headerRight: () => (
          <Pressable
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <SettingsIcon />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    width: 34,
    height: 34,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
});

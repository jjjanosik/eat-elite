import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '@/context/AppStateContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="intro" options={{ title: 'Welcome', headerShown: false }} />
          <Stack.Screen name="auth" options={{ title: 'Sign In', headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ title: 'Onboarding', headerShown: false, animation: 'slide_from_right', animationTypeForReplace: 'pop' }}
          />
          <Stack.Screen name="paywall" options={{ title: 'Choose Plan', headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

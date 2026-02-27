import AsyncStorage from '@react-native-async-storage/async-storage';

const keyForInstall = (installId: string) => `paywall_unlocked:${installId}`;

export async function isPaywallUnlocked(installId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(keyForInstall(installId));
  return raw === 'true';
}

export async function unlockPaywall(installId: string): Promise<void> {
  await AsyncStorage.setItem(keyForInstall(installId), 'true');
}

export async function clearLocalCache(installId: string): Promise<void> {
  await AsyncStorage.removeItem(keyForInstall(installId));
}

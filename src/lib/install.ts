import AsyncStorage from '@react-native-async-storage/async-storage';

const INSTALL_ID_KEY = 'app_install_id';

function generateInstallId(): string {
  return `install_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getOrCreateInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (existing) return existing;

  const next = generateInstallId();
  await AsyncStorage.setItem(INSTALL_ID_KEY, next);
  return next;
}

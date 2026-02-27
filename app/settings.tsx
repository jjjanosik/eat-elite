import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppState } from '@/context/AppStateContext';
import { deleteAccount } from '@/lib/api';

export default function SettingsScreen() {
  const { user, signOut } = useAppState();

  if (!user) {
    return <Redirect href="/auth" />;
  }

  const onDeleteAccount = () => {
    Alert.alert('Delete account', 'This permanently removes your auth user and all linked data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
            await signOut();
            router.replace('/intro');
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unexpected error');
          }
        },
      },
    ]);
  };

  return (
    <Screen topInset={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.bodyText}>{user.email}</Text>
        <Text style={[styles.bodyText, styles.signOutText]} onPress={signOut}>
          Sign Out
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <Text style={styles.bodyText}>Testing Mode - Not Active</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disclaimers</Text>
        <Text style={styles.bodyText}>Informational only. This app does not provide medical advice.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Licenses & References</Text>
        <Text style={styles.linkText} onPress={() => Linking.openURL('https://world.openfoodfacts.org')}>Open Food Facts Attribution</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Controls</Text>
        <Text style={styles.deleteAccountText} onPress={onDeleteAccount}>
          Delete Account
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8dee4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  bodyText: {
    color: '#4f5d6b',
    lineHeight: 22,
  },
  linkText: {
    color: '#1f883d',
    fontWeight: '600',
  },
  deleteAccountText: {
    marginTop: 2,
    color: '#007AFF',
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
  signOutText: {
    marginTop: 6,
    color: '#007AFF',
    fontWeight: '700',
    alignSelf: 'flex-start',
  },
});

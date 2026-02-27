import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppState } from '@/context/AppStateContext';
import { bootstrapUser } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { reopenOnboarding, onboardingComplete, onboardingAnswers } = useAppState();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const initialMode: 'login' | 'signup' = params.mode === 'login' ? 'login' : 'signup';
  const showOnboardingBack = params.from === 'onboarding' || onboardingComplete;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const keyboardAppearance = colorScheme === 'dark' ? 'dark' : 'light';
  const shouldSyncOnboardingProfile = params.from === 'onboarding';

  const cta = useMemo(() => (mode === 'signup' ? 'Create account' : 'Sign in'), [mode]);
  const title = mode === 'signup' ? 'Create Your Account' : 'Sign In';
  const subtitle =
    mode === 'signup'
      ? 'Finish account setup to unlock scanning, history, and goals on this device.'
      : 'Sign in to continue to plan selection and start scanning.';

  useEffect(() => {
    if (params.mode === 'login' || params.mode === 'signup') {
      setMode(params.mode);
    }
  }, [params.mode]);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter email and password.');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim();

      if (mode === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (error) throw error;

        let hasSession = Boolean(signUpData.session);

        if (!hasSession) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (!signInError && signInData.session) {
            hasSession = true;
          }
        }

        if (!hasSession) {
          setMode('login');
          Alert.alert(
            'Account created',
            'Your account was created, but you are not signed in yet. Please sign in to continue.',
          );
          return;
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;

        if (!signInData.session) {
          Alert.alert('Sign in incomplete', 'Please try signing in again.');
          return;
        }
      }

      const bootstrap = await bootstrapUser({
        onboarding: onboardingAnswers,
        fromOnboarding: shouldSyncOnboardingProfile,
      });

      if (bootstrap.needs_onboarding) {
        Alert.alert('Onboarding incomplete', 'Please complete onboarding before continuing.');
        return;
      }

      router.replace('/');
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const goBackToOnboarding = async () => {
    await reopenOnboarding();
    router.replace('/onboarding/notifications');
  };

  return (
    <Screen>
      <View style={styles.header}>
        {showOnboardingBack ? (
          <Pressable
            onPress={() => {
              void goBackToOnboarding();
            }}
            style={styles.backArrowButton}
            accessibilityRole="button"
            accessibilityLabel="Back to onboarding"
          >
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          keyboardAppearance={keyboardAppearance}
          placeholder="you@example.com"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          keyboardAppearance={keyboardAppearance}
          placeholder="At least 8 characters"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        <PrimaryButton label={cta} onPress={submit} loading={loading} />

        {loading ? <ActivityIndicator color="#1f883d" /> : null}

        <Text style={styles.modeText}>
          {mode === 'signup' ? 'Already have an account? ' : 'Need an account? '}
          <Text style={styles.modeLink} onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </Text>
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 18,
  },
  backArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d0d7de',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  backArrowText: {
    color: '#1f2328',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#4f5d6b',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderColor: '#d8dee4',
    borderWidth: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: '#1f2328',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderColor: '#d0d7de',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  modeText: {
    marginTop: 6,
    color: '#4f5d6b',
  },
  modeLink: {
    color: '#1f883d',
    fontWeight: '600',
  },
});

import { Text, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';

export default function IntroScreen() {
  return (
    <Screen scroll={false}>
      <View style={styles.wrapper}>
        <Text style={styles.eyebrow}>Food quality, personalized</Text>
        <Text style={styles.title}>Eat Elite</Text>
        <Text style={styles.subtitle}>
          Scan packaged foods, get a nutrition + additives score, and see AI explanations aligned to your goals.
        </Text>

        <PrimaryButton label="Get Started" onPress={() => router.push('/onboarding/sex')} />
        <Text style={styles.signInText}>
          Already have an account?{' '}
          <Text style={styles.signInLink} onPress={() => router.push('/auth?mode=login')}>
            Sign in
          </Text>
          .
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#1f883d',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    color: '#1f2328',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4f5d6b',
    marginBottom: 28,
  },
  signInText: {
    marginTop: 2,
    color: '#4f5d6b',
    fontSize: 14,
    textAlign: 'center',
  },
  signInLink: {
    color: '#1f883d',
    fontWeight: '700',
  },
});

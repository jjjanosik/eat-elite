import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export function PrimaryButton({
  label,
  onPress,
  loading,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={[styles.button, variant === 'secondary' ? styles.secondary : styles.primary, loading && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#1f2328' : '#fff'} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' ? styles.labelSecondary : styles.labelPrimary]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primary: {
    backgroundColor: '#1f883d',
  },
  secondary: {
    borderWidth: 1,
    borderColor: '#cfd6dd',
    backgroundColor: '#fff',
  },
  disabled: {
    opacity: 0.7,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelPrimary: {
    color: '#fff',
  },
  labelSecondary: {
    color: '#1f2328',
  },
});

import { Pressable, StyleSheet, Text } from 'react-native';

export function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#1f883d',
    borderColor: '#1f883d',
  },
  text: {
    color: '#1f2328',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  textSelected: {
    color: '#fff',
  },
});

import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

type Segment = {
  text: string;
  bold: boolean;
};

function parseAsteriskSegments(value: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('**', cursor);
    if (start === -1) {
      segments.push({ text: value.slice(cursor), bold: false });
      break;
    }

    if (start > cursor) {
      segments.push({ text: value.slice(cursor, start), bold: false });
    }

    const end = value.indexOf('**', start + 2);
    if (end === -1) {
      segments.push({ text: value.slice(start), bold: false });
      break;
    }

    const boldText = value.slice(start + 2, end);
    if (boldText.length > 0) {
      segments.push({ text: boldText, bold: true });
    }

    cursor = end + 2;
  }

  return segments.length > 0 ? segments : [{ text: value, bold: false }];
}

export function AsteriskBoldText({
  text,
  style,
  boldStyle,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
}) {
  const segments = useMemo(() => parseAsteriskSegments(text), [text]);

  return (
    <Text style={style}>
      {segments.map((segment, index) => (
        <Text key={`${index}-${segment.bold ? 'b' : 'n'}`} style={segment.bold ? [styles.bold, boldStyle] : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: '700',
  },
});

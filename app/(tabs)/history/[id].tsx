import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { AsteriskBoldText } from '@/components/AsteriskBoldText';
import { fetchHistoryItem } from '@/lib/api';
import { getScoreIndicatorColor } from '@/lib/score';
import { formatRelativeTime } from '@/lib/time';
import type { HistoryDetailItem } from '@/lib/types';

const HISTORY_DETAIL_BOTTOM_PADDING = 72;

type NutrientDefinition = {
  key: string;
  label: string;
  unit: string;
};

const nutrientDefinitions: NutrientDefinition[] = [
  { key: 'energy-kcal_100g', label: 'Calories', unit: 'kcal' },
  { key: 'fat_100g', label: 'Fat', unit: 'g' },
  { key: 'saturated-fat_100g', label: 'Saturated Fat', unit: 'g' },
  { key: 'carbohydrates_100g', label: 'Carbs', unit: 'g' },
  { key: 'sugars_100g', label: 'Sugar', unit: 'g' },
  { key: 'fiber_100g', label: 'Fiber', unit: 'g' },
  { key: 'proteins_100g', label: 'Protein', unit: 'g' },
  { key: 'salt_100g', label: 'Salt', unit: 'g' },
];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function ClockIcon() {
  return (
    <Svg width={13} height={13} viewBox="2 2 20 20" fill="none">
      <Path
        stroke="#6e7781"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </Svg>
  );
}

export default function HistoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const historyId = useMemo(() => (typeof params.id === 'string' ? params.id : ''), [params.id]);
  const tabBarHeight = useBottomTabBarHeight();
  const [item, setItem] = useState<HistoryDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!historyId) {
      setErrorText('Missing history item id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText(null);

    try {
      const data = await fetchHistoryItem(historyId);
      setItem(data);
    } catch (error) {
      setItem(null);
      setErrorText(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [historyId]);

  useEffect(() => {
    load();
  }, [load]);

  const additives = useMemo(() => {
    if (!item) return [];
    if (Array.isArray(item.inputs_snapshot?.additives_tags) && item.inputs_snapshot.additives_tags.length > 0) {
      return item.inputs_snapshot.additives_tags;
    }
    if (Array.isArray(item.product?.additives_tags) && item.product.additives_tags.length > 0) {
      return item.product.additives_tags;
    }
    return [];
  }, [item]);

  const nutrients = useMemo(() => {
    const source =
      (item?.inputs_snapshot?.nutriments as Record<string, unknown> | undefined) ??
      (item?.product?.nutriments as Record<string, unknown> | undefined) ??
      {};

    return nutrientDefinitions
      .map((definition) => {
        const numeric = toNumber(source[definition.key]);
        if (numeric === null) return null;
        return `${definition.label}: ${numeric} ${definition.unit}`;
      })
      .filter((row): row is string => Boolean(row));
  }, [item]);

  return (
    <Screen topInset={false}>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#1f883d" />
        </View>
      ) : errorText ? (
        <Text style={styles.errorText}>{errorText}</Text>
      ) : item ? (
        <View style={[styles.content, { paddingBottom: tabBarHeight + HISTORY_DETAIL_BOTTOM_PADDING }]}>
          <View style={styles.heroRow}>
            {item.product?.image_url ? (
              <Image source={{ uri: item.product.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder} />
            )}
            <View style={styles.heroMeta}>
              <Text style={styles.title} numberOfLines={2}>
                {item.product?.name ?? 'Unknown product'}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {item.product?.brands ?? 'Unknown brand'}
              </Text>
              <View style={styles.scoreRow}>
                <View style={[styles.scoreDot, { backgroundColor: getScoreIndicatorColor(item.score) }]} />
                <Text style={styles.score}>{item.score}/100</Text>
              </View>
              <View style={styles.timeRow}>
                <ClockIcon />
                <Text style={styles.timeText}>{formatRelativeTime(item.created_at)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Explanation</Text>
            <AsteriskBoldText text={item.ai_response ?? 'No Grok explanation saved for this scan yet.'} style={styles.aiText} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scan Details</Text>
            <Text style={styles.detailText}>Barcode: {item.barcode}</Text>
            <Text style={styles.detailText}>Score Version: {item.score_version}</Text>
            <Text style={styles.detailText}>Weights Version: {item.weights_version}</Text>
            <Text style={styles.detailText}>AI Cached: {item.ai_cached ? 'Yes' : 'No'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.detailText}>
              {item.product?.ingredients_text?.trim() ? item.product.ingredients_text : 'No ingredient text available.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additives</Text>
            {additives.length > 0 ? (
              additives.map((additive) => (
                <Text key={additive} style={styles.detailText}>
                  {'- '}
                  {additive}
                </Text>
              ))
            ) : (
              <Text style={styles.detailText}>No additive data available.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition (per 100g)</Text>
            {nutrients.length > 0 ? (
              nutrients.map((row) => (
                <Text key={row} style={styles.detailText}>
                  {row}
                </Text>
              ))
            ) : (
              <Text style={styles.detailText}>No nutrition data available.</Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.errorText}>History item not found.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroMeta: {
    flex: 1,
    minWidth: 0,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 10,
  },
  imagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#eef1f4',
  },
  title: {
    color: '#1f2328',
    fontSize: 19,
    fontWeight: '700',
  },
  meta: {
    marginTop: 4,
    color: '#6e7781',
  },
  timeRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: '#6e7781',
  },
  scoreRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  score: {
    color: '#1f2328',
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    paddingTop: 4,
  },
  sectionTitle: {
    color: '#1f2328',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d8dee4',
  },
  detailText: {
    color: '#1f2328',
    marginBottom: 4,
  },
  aiText: {
    color: '#1f2328',
    lineHeight: 22,
  },
  errorText: {
    color: '#b42318',
    textAlign: 'center',
    marginTop: 40,
  },
});

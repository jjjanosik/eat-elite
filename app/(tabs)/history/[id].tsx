import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { GoalExplanationBlock } from '@/components/GoalExplanationBlock';
import { fetchHistoryItem, regenerateHistoryExplanation } from '@/lib/api';
import { getAdditivesIndicatorColor, getScoreIndicatorColor } from '@/lib/score';
import { formatRelativeTime } from '@/lib/time';
import type { HistoryDetailItem } from '@/lib/types';

const HISTORY_DETAIL_BOTTOM_PADDING = 72;

type NutrientDefinition = {
  key100g: string;
  keyServing: string;
  label: string;
  unit: string;
};

const nutrientDefinitions: NutrientDefinition[] = [
  { key100g: 'energy-kcal_100g', keyServing: 'energy-kcal_serving', label: 'Calories', unit: 'kcal' },
  { key100g: 'fat_100g', keyServing: 'fat_serving', label: 'Fat', unit: 'g' },
  { key100g: 'saturated-fat_100g', keyServing: 'saturated-fat_serving', label: 'Saturated Fat', unit: 'g' },
  { key100g: 'carbohydrates_100g', keyServing: 'carbohydrates_serving', label: 'Carbs', unit: 'g' },
  { key100g: 'sugars_100g', keyServing: 'sugars_serving', label: 'Sugar', unit: 'g' },
  { key100g: 'fiber_100g', keyServing: 'fiber_serving', label: 'Fiber', unit: 'g' },
  { key100g: 'proteins_100g', keyServing: 'proteins_serving', label: 'Protein', unit: 'g' },
  { key100g: 'salt_100g', keyServing: 'salt_serving', label: 'Salt', unit: 'g' },
];

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatNutrientValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '');
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
  const [retryingExplanation, setRetryingExplanation] = useState(false);
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

  const retryExplanation = useCallback(async () => {
    if (!item || retryingExplanation) return;

    setRetryingExplanation(true);
    try {
      const refreshed = await regenerateHistoryExplanation(item.id);
      setItem((current) => (current ? { ...current, ai_response: refreshed.ai_response, ai_cached: false } : current));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setRetryingExplanation(false);
    }
  }, [item, retryingExplanation]);

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
  const additivesCount = useMemo(() => {
    const snapshotCount = item?.inputs_snapshot?.additives_count;
    if (typeof snapshotCount === 'number' && Number.isFinite(snapshotCount)) {
      return snapshotCount;
    }
    return additives.length;
  }, [additives.length, item?.inputs_snapshot?.additives_count]);
  const ingredientsText = useMemo(
    () => item?.inputs_snapshot?.ingredients_text ?? item?.product?.ingredients_text ?? null,
    [item?.inputs_snapshot?.ingredients_text, item?.product?.ingredients_text],
  );
  const hasIngredients = Boolean(ingredientsText?.trim());

  const preferredNutrition = useMemo(() => {
    const source =
      (item?.inputs_snapshot?.nutriments as Record<string, unknown> | undefined) ??
      (item?.product?.nutriments as Record<string, unknown> | undefined) ??
      {};
    const servingQuantityFromSnapshot = toNumber(item?.inputs_snapshot?.serving_quantity);
    const servingQuantityFromProduct = item?.product?.serving_quantity ?? null;
    const servingQuantityFromNutriments = toNumber((source as Record<string, unknown>).serving_quantity);
    const servingQuantity = servingQuantityFromSnapshot ?? servingQuantityFromProduct ?? servingQuantityFromNutriments;
    const servingSize =
      item?.inputs_snapshot?.serving_size ??
      item?.product?.serving_size ??
      null;
    const hasServingMetadata = Boolean(servingSize?.trim() || servingQuantity !== null);

    const hasDirectServingValues = nutrientDefinitions.some((definition) =>
      toNumber(source[definition.keyServing]) !== null,
    );
    const hasAny100gValues = nutrientDefinitions.some((definition) =>
      toNumber(source[definition.key100g]) !== null,
    );
    const canDeriveServingFrom100g = servingQuantity !== null && hasAny100gValues;
    const useServingBasis = hasDirectServingValues || (hasServingMetadata && canDeriveServingFrom100g);

    const rows = nutrientDefinitions
      .map((definition) => {
        if (useServingBasis) {
          const directServing = toNumber(source[definition.keyServing]);
          if (directServing !== null) {
            return `${definition.label}: ${formatNutrientValue(directServing)} ${definition.unit}`;
          }

          if (servingQuantity !== null) {
            const value100g = toNumber(source[definition.key100g]);
            if (value100g !== null) {
              const converted = (value100g * servingQuantity) / 100;
              return `${definition.label}: ${formatNutrientValue(converted)} ${definition.unit}`;
            }
          }
          return null;
        }

        const value100g = toNumber(source[definition.key100g]);
        if (value100g === null) return null;
        return `${definition.label}: ${formatNutrientValue(value100g)} ${definition.unit}`;
      })
      .filter((row): row is string => Boolean(row));

    return {
      sectionTitle: useServingBasis ? 'Nutrition (per serving)' : 'Nutrition (per 100g)',
      rows,
      fallbackMessage: useServingBasis
        ? 'No per-serving nutrition data available.'
        : 'No nutrition data available.',
    };
  }, [item]);
  const servingInfoRows = useMemo(() => {
    if (!item) return [];

    const servingSize =
      item.inputs_snapshot?.serving_size ??
      item.product?.serving_size ??
      null;
    const servingQuantity =
      item.inputs_snapshot?.serving_quantity ??
      item.product?.serving_quantity ??
      null;
    const packageQuantity =
      item.inputs_snapshot?.package_quantity ??
      item.product?.package_quantity ??
      null;
    const rows: string[] = [];
    if (servingSize && servingSize.trim()) rows.push(`Serving Size: ${servingSize}`);
    if (typeof servingQuantity === 'number' && Number.isFinite(servingQuantity)) {
      rows.push(`Serving Quantity: ${servingQuantity}`);
    }
    if (packageQuantity && packageQuantity.trim()) rows.push(`Package Quantity: ${packageQuantity}`);
    return rows;
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
            <GoalExplanationBlock
              rawExplanation={item.ai_response}
              retrying={retryingExplanation}
              onRetry={() => {
                void retryExplanation();
              }}
            />
          </View>

          {/* Scan details section (disabled)
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scan Details</Text>
            <Text style={styles.detailText}>Barcode: {item.barcode}</Text>
            <Text style={styles.detailText}>Score Version: {item.score_version}</Text>
            <Text style={styles.detailText}>Weights Version: {item.weights_version}</Text>
            <Text style={styles.detailText}>AI Cached: {item.ai_cached ? 'Yes' : 'No'}</Text>
          </View>
          */}

          {/* Ingredients section (disabled)
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <Text style={styles.detailText}>
              {item.product?.ingredients_text?.trim() ? item.product.ingredients_text : 'No ingredient text available.'}
            </Text>
          </View>
          */}

          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              {hasIngredients ? (
                <View
                  style={[
                    styles.sectionTitleDot,
                    { backgroundColor: getAdditivesIndicatorColor(additivesCount) },
                  ]}
                />
              ) : null}
              <Text style={styles.sectionTitleText}>
                {hasIngredients ? `${additivesCount} Additives` : 'Additives'}
              </Text>
            </View>
            {!hasIngredients ? (
              <Text style={styles.detailText}>No additive data available.</Text>
            ) : additives.length > 0 ? (
              additives.map((additive) => (
                <Text key={additive} style={styles.detailText}>
                  {'- '}
                  {additive}
                </Text>
              ))
            ) : null}
          </View>

          {/* Serving info section (disabled)
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Serving Info</Text>
            {servingInfoRows.length > 0 ? (
              servingInfoRows.map((row) => (
                <Text key={row} style={styles.detailText}>
                  {row}
                </Text>
              ))
            ) : (
              <Text style={styles.detailText}>No serving-size data available.</Text>
            )}
          </View>
          */}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{preferredNutrition.sectionTitle}</Text>
            {preferredNutrition.rows.length > 0 ? (
              preferredNutrition.rows.map((row) => (
                <Text key={row} style={styles.detailText}>
                  {row}
                </Text>
              ))
            ) : (
              <Text style={styles.detailText}>{preferredNutrition.fallbackMessage}</Text>
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
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d8dee4',
  },
  sectionTitleText: {
    color: '#1f2328',
    fontSize: 24,
    fontWeight: '700',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 12,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#d8dee4',
  },
  sectionTitleDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
  },
  detailText: {
    color: '#1f2328',
    marginBottom: 4,
  },
  errorText: {
    color: '#b42318',
    textAlign: 'center',
    marginTop: 40,
  },
});

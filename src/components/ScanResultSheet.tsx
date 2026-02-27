import { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  ScrollView,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScanResult } from '@/lib/types';

const SHEET_VISIBLE_HEIGHT = 190;
const SHEET_DISMISS_DRAG = 90;
const NUTRIENT_DEFINITIONS = [
  { key: 'energy-kcal_100g', label: 'Calories', unit: 'kcal' },
  { key: 'fat_100g', label: 'Fat', unit: 'g' },
  { key: 'saturated-fat_100g', label: 'Saturated Fat', unit: 'g' },
  { key: 'carbohydrates_100g', label: 'Carbs', unit: 'g' },
  { key: 'sugars_100g', label: 'Sugar', unit: 'g' },
  { key: 'fiber_100g', label: 'Fiber', unit: 'g' },
  { key: 'proteins_100g', label: 'Protein', unit: 'g' },
  { key: 'salt_100g', label: 'Salt', unit: 'g' },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function ScanResultSheet({
  result,
  onDismiss,
}: {
  result: ScanResult;
  onDismiss: () => void;
}) {
  const sheetTranslateY = useRef(new Animated.Value(1000)).current;
  const sheetStartYRef = useRef(0);
  const sheetCurrentYRef = useRef(1000);
  const sheetCollapsedYRef = useRef(0);
  const sheetDismissYRef = useRef(0);
  const hasOpenedRef = useRef(false);

  const nutritionRows = useMemo(() => {
    const nutriments = result.product.nutriments ?? {};
    return NUTRIENT_DEFINITIONS.map((definition) => {
      const value = toNumber((nutriments as Record<string, unknown>)[definition.key]);
      if (value === null) return null;
      return `${definition.label}: ${value} ${definition.unit}`;
    }).filter((row): row is string => Boolean(row));
  }, [result.product.nutriments]);

  const animateSheetTo = useCallback(
    (value: number, velocity = 0) => {
      Animated.spring(sheetTranslateY, {
        toValue: value,
        velocity,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start(() => {
        sheetCurrentYRef.current = value;
      });
    },
    [sheetTranslateY],
  );

  const dismissSheet = useCallback(() => {
    const dismissY = sheetDismissYRef.current;
    Animated.timing(sheetTranslateY, {
      toValue: dismissY,
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      sheetCurrentYRef.current = dismissY;
      onDismiss();
    });
  }, [onDismiss, sheetTranslateY]);

  const onSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height <= 0) return;

      const collapsedY = Math.max(height - SHEET_VISIBLE_HEIGHT, 0);
      const dismissY = height + 80;
      sheetCollapsedYRef.current = collapsedY;
      sheetDismissYRef.current = dismissY;

      if (!hasOpenedRef.current) {
        hasOpenedRef.current = true;
        sheetCurrentYRef.current = dismissY;
        sheetTranslateY.setValue(dismissY);
        Animated.timing(sheetTranslateY, {
          toValue: collapsedY,
          duration: 210,
          useNativeDriver: true,
        }).start(() => {
          sheetCurrentYRef.current = collapsedY;
        });
        return;
      }

      const clamped = clamp(sheetCurrentYRef.current, 0, dismissY);
      sheetCurrentYRef.current = clamped;
      sheetTranslateY.setValue(clamped);
    },
    [sheetTranslateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
        onPanResponderGrant: () => {
          sheetTranslateY.stopAnimation((value) => {
            sheetStartYRef.current = value;
            sheetCurrentYRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const dismissY = sheetDismissYRef.current;
          const nextY = clamp(sheetStartYRef.current + gestureState.dy, 0, dismissY);
          sheetCurrentYRef.current = nextY;
          sheetTranslateY.setValue(nextY);
        },
        onPanResponderRelease: (_, gestureState) => {
          const dismissY = sheetDismissYRef.current;
          const collapsedY = sheetCollapsedYRef.current;
          const finalY = clamp(sheetStartYRef.current + gestureState.dy, 0, dismissY);
          const shouldDismiss =
            finalY > collapsedY + SHEET_DISMISS_DRAG || (gestureState.vy > 1.1 && finalY > collapsedY);

          if (shouldDismiss) {
            dismissSheet();
            return;
          }

          const shouldExpand = finalY < collapsedY * 0.55 || gestureState.vy < -0.8;
          if (shouldExpand) {
            animateSheetTo(0, gestureState.vy);
          } else {
            animateSheetTo(collapsedY, gestureState.vy);
          }
        },
        onPanResponderTerminate: () => {
          animateSheetTo(sheetCollapsedYRef.current);
        },
      }),
    [animateSheetTo, dismissSheet, sheetTranslateY],
  );

  return (
    <View style={styles.resultOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.resultSheet, { transform: [{ translateY: sheetTranslateY }] }]} onLayout={onSheetLayout}>
        <View style={styles.resultCard}>
          <View style={styles.dragHandleWrap} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
            <View style={styles.productHeader}>
              {result.product.image_url ? (
                <Image source={{ uri: result.product.image_url }} style={styles.productImage} />
              ) : (
                <View style={styles.productImagePlaceholder} />
              )}
              <View style={styles.productMeta}>
                <Text style={styles.productName} numberOfLines={2}>
                  {result.product.name ?? 'Unknown product'}
                </Text>
                <Text style={styles.metaText} numberOfLines={2}>
                  {result.product.brands ?? 'Unknown brand'}
                </Text>
                <Text style={styles.scoreText}>Score: {result.score}/100</Text>
              </View>
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.infoHeading}>Ingredients</Text>
              <Text style={styles.infoText}>
                {result.product.ingredients_text?.trim()
                  ? result.product.ingredients_text
                  : 'No ingredient text available.'}
              </Text>
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.infoHeading}>Additives</Text>
              {result.product.additives_tags.length > 0 ? (
                result.product.additives_tags.map((additive) => (
                  <Text key={additive} style={styles.infoText}>
                    {'- '}
                    {additive}
                  </Text>
                ))
              ) : (
                <Text style={styles.infoText}>No additive data available.</Text>
              )}
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.infoHeading}>Nutrition (per 100g)</Text>
              {nutritionRows.length > 0 ? (
                nutritionRows.map((row) => (
                  <Text key={row} style={styles.infoText}>
                    {row}
                  </Text>
                ))
              ) : (
                <Text style={styles.infoText}>No nutrition data available.</Text>
              )}
            </View>
            <Text style={styles.aiText}>{result.ai_response}</Text>
            <Text style={styles.cacheMetaText}>
              {result.ai_cached ? 'AI explanation reused from cache' : 'New AI explanation generated'}
            </Text>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: -16,
    left: -16,
    right: -16,
    justifyContent: 'flex-end',
  },
  resultSheet: {
    width: '100%',
    height: '100%',
    minHeight: 320,
  },
  resultCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#d8dee4',
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d0d7de',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 24,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  productImage: {
    width: 96,
    height: 96,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#eef1f4',
  },
  productMeta: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2328',
  },
  metaText: {
    color: '#4f5d6b',
    marginTop: 4,
  },
  scoreText: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '800',
    color: '#18B84A',
  },
  aiText: {
    marginTop: 12,
    color: '#1f2328',
    lineHeight: 22,
  },
  cacheMetaText: {
    marginTop: 8,
    color: '#4f5d6b',
  },
  infoSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eaeef2',
    paddingTop: 10,
  },
  infoHeading: {
    color: '#1f2328',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#4f5d6b',
    lineHeight: 20,
  },
});

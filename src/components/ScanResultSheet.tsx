import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
  ScrollView,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AsteriskBoldText } from '@/components/AsteriskBoldText';
import { getScoreIndicatorColor } from '@/lib/score';
import type { ScanResult } from '@/lib/types';

const SHEET_VISIBLE_HEIGHT = 190;
const SHEET_DISMISS_DRAG = 90;
const SHEET_COLLAPSED_RAISE_RATIO = 0.1;
const SHEET_COLLAPSE_FROM_EXPANDED_DRAG_PX = 10;
const SHEET_DRAG_ACTIVATION_DY = 8;
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
  expandedTopOffset = 0,
  bottomContentPadding = 24,
}: {
  result: ScanResult;
  onDismiss: () => void;
  expandedTopOffset?: number;
  bottomContentPadding?: number;
}) {
  const sheetTranslateY = useRef(new Animated.Value(1000)).current;
  const sheetScrollRef = useRef<ScrollView | null>(null);
  const sheetScrollOffsetRef = useRef(0);
  const sheetStartYRef = useRef(0);
  const sheetLastLayoutHeightRef = useRef(0);
  const sheetCurrentYRef = useRef(1000);
  const sheetExpandedYRef = useRef(Math.max(0, expandedTopOffset));
  const sheetCollapsedYRef = useRef(0);
  const sheetDismissYRef = useRef(0);
  const hasOpenedRef = useRef(false);
  const scrollEnabledRef = useRef(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const setSheetScrollEnabled = useCallback((next: boolean) => {
    if (scrollEnabledRef.current === next) return;
    scrollEnabledRef.current = next;
    setScrollEnabled(next);
  }, []);

  useEffect(() => {
    const listenerId = sheetTranslateY.addListener(({ value }) => {
      sheetCurrentYRef.current = value;
    });
    return () => {
      sheetTranslateY.removeListener(listenerId);
    };
  }, [sheetTranslateY]);

  const nutritionRows = useMemo(() => {
    const nutriments = result.product.nutriments ?? {};
    return NUTRIENT_DEFINITIONS.map((definition) => {
      const value = toNumber((nutriments as Record<string, unknown>)[definition.key]);
      if (value === null) return null;
      return `${definition.label}: ${value} ${definition.unit}`;
    }).filter((row): row is string => Boolean(row));
  }, [result.product.nutriments]);

  const resetSheetContentToTop = useCallback(() => {
    sheetScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const animateSheetTo = useCallback(
    (value: number) => {
      Animated.timing(sheetTranslateY, {
        toValue: value,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        if (value > sheetExpandedYRef.current + 0.5) {
          resetSheetContentToTop();
        }
      });
    },
    [resetSheetContentToTop, sheetTranslateY],
  );

  const dismissSheet = useCallback(() => {
    const dismissY = sheetDismissYRef.current;
    setSheetScrollEnabled(false);
    Animated.timing(sheetTranslateY, {
      toValue: dismissY,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [onDismiss, setSheetScrollEnabled, sheetTranslateY]);

  const onSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height <= 0) return;

      const layoutHeightChanged = sheetLastLayoutHeightRef.current !== height;
      sheetLastLayoutHeightRef.current = height;
      const expandedY = Math.max(0, expandedTopOffset);
      sheetExpandedYRef.current = expandedY;
      const collapsedRaise = Math.floor(height * SHEET_COLLAPSED_RAISE_RATIO);
      const collapsedY = Math.max(height - SHEET_VISIBLE_HEIGHT - collapsedRaise, expandedY);
      const dismissY = height + 80;
      sheetCollapsedYRef.current = collapsedY;
      sheetDismissYRef.current = dismissY;

      if (!hasOpenedRef.current) {
        hasOpenedRef.current = true;
        sheetCurrentYRef.current = dismissY;
        sheetTranslateY.setValue(dismissY);
        Animated.timing(sheetTranslateY, {
          toValue: collapsedY,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setSheetScrollEnabled(false);
        });
        return;
      }

      if (!layoutHeightChanged) {
        return;
      }

      const clamped = clamp(sheetCurrentYRef.current, expandedY, dismissY);
      sheetTranslateY.setValue(clamped);
    },
    [expandedTopOffset, setSheetScrollEnabled, sheetTranslateY],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (Math.abs(gestureState.dy) <= SHEET_DRAG_ACTIVATION_DY) return false;
          if (!scrollEnabledRef.current) return true;

          const expandedY = sheetExpandedYRef.current;
          const isExpanded = sheetCurrentYRef.current <= expandedY + 8;
          if (!isExpanded) return true;

          const isPullingDown = gestureState.dy > 0;
          const isScrollAtTop = sheetScrollOffsetRef.current <= 0;
          return isPullingDown && isScrollAtTop;
        },
        onPanResponderGrant: () => {
          setSheetScrollEnabled(false);
          // Seed from current value before stopAnimation callback to avoid first-frame jumps.
          sheetStartYRef.current = sheetCurrentYRef.current;
          sheetTranslateY.stopAnimation((value) => {
            sheetStartYRef.current = value;
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const expandedY = sheetExpandedYRef.current;
          const dismissY = sheetDismissYRef.current;
          const nextY = clamp(sheetStartYRef.current + gestureState.dy, expandedY, dismissY);
          sheetTranslateY.setValue(nextY);
        },
        onPanResponderRelease: (_, gestureState) => {
          const expandedY = sheetExpandedYRef.current;
          const dismissY = sheetDismissYRef.current;
          const collapsedY = sheetCollapsedYRef.current;
          const finalY = clamp(sheetStartYRef.current + gestureState.dy, expandedY, dismissY);
          const startedExpanded = sheetStartYRef.current <= expandedY + 8;
          const draggedDownFromExpanded = finalY - expandedY;
          const shouldCollapseFromExpanded = startedExpanded && draggedDownFromExpanded >= SHEET_COLLAPSE_FROM_EXPANDED_DRAG_PX;
          const shouldDismiss =
            finalY > collapsedY + SHEET_DISMISS_DRAG || (gestureState.vy > 1.1 && finalY > collapsedY);

          if (shouldDismiss) {
            dismissSheet();
            return;
          }

          if (shouldCollapseFromExpanded) {
            setSheetScrollEnabled(false);
            animateSheetTo(collapsedY);
            return;
          }

          const expandThreshold = expandedY + (collapsedY - expandedY) * 0.55;
          const shouldExpand = finalY < expandThreshold || gestureState.vy < -0.8;
          if (shouldExpand) {
            setSheetScrollEnabled(true);
            animateSheetTo(expandedY);
          } else {
            setSheetScrollEnabled(false);
            animateSheetTo(collapsedY);
          }
        },
        onPanResponderTerminate: () => {
          setSheetScrollEnabled(false);
          animateSheetTo(sheetCollapsedYRef.current);
        },
      }),
    [animateSheetTo, dismissSheet, setSheetScrollEnabled, sheetTranslateY],
  );

  const onSheetScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    sheetScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return (
    <View style={styles.resultOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.resultSheet, { transform: [{ translateY: sheetTranslateY }] }]} onLayout={onSheetLayout}>
        <View style={styles.resultCard} {...panResponder.panHandlers}>
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>
          <ScrollView
            ref={sheetScrollRef}
            style={styles.sheetScroll}
            contentContainerStyle={[styles.sheetScrollContent, { paddingBottom: bottomContentPadding }]}
            scrollEnabled={scrollEnabled}
            onScroll={onSheetScroll}
            scrollEventThrottle={16}
          >
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
                <View style={styles.scoreRow}>
                  <View style={[styles.scoreDot, { backgroundColor: getScoreIndicatorColor(result.score) }]} />
                  <Text style={styles.scoreText}>{result.score}/100</Text>
                </View>
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
            <AsteriskBoldText text={result.ai_response} style={styles.aiText} />
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
    flexGrow: 1,
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
  scoreRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2328',
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

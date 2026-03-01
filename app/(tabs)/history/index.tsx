import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { deleteHistoryItem, fetchHistory } from '@/lib/api';
import { getScoreIndicatorColor } from '@/lib/score';
import { formatRelativeTime } from '@/lib/time';
import type { HistoryListItem } from '@/lib/types';

const DELETE_ACTION_WIDTH = 110;
const HISTORY_BOTTOM_PADDING = 72;
const DELETE_ACTION_RED = '#E53945';
const DELETE_FOLLOW_EDGE_GAP = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function RowChevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.chevron}>
      <Path stroke="#6e7781" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </Svg>
  );
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

function TrashIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.deleteIcon}>
      <Path
        stroke="#fff"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </Svg>
  );
}

function HistorySwipeRow({
  id,
  item,
  deleting,
  onPress,
  onDelete,
  onSwipeStart,
  onSwipeEnd,
}: {
  id: string;
  item: HistoryListItem;
  deleting: boolean;
  onPress: () => void;
  onDelete: () => Promise<boolean>;
  onSwipeStart: (id: string) => void;
  onSwipeEnd: (id: string) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const crossedDeleteThresholdRef = useRef(false);
  const [rowWidth, setRowWidth] = useState(0);

  const deleteTriggerDistance = useMemo(() => {
    if (rowWidth <= 0) return 170;
    return Math.min(220, Math.max(130, Math.floor(rowWidth * 0.45)));
  }, [rowWidth]);

  const revealDistance = useMemo(() => Math.max(DELETE_ACTION_WIDTH + 12, Math.floor(rowWidth * 0.3)), [rowWidth]);
  const maxSwipeDistance = useMemo(() => Math.max(revealDistance + 100, Math.floor(rowWidth * 0.9)), [revealDistance, rowWidth]);
  const deleteActionTranslateX = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-maxSwipeDistance, -deleteTriggerDistance, 0],
        outputRange: [
          -(maxSwipeDistance - DELETE_ACTION_WIDTH - DELETE_FOLLOW_EDGE_GAP),
          -(deleteTriggerDistance - DELETE_ACTION_WIDTH - DELETE_FOLLOW_EDGE_GAP),
          0,
        ],
        extrapolate: 'clamp',
      }),
    [deleteTriggerDistance, maxSwipeDistance, translateX],
  );

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(translateX, {
        toValue,
        useNativeDriver: true,
        bounciness: 0,
        speed: 16,
      }).start(({ finished }) => {
        if (finished) currentXRef.current = toValue;
      });
    },
    [translateX],
  );

  const triggerDeleteThresholdFeedback = useCallback(() => {
    const style =
      Haptics.ImpactFeedbackStyle.Heavy ??
      Haptics.ImpactFeedbackStyle.Rigid ??
      Haptics.ImpactFeedbackStyle.Medium ??
      Haptics.ImpactFeedbackStyle.Light;
    void Haptics.impactAsync(style);
  }, []);

  const runDelete = useCallback(async (): Promise<boolean> => {
    if (deleting) return false;

    const target = rowWidth > 0 ? -rowWidth : -420;
    const animationSuccess = await new Promise<boolean>((resolve) => {
      Animated.timing(translateX, {
        toValue: target,
        duration: 150,
        useNativeDriver: true,
      }).start(({ finished }) => resolve(finished));
    });

    if (!animationSuccess) {
      animateTo(0);
      return false;
    }

    const deleted = await onDelete();
    if (!deleted) {
      animateTo(0);
      return false;
    }

    return true;
  }, [animateTo, deleting, onDelete, rowWidth, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const horizontal = Math.abs(gestureState.dx);
          const vertical = Math.abs(gestureState.dy);
          return horizontal > 8 && horizontal > vertical;
        },
        onPanResponderGrant: () => {
          onSwipeStart(id);
          crossedDeleteThresholdRef.current = false;
          translateX.stopAnimation((value) => {
            startXRef.current = value;
            currentXRef.current = value;
          });
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gestureState) => {
          const next = clamp(startXRef.current + gestureState.dx, -maxSwipeDistance, 0);
          const hasCrossedDeleteThreshold = next <= -deleteTriggerDistance;

          if (hasCrossedDeleteThreshold && !crossedDeleteThresholdRef.current) {
            crossedDeleteThresholdRef.current = true;
            triggerDeleteThresholdFeedback();
          } else if (!hasCrossedDeleteThreshold && crossedDeleteThresholdRef.current) {
            crossedDeleteThresholdRef.current = false;
          }

          currentXRef.current = next;
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          onSwipeEnd(id);
          const finalX = clamp(startXRef.current + gestureState.dx, -maxSwipeDistance, 0);
          currentXRef.current = finalX;
          const shouldDelete =
            finalX <= -deleteTriggerDistance || (gestureState.vx <= -1.25 && finalX <= -revealDistance * 0.8);

          if (shouldDelete) {
            triggerDeleteThresholdFeedback();
            crossedDeleteThresholdRef.current = false;
            void runDelete();
            return;
          }

          crossedDeleteThresholdRef.current = false;
          if (finalX <= -revealDistance * 0.45) {
            animateTo(-DELETE_ACTION_WIDTH);
          } else {
            animateTo(0);
          }
        },
        onPanResponderTerminate: () => {
          onSwipeEnd(id);
          crossedDeleteThresholdRef.current = false;
          const current = clamp(currentXRef.current, -maxSwipeDistance, 0);
          if (current <= -revealDistance * 0.45) {
            animateTo(-DELETE_ACTION_WIDTH);
          } else {
            animateTo(0);
          }
        },
      }),
    [
      animateTo,
      deleteTriggerDistance,
      id,
      maxSwipeDistance,
      onSwipeEnd,
      onSwipeStart,
      revealDistance,
      runDelete,
      translateX,
      triggerDeleteThresholdFeedback,
    ],
  );

  return (
    <View style={styles.swipeContainer} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      <View style={styles.deleteBackground}>
        <Animated.View style={{ transform: [{ translateX: deleteActionTranslateX }] }}>
          <Pressable onPress={() => void runDelete()} disabled={deleting} style={[styles.deleteButton, deleting ? styles.deleteButtonDisabled : undefined]}>
            <TrashIcon />
            <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
          </Pressable>
        </Animated.View>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable onPress={onPress} style={styles.row} disabled={deleting}>
          <View style={styles.headerRow}>
            {item.product?.image_url ? (
              <Image source={{ uri: item.product.image_url }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder} />
            )}
            <View style={styles.headerMeta}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {item.product?.name ?? 'Unknown product'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
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
            <RowChevron />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function HistoryScreen() {
  const [items, setItems] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [activeSwipeRowId, setActiveSwipeRowId] = useState<string | null>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const deletingRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchHistory(50);
      setItems(rows);
    } catch (error) {
      Alert.alert('History error', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(async (historyId: string): Promise<boolean> => {
    if (deletingRef.current.has(historyId)) return false;

    deletingRef.current.add(historyId);
    setDeletingIds((current) => ({ ...current, [historyId]: true }));

    try {
      await deleteHistoryItem(historyId);
      setItems((current) => current.filter((item) => item.id !== historyId));
      setActiveSwipeRowId((current) => (current === historyId ? null : current));
      return true;
    } catch (error) {
      Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unexpected error');
      return false;
    } finally {
      deletingRef.current.delete(historyId);
      setDeletingIds((current) => {
        const next = { ...current };
        delete next[historyId];
        return next;
      });
    }
  }, []);

  const handleSwipeStart = useCallback((historyId: string) => {
    setActiveSwipeRowId(historyId);
  }, []);

  const handleSwipeEnd = useCallback((historyId: string) => {
    setActiveSwipeRowId((current) => (current === historyId ? null : current));
  }, []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#1f883d" />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + HISTORY_BOTTOM_PADDING }]}
          data={items}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          scrollEnabled={activeSwipeRowId === null}
          renderItem={({ item }) => (
            <HistorySwipeRow
              id={item.id}
              item={item}
              deleting={Boolean(deletingIds[item.id])}
              onDelete={() => handleDelete(item.id)}
              onPress={() => router.push({ pathname: '/(tabs)/history/[id]', params: { id: item.id } })}
              onSwipeStart={handleSwipeStart}
              onSwipeEnd={handleSwipeEnd}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No scans yet. Use the Scan tab to add your first item.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  list: {
    flex: 1,
  },
  swipeContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#d8dee4',
    overflow: 'hidden',
  },
  row: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: DELETE_ACTION_RED,
  },
  deleteButton: {
    width: DELETE_ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DELETE_ACTION_RED,
  },
  deleteButtonDisabled: {
    backgroundColor: DELETE_ACTION_RED,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteIcon: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: '#eef1f4',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2328',
  },
  meta: {
    color: '#6e7781',
    marginTop: 4,
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
    fontWeight: '700',
    fontSize: 16,
  },
  chevron: {
    marginLeft: 4,
  },
  empty: {
    color: '#4f5d6b',
    textAlign: 'center',
    marginTop: 40,
  },
});

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
import { router } from 'expo-router';
import { deleteHistoryItem, fetchHistory } from '@/lib/api';
import type { HistoryListItem } from '@/lib/types';

const DELETE_ACTION_WIDTH = 110;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown time';

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} ago`;
  }

  const minutes = Math.max(1, Math.floor(seconds / 60));
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const hours = Math.max(1, Math.floor(minutes / 60));
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.max(1, Math.floor(hours / 24));
  if (days < 7) {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  const weeks = Math.max(1, Math.floor(days / 7));
  if (weeks < 4) {
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }

  const months = Math.max(1, Math.floor(days / 30));
  if (months < 12) {
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }

  const years = Math.max(1, Math.floor(days / 365));
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function HistorySwipeRow({
  id,
  item,
  index,
  deleting,
  onPress,
  onDelete,
  onSwipeStart,
  onSwipeEnd,
}: {
  id: string;
  item: HistoryListItem;
  index: number;
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
    <View style={[styles.swipeContainer, index === 0 ? styles.firstRow : undefined]} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      <View style={styles.deleteBackground}>
        <Pressable onPress={() => void runDelete()} disabled={deleting} style={[styles.deleteButton, deleting ? styles.deleteButtonDisabled : undefined]}>
          <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
        </Pressable>
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
              <Text style={styles.meta}>{formatRelativeTime(item.created_at)}</Text>
              <Text style={styles.score}>Score: {item.score}/100</Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
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
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          onRefresh={load}
          refreshing={loading}
          scrollEnabled={activeSwipeRowId === null}
          renderItem={({ item, index }) => (
            <HistorySwipeRow
              id={item.id}
              item={item}
              index={index}
              deleting={Boolean(deletingIds[item.id])}
              onDelete={() => handleDelete(item.id)}
              onPress={() => router.push({ pathname: '/history/[id]', params: { id: item.id } })}
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
    backgroundColor: '#f6f8fa',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 24,
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
  firstRow: {
    borderTopWidth: 1,
    borderTopColor: '#d8dee4',
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
  },
  deleteButton: {
    width: DELETE_ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1242f',
  },
  deleteButtonDisabled: {
    backgroundColor: '#f17f86',
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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
    color: '#4f5d6b',
    marginTop: 4,
  },
  score: {
    marginTop: 6,
    color: '#18B84A',
    fontWeight: '800',
    fontSize: 22,
  },
  chevron: {
    color: '#8c959f',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 4,
  },
  empty: {
    color: '#4f5d6b',
    textAlign: 'center',
    marginTop: 40,
  },
});

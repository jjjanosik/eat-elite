import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

type Plan = 'monthly' | 'annual';
const ANNUAL_BORDER_WIDTH = 1;
const CARD_RADIUS = 14;
const DOT_SIZE = ANNUAL_BORDER_WIDTH;
const EDGE_STEPS = 20;
const CORNER_STEPS = 14;
const TOTAL_DOTS = 100;
const NOOP = () => {};

type DotPath = {
  inputRange: number[];
  xValues: number[];
  yValues: number[];
  totalLength: number;
};

function getTailColor(_index: number, _total: number): string {
  return '#ffffff';
}

function buildBorderDotPath(width: number, height: number): DotPath | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  const inset = ANNUAL_BORDER_WIDTH / 2;
  const left = inset;
  const right = Math.max(width - inset, left);
  const top = inset;
  const bottom = Math.max(height - inset, top);
  const maxCorner = Math.max(Math.min((right - left) / 2, (bottom - top) / 2), 0);
  const corner = Math.min(Math.max(CARD_RADIUS - inset, 0), maxCorner);

  const points: Array<{ x: number; y: number }> = [];
  const pushPoint = (x: number, y: number) => {
    const previous = points[points.length - 1];
    if (!previous) {
      points.push({ x, y });
      return;
    }
    const dx = x - previous.x;
    const dy = y - previous.y;
    if (Math.hypot(dx, dy) > 0.0001) {
      points.push({ x, y });
    }
  };
  const pushLine = (x1: number, y1: number, x2: number, y2: number, steps: number) => {
    for (let index = 0; index < steps; index += 1) {
      const t = index / steps;
      pushPoint(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  };
  const pushArc = (cx: number, cy: number, radius: number, startAngle: number, endAngle: number, steps: number) => {
    if (radius <= 0) {
      pushPoint(cx, cy);
      return;
    }
    for (let index = 0; index < steps; index += 1) {
      const t = index / steps;
      const angle = startAngle + (endAngle - startAngle) * t;
      pushPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
  };

  const halfPi = Math.PI / 2;
  pushLine(left + corner, top, right - corner, top, EDGE_STEPS);
  pushArc(right - corner, top + corner, corner, -halfPi, 0, CORNER_STEPS);
  pushLine(right, top + corner, right, bottom - corner, EDGE_STEPS);
  pushArc(right - corner, bottom - corner, corner, 0, halfPi, CORNER_STEPS);
  pushLine(right - corner, bottom, left + corner, bottom, EDGE_STEPS);
  pushArc(left + corner, bottom - corner, corner, halfPi, Math.PI, CORNER_STEPS);
  pushLine(left, bottom - corner, left, top + corner, EDGE_STEPS);
  pushArc(left + corner, top + corner, corner, Math.PI, Math.PI * 1.5, CORNER_STEPS);

  if (points.length < 2) {
    return null;
  }

  pushPoint(points[0].x, points[0].y);
  if (points.length < 2) {
    return null;
  }

  const cumulativeDistances: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const curr = points[index];
    const segmentLength = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    cumulativeDistances.push(cumulativeDistances[index - 1] + segmentLength);
  }

  const totalLength = cumulativeDistances[cumulativeDistances.length - 1];
  if (totalLength <= 0) {
    return null;
  }

  const inputRange = cumulativeDistances.map((distance) => distance / totalLength);
  const xValues = points.map((point) => point.x - DOT_SIZE / 2);
  const yValues = points.map((point) => point.y - DOT_SIZE / 2);

  return { inputRange, xValues, yValues, totalLength };
}

function PlanCard({ plan, onContinue }: { plan: Plan; onContinue: () => void }) {
  const title = plan === 'annual' ? 'Elite Plan ⚡️' : 'Monthly Plan';
  const dollars = plan === 'annual' ? '4' : '14';
  const suffix = '/mo';
  const progress = useRef(new Animated.Value(0)).current;
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const isAnnual = plan === 'annual';

  useEffect(() => {
    if (!isAnnual) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    progress.setValue(0);
    const borderLoop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 3250,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    borderLoop.start();
    return () => borderLoop.stop();
  }, [isAnnual, progress]);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardSize((current) => {
      if (current.width === width && current.height === height) {
        return current;
      }
      return { width, height };
    });
  };

  const dotPath = useMemo(() => buildBorderDotPath(cardSize.width, cardSize.height), [cardSize.height, cardSize.width]);
  const trailStep = dotPath ? (DOT_SIZE * 0.5) / dotPath.totalLength : 0;
  const dots = useMemo(() => Array.from({ length: TOTAL_DOTS }, (_, index) => index), []);

  const cardContent = (
    <>
      <View style={styles.planHeader}>
        <Text style={styles.planTitle}>{title}</Text>
        {isAnnual ? (
          <View style={styles.badgesRow}>
            <Text style={styles.mostPopularText}>Most Popular</Text>
          </View>
        ) : null}
      </View>
      <View pointerEvents="none">
        <PrimaryButton label="Continue" onPress={NOOP} />
      </View>
      {isAnnual ? (
        <View style={styles.discountPillInline}>
          <Text style={styles.discountPillText}>🔥 66% off</Text>
        </View>
      ) : null}
      <View style={styles.priceRow}>
        <Text style={styles.priceDollars}>{dollars}</Text>
        <Text style={styles.priceCents}>.99</Text>
        <Text style={styles.priceSuffix}>{suffix}</Text>
        {isAnnual ? <Text style={styles.priceMeta}>(59.99 billed annually)</Text> : null}
      </View>
    </>
  );

  if (!isAnnual) {
    return (
      <Pressable onPress={onContinue} style={({ pressed }) => [styles.cardContainer, pressed && styles.cardPressed]}>
        <View style={styles.planCard}>{cardContent}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onContinue}
      onLayout={handleCardLayout}
      style={({ pressed }) => [styles.annualCardFrame, pressed && styles.cardPressed]}
    >
      <View style={[styles.planCard, styles.annualPlanCard]}>{cardContent}</View>
      {dotPath ? (
        <View pointerEvents="none" style={styles.streakOverlay}>
          {dots.map((segmentIndex) => {
            const segmentOffset = segmentIndex * trailStep;
            const segmentProgress =
              segmentIndex === 0
                ? progress
                : Animated.modulo(Animated.add(progress, 1 - segmentOffset), 1);

            const segmentX = segmentProgress.interpolate({
              inputRange: dotPath.inputRange,
              outputRange: dotPath.xValues,
              extrapolate: 'clamp',
            });
            const segmentY = segmentProgress.interpolate({
              inputRange: dotPath.inputRange,
              outputRange: dotPath.yValues,
              extrapolate: 'clamp',
            });
            const segmentColor = getTailColor(segmentIndex, TOTAL_DOTS);

            return (
              <Animated.View
                key={`tail-square-${segmentIndex}`}
                style={[
                  styles.borderDot,
                  {
                    backgroundColor: segmentColor,
                    shadowColor: segmentColor,
                    transform: [{ translateX: segmentX }, { translateY: segmentY }],
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function PaywallScreen() {
  const { session, onboardingComplete, paywallUnlocked, unlockPaywallForInstall } = useAppState();
  const [selectedPlan, setSelectedPlan] = useState<Plan>('annual');

  const nextRoute = getNextRoute({ session, onboardingComplete, paywallUnlocked });
  if (nextRoute !== '/paywall') {
    return <Redirect href={nextRoute} />;
  }

  const unlock = async () => {
    try {
      await unlockPaywallForInstall();
      Alert.alert('Testing mode', `Unlocked with ${selectedPlan} test plan.`);
      router.replace('/');
    } catch (error) {
      Alert.alert('Unlock failed', error instanceof Error ? error.message : 'Unexpected error');
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Choose a Plan</Text>

      <View style={styles.toggleWrap}>
        <Pressable
          onPress={() => setSelectedPlan('monthly')}
          style={[styles.toggleButton, selectedPlan === 'monthly' && styles.toggleButtonSelected]}
        >
          <Text style={[styles.toggleLabel, selectedPlan === 'monthly' && styles.toggleLabelSelected]}>Monthly</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedPlan('annual')}
          style={[styles.toggleButton, selectedPlan === 'annual' && styles.toggleButtonSelected]}
        >
          <Text style={[styles.toggleLabel, selectedPlan === 'annual' && styles.toggleLabelSelected]}>Annual</Text>
        </Pressable>
      </View>

      <PlanCard plan={selectedPlan} onContinue={unlock} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 8,
  },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#eef1f4',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonSelected: {
    backgroundColor: '#1f883d',
  },
  toggleLabel: {
    color: '#4f5d6b',
    fontWeight: '700',
  },
  toggleLabelSelected: {
    color: '#fff',
  },
  cardContainer: {
    marginBottom: 14,
  },
  annualCardFrame: {
    position: 'relative',
    marginBottom: 14,
  },
  cardPressed: {
    opacity: 0.95,
  },
  planCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8dee4',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  annualPlanCard: {
    borderWidth: ANNUAL_BORDER_WIDTH,
    borderColor: '#58d877',
    backgroundColor: '#fbfffb',
  },
  planHeader: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 6,
  },
  mostPopularText: {
    backgroundColor: '#fff3a3',
    color: '#5a4a00',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  priceDollars: {
    color: '#1f2328',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 21,
  },
  priceCents: {
    color: '#1f2328',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 11,
    marginLeft: 1,
  },
  priceSuffix: {
    color: '#4f5d6b',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 11,
    marginLeft: 3,
  },
  priceMeta: {
    color: '#6e7781',
    fontSize: 12,
    marginLeft: 8,
    lineHeight: 20,
  },
  discountPillInline: {
    alignSelf: 'flex-start',
    backgroundColor: '#d9f3df',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#b4e2be',
    marginBottom: 6,
  },
  discountPillText: {
    color: '#146c2e',
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  streakOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: 'visible',
    zIndex: 2,
  },
  borderDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: 0,
    backgroundColor: '#ffffff',
    borderWidth: 0,
    elevation: 10,
    shadowColor: '#ffffff',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});

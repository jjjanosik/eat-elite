import { useEffect, useRef, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { getNextRoute, useAppState } from '@/context/AppStateContext';

const TAB_BAR_BASE_HEIGHT = 44;

function SettingsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#18B84A"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.063 16.658.26-1.477m2.605-14.772.26-1.477m0 17.726-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205 12 12m6.894 5.785-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
      />
    </Svg>
  );
}

function ScanBarcodeIcon({ color, size }: { color: string; size: number }) {
  const iconSize = Math.max(20, size);

  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3H6a3 3 0 0 0-3 3v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 3h3a3 3 0 0 1 3 3v3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 15v3a3 3 0 0 0 3 3h3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 15v3a3 3 0 0 1-3 3h-3" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={7.2} y={7.2} width={1.3} height={9.6} rx={0.2} fill={color} />
      <Rect x={9.5} y={7.2} width={2.2} height={9.6} rx={0.2} fill={color} />
      <Rect x={12.7} y={7.2} width={1.3} height={9.6} rx={0.2} fill={color} />
      <Rect x={15} y={7.2} width={2.2} height={9.6} rx={0.2} fill={color} />
    </Svg>
  );
}

function GoalsTrophyIcon({ color, size }: { color: string; size: number }) {
  const iconSize = Math.max(20, size);

  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HistoryListIcon({ color, size }: { color: string; size: number }) {
  const iconSize = Math.max(20, size);

  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BackChevronIcon() {
  return (
    <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backChevronHitArea}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path stroke="#1f2328" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" d="m15.75 19.5-7.5-7.5 7.5-7.5" />
      </Svg>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { session, onboardingComplete, paywallUnlocked, loading } = useAppState();
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const redirectingRef = useRef(false);
  const [tabsMountedOnce, setTabsMountedOnce] = useState(false);

  const nextRoute = getNextRoute({ session, onboardingComplete, paywallUnlocked });
  const shouldRedirectAwayFromTabs = !loading && nextRoute !== '/(tabs)/scan';

  useEffect(() => {
    if (!shouldRedirectAwayFromTabs) {
      redirectingRef.current = false;
      return;
    }

    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace(nextRoute);
  }, [nextRoute, shouldRedirectAwayFromTabs]);

  useEffect(() => {
    if (tabsMountedOnce) return;
    if (loading) return;
    if (shouldRedirectAwayFromTabs) return;
    setTabsMountedOnce(true);
  }, [loading, shouldRedirectAwayFromTabs, tabsMountedOnce]);

  if (!tabsMountedOnce) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator color="#1f883d" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        sceneStyle: { paddingBottom: 0, backgroundColor: '#ffffff' },
        tabBarActiveTintColor: '#18B84A',
        tabBarBackground: () => <BlurView tint="light" intensity={75} style={[StyleSheet.absoluteFill, styles.tabBarBlur]} />,
        tabBarStyle: {
          position: 'absolute',
          height: tabBarHeight,
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(31,35,40,0.08)',
          elevation: 0,
        },
        headerRight: () => (
          <Pressable
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <SettingsIcon />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <ScanBarcodeIcon color={color} size={size} />,
          tabBarStyle: {
            position: 'absolute',
            height: tabBarHeight,
            backgroundColor: 'transparent',
            borderTopColor: 'transparent',
            elevation: 0,
          },
          tabBarBackground: () => <BlurView tint="dark" intensity={75} style={[StyleSheet.absoluteFill, styles.tabBarBlurNoBorder]} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={({ route }) => {
          const focusedRouteName = getFocusedRouteNameFromRoute(route);
          const isHistoryDetail = focusedRouteName === '[id]';
          return {
            title: 'History',
            headerTitle: isHistoryDetail ? '' : 'History',
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#ffffff' },
            headerLeft: isHistoryDetail ? () => <BackChevronIcon /> : undefined,
            headerBackVisible: !isHistoryDetail,
            headerRight: isHistoryDetail ? () => null : undefined,
            tabBarIcon: ({ color, size }) => <HistoryListIcon color={color} size={size} />,
          };
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, size }) => <GoalsTrophyIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    padding: 4,
    marginRight: 8,
  },
  backChevronHitArea: {
    paddingVertical: 6,
    paddingRight: 28,
    paddingLeft: 10,
  },
  tabBarBlur: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,35,40,0.08)',
  },
  tabBarBlurNoBorder: {
    backgroundColor: 'rgba(31,35,40,0.55)',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
});

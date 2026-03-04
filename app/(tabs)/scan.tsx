import { useEffect, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScanResultSheet } from '@/components/ScanResultSheet';
import { regenerateHistoryExplanation, scanProduct } from '@/lib/api';
import type { ScanResult } from '@/lib/types';

const DEFAULT_SCAN_ZOOM = 0.15;
const SCAN_SHEET_BOTTOM_PADDING = 72;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const scanHintTop = insets.top + 14;
  const tabBarHeight = useBottomTabBarHeight();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [retryingExplanation, setRetryingExplanation] = useState(false);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (permissionRequested) return;
    if (!permission?.granted && permission?.canAskAgain !== false) {
      setPermissionRequested(true);
      requestPermission();
    }
  }, [permission, permissionRequested, requestPermission]);

  const runScan = async (barcode: string) => {
    const normalized = barcode.trim();
    if (!normalized) return;

    setLoading(true);
    try {
      const data = await scanProduct(normalized);
      setResult(data);
      if (data.ai_pending) {
        void refreshExplanation(data.history_id, false);
      }
    } catch (error) {
      Alert.alert('Scan failed', error instanceof Error ? error.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const onBarcodeScanned = (event: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    runScan(event.data).finally(() => {
      scanLockRef.current = false;
    });
  };

  const refreshExplanation = async (historyId: string, showAlertOnError: boolean) => {
    setRetryingExplanation(true);
    try {
      const refreshed = await regenerateHistoryExplanation(historyId);
      setResult((current) =>
        current?.history_id === historyId
          ? {
              ...current,
              ai_response: refreshed.ai_response,
              ai_error: null,
              ai_cached: false,
              ai_pending: false,
            }
          : current,
      );
    } catch (error) {
      setResult((current) =>
        current?.history_id === historyId
          ? {
              ...current,
              ai_pending: false,
              ai_error: 'ai_generation_failed',
            }
          : current,
      );
      if (showAlertOnError) {
        Alert.alert('Retry failed', error instanceof Error ? error.message : 'Unexpected error');
      }
    } finally {
      setRetryingExplanation(false);
    }
  };

  const retryExplanation = async () => {
    if (!result || retryingExplanation) return;

    const historyId = result.history_id;
    setResult((current) =>
      current?.history_id === historyId
        ? {
            ...current,
            ai_pending: true,
            ai_error: null,
          }
        : current,
    );
    await refreshExplanation(historyId, true);
  };

  const toggleTorch = async () => {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        Alert.alert('Camera permission needed', 'Please allow camera access to use the flashlight.');
        return;
      }
    }

    setTorchEnabled((current) => !current);
  };

  return (
    <View style={styles.screenBody}>
      {!permission?.granted ? (
        <View style={styles.permissionState}>
          <Text style={styles.permissionText}>Camera permission is needed for barcode scanning.</Text>
          <PrimaryButton label="Grant Camera Permission" onPress={() => requestPermission()} />
        </View>
      ) : (
        <>
          <CameraView
            style={styles.camera}
            facing="back"
            zoom={DEFAULT_SCAN_ZOOM}
            autofocus="on"
            enableTorch={torchEnabled}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={scanLockRef.current || Boolean(result) ? undefined : onBarcodeScanned}
          />
          {loading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color="#1f883d" />
            </View>
          ) : null}
        </>
      )}

      <View style={[styles.scanHintWrap, { top: scanHintTop }]} pointerEvents="none">
        <View style={styles.scanHintBubble}>
          <Text style={styles.scanHintText}>Scan the barcode of a food item</Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel={torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'}
        onPress={() => void toggleTorch()}
        style={[
          styles.cameraToggleButton,
          styles.floatingFlashButton,
          { bottom: tabBarHeight + 12 },
          torchEnabled ? styles.cameraToggleButtonActive : undefined,
        ]}
      >
        <TorchIcon color={torchEnabled ? '#1f2328' : '#f6f8fa'} />
      </Pressable>

      {result ? (
        <ScanResultSheet
          result={result}
          onDismiss={() => setResult(null)}
          onRetryExplanation={() => {
            void retryExplanation();
          }}
          retryingExplanation={retryingExplanation}
          expandedTopOffset={scanHintTop}
          bottomContentPadding={tabBarHeight + SCAN_SHEET_BOTTOM_PADDING}
        />
      ) : null}
    </View>
  );
}

function TorchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  permissionState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f6f8fa',
  },
  permissionText: {
    marginBottom: 12,
    color: '#4f5d6b',
    textAlign: 'center',
  },
  scanHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanHintBubble: {
    backgroundColor: 'rgba(31,35,40,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    maxWidth: '78%',
  },
  scanHintText: {
    color: '#f6f8fa',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraToggleButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(31,35,40,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraToggleButtonActive: {
    backgroundColor: '#ffffff',
  },
  floatingFlashButton: {
    position: 'absolute',
    right: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

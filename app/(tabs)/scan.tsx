import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScanResultSheet } from '@/components/ScanResultSheet';
import { scanProduct } from '@/lib/api';
import type { ScanResult } from '@/lib/types';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
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

  return (
    <Screen scroll={false} topInset={false}>
      <View style={styles.screenBody}>
        <Text style={styles.title}>Scan Food</Text>
        <Text style={styles.subtitle}>Scan barcode to fetch Open Food Facts data, score it, and save to history.</Text>

        <View style={styles.cameraCard}>
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
        </View>

        {result ? <ScanResultSheet result={result} onDismiss={() => setResult(null)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2328',
    marginBottom: 6,
  },
  subtitle: {
    color: '#4f5d6b',
    lineHeight: 22,
    marginBottom: 14,
  },
  cameraCard: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: -16,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  permissionState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  permissionText: {
    marginBottom: 12,
    color: '#4f5d6b',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});

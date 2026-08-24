import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
// npm install @react-native-ml-kit/text-recognition   (+ pod install on iOS)

// Normalise for comparison: uppercase, strip everything but letters/digits
const norm = (s) => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');

// Does the recognised OCR text contain the expected package number / any
// product name well enough to call it a match?
const textMatchesPackage = (recognisedText, pkg) => {
  const flat = norm(recognisedText);
  if (!flat) return false;

  const expectedCode = norm(pkg.package_number);
  if (expectedCode && flat.includes(expectedCode)) return true;

  const items = pkg.package_items || [];
  return items.some((item) => {
    const p = norm(item.product_name);
    return p && p.length >= 4 && flat.includes(p);
  });
};

/**
 * props:
 *  visible       - bool
 *  pkg           - the package object being verified { package_number, package_items, ... }
 *  mode          - 'pickup' | 'delivery' (only affects header copy)
 *  onVerified(matched: boolean, rawText: string)  - called once a scan attempt resolves
 *  onClose()
 */
const PackageScanVerifyModal = ({ visible, pkg, mode = 'pickup', onVerified, onClose }) => {
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const lockRef = useRef(false); // same hard-lock pattern as the card scanner — one result per session
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState(null); // { matched: bool, text: string } | null
  const [attempts, setAttempts] = useState(0);

  const resolveResult = useCallback((matched, rawText) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setResult({ matched, text: rawText });
    setAttempts((a) => a + 1);
    onVerified?.(matched, rawText);
  }, [onVerified]);

  // Auto path — a QR/barcode on the package label matches package_number directly
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix'],
    onCodeScanned: (codes) => {
      if (!visible || lockRef.current || codes.length === 0 || !pkg) return;
      const value = codes[0].value?.trim();
      if (!value) return;
      const matched = norm(value) === norm(pkg.package_number) || textMatchesPackage(value, pkg);
      resolveResult(matched, value);
    },
  });

  // Manual path — take a photo of the shipping label, run OCR, compare text
  const captureAndReadLabel = async () => {
    if (!cameraRef.current || capturing || lockRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const ocr = await TextRecognition.recognize(`file://${photo.path}`);
      const text = ocr?.text || '';
      const matched = textMatchesPackage(text, pkg);
      resolveResult(matched, text);
    } catch (e) {
      console.error('[PackageScanVerifyModal] OCR capture failed:', e.message);
    } finally {
      setCapturing(false);
    }
  };

  const retry = () => {
    lockRef.current = false;
    setResult(null);
  };

  const confirmAndClose = () => {
    onClose?.();
  };

  if (!pkg) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>
                {mode === 'pickup' ? 'Verify Pickup' : 'Verify Delivery'}
              </Text>
              <Text style={styles.headerSub}>
                Expected: {pkg.package_number || 'Package'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            {device ? (
              <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={visible && !result}
                codeScanner={codeScanner}
                photo={true}
              />
            ) : (
              <View style={styles.center}>
                <Text style={{ color: '#fff' }}>Camera not available</Text>
              </View>
            )}

            {!result && (
              <>
                <View style={styles.scanFrameContainer}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                </View>
                <Text style={styles.hint}>
                  Point at the QR / barcode, or capture the shipping label to read it
                </Text>

                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={captureAndReadLabel}
                  disabled={capturing}
                >
                  {capturing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="text-recognition" size={18} color="#fff" />
                      <Text style={styles.captureBtnText}>Capture Label (OCR)</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {result && (
              <View style={styles.resultOverlay}>
                <View
                  style={[
                    styles.resultCard,
                    { borderColor: result.matched ? '#22c55e' : '#ef4444' },
                  ]}
                >
                  <Ionicons
                    name={result.matched ? 'checkmark-circle' : 'close-circle'}
                    size={48}
                    color={result.matched ? '#22c55e' : '#ef4444'}
                  />
                  <Text style={[styles.resultTitle, { color: result.matched ? '#22c55e' : '#ef4444' }]}>
                    {result.matched ? 'Correct Package' : 'Wrong Package'}
                  </Text>
                  <Text style={styles.resultSub} numberOfLines={2}>
                    {result.matched
                      ? `Matches ${pkg.package_number}`
                      : `Expected ${pkg.package_number}. Scanned text didn't match.`}
                  </Text>

                  <View style={styles.resultBtnRow}>
                    <TouchableOpacity style={styles.retryBtn} onPress={retry}>
                      <Ionicons name="refresh" size={16} color="#334155" />
                      <Text style={styles.retryBtnText}>Rescan</Text>
                    </TouchableOpacity>

                    {result.matched ? (
                      <TouchableOpacity style={styles.doneBtn} onPress={confirmAndClose}>
                        <Text style={styles.doneBtnText}>Continue</Text>
                      </TouchableOpacity>
                    ) : (
                      attempts >= 2 && (
                        <TouchableOpacity style={styles.overrideBtn} onPress={confirmAndClose}>
                          <Text style={styles.overrideBtnText}>Override & Continue</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default PackageScanVerifyModal;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 16,
  },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrameContainer: {
    position: 'absolute', top: '35%', left: '50%',
    transform: [{ translateX: -90 }],
  },
  scanFrame: { width: 180, height: 180 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  captureBtn: {
    position: 'absolute', bottom: 36, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ED1C25', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30,
  },
  captureBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  resultCard: {
    backgroundColor: '#111827', borderRadius: 16, borderWidth: 2,
    padding: 24, alignItems: 'center', width: '100%',
  },
  resultTitle: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  resultSub: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 6 },
  resultBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  retryBtnText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  doneBtn: { backgroundColor: '#22c55e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  overrideBtn: { backgroundColor: '#f97316', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  overrideBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
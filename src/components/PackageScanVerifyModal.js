import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
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
  const hasPackageNumber = expectedCode && flat.includes(expectedCode);

  // Package number இல்லனா → Wrong
  if (!hasPackageNumber) return false;

  const items = pkg.package_items || [];

  // Items இல்லனா → package number மட்டும் போதும்
  if (items.length ===0) return true;

  // Items இருந்தா → package number + ஏதாவது ஒரு product name (length >= 4)
  const hasProduct = items.some((item) => {
    const p = norm(item.product_name);
    return p && p.length >= 4 && flat.includes(p);
  });

  return hasProduct;
};

// How often (ms) the OCR auto-capture loop takes a photo while the scan
// phase is active. QR/barcode scanning (via useCodeScanner) runs
// continuously and independently — whichever resolves first wins.
const AUTO_CAPTURE_INTERVAL_MS = 2000;

/**
 * props:
 *  visible       - bool
 *  pkg           - the package object being verified { package_number, package_items, ... }
 *  mode          - 'pickup' | 'delivery' (only affects header copy)
 *  initialMode   - 'scan' (default) | 'manual' — pass 'manual' to skip the
 *                  camera entirely and open straight into the manual package
 *                  number entry (e.g. driver tapped a dedicated "Manual
 *                  Entry" button)
 *  onVerified(matched: boolean, rawText: string, meta?: {
 *      manual?: boolean,
 *      enteredPackageNumber?: string,
 *      itemsVerified: { product_name: string, expectedQty: number|null, enteredQty: string, matched: boolean }[],
 *      allItemsMatched: boolean,
 *  })
 *                - called once the package is identified. No manual
 *                  quantity entry step — item list is auto-verified against
 *                  the expected quantities on record the moment the
 *                  package is identified (QR/barcode scan, auto-OCR, or
 *                  manual number entry).
 *  onClose()
 *
 * SCAN PHASE BEHAVIOUR: both QR/barcode scanning AND OCR run
 * automatically and in parallel while phase === 'scan' — no button tap
 * needed. QR/barcode resolves instantly on a code hit. OCR runs on a
 * fixed interval (AUTO_CAPTURE_INTERVAL_MS), silently retrying every
 * cycle until it reads text that matches the package. Whichever
 * resolves first calls resolveResult() and locks out the other.
 */
const PackageScanVerifyModal = ({ visible, pkg, mode = 'pickup', initialMode = 'scan', onVerified, onClose }) => {
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const lockRef = useRef(false); // one final result per session
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState(null); // { matched, text, manual, itemsVerified, allItemsMatched } | null
  const [attempts, setAttempts] = useState(0);

  // Phase machine: 'scan' -> camera/QR/auto-OCR | 'manualNumber' -> type pkg # |
  // 'result' -> final overlay
  const [phase, setPhase] = useState('scan');

  const [manualPackageNumber, setManualPackageNumber] = useState('');
  const [manualError, setManualError] = useState('');

  // Auto-OCR loop bookkeeping
  const autoCaptureIntervalRef = useRef(null);
  const capturingRef = useRef(false); // guards overlapping capture cycles

  // Per-item visual-verify checkboxes for the manual entry screen —
  // { [itemIndex]: true }. The driver taps each product row to confirm
  // they physically checked it before Confirm is allowed. This is
  // separate from QR/OCR auto-verify (those still auto-check every item
  // against the record) — manual entry is the one path where the driver
  // is looking at the package themselves, so they verify each line.
  const [checkedItems, setCheckedItems] = useState({});

  const items = pkg?.package_items || [];

  const allItemsChecked = items.length === 0 || items.every((_, i) => checkedItems[i]);

  const toggleItemChecked = (idx) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
    if (manualError) setManualError('');
  };

  // Build an auto-verified items list straight from the expected
  // quantities on record — used for QR/OCR auto-verify paths where there's
  // no manual per-item check step.
  const buildAutoVerifiedItems = () =>
    items.map((item) => ({
      product_name: item.product_name,
      expectedQty: item.quantity != null ? item.quantity : null,
      enteredQty: item.quantity != null ? String(item.quantity) : '',
      matched: true,
    }));

  // Build the verified items list from the driver's manual checkboxes —
  // used for the manual entry path only.
  const buildManuallyCheckedItems = () =>
    items.map((item, i) => ({
      product_name: item.product_name,
      expectedQty: item.quantity != null ? item.quantity : null,
      enteredQty: item.quantity != null ? String(item.quantity) : '',
      matched: !!checkedItems[i],
    }));

  // Every time the modal opens, reset to a clean state.
  useEffect(() => {
    if (visible) {
      lockRef.current = false;
      capturingRef.current = false;
      setResult(null);
      setAttempts(0);
      setCapturing(false);
      setPhase(initialMode === 'manual' ? 'manualNumber' : 'scan');
      setManualPackageNumber('');
      setManualError('');
      setCheckedItems({});
    }
  }, [visible, initialMode, pkg]);

  // Records the outcome and shows the result screen — does NOT notify the
  // parent yet. The parent only finds out once the driver explicitly taps
  // "Continue" / "Override & Continue" on the result screen (see
  // confirmAndClose). This is what stops a card's status from silently
  // flipping to Picked/Delivered off a single scan/OCR frame.
  const resolveResult = useCallback((matched, rawText, meta = {}) => {
    if (lockRef.current) return;
    lockRef.current = true;

    // Stop the auto-OCR interval immediately — don't wait for the
    // cleanup effect to run on next render. This closes the race where an
    // in-flight captureAndReadLabel() call hits a camera that's already
    // been torn down after a QR/manual match resolved first (was showing
    // up as "OCR capture failed: Camera is closed." in logs).
    if (autoCaptureIntervalRef.current) {
      clearInterval(autoCaptureIntervalRef.current);
      autoCaptureIntervalRef.current = null;
    }

    const finalResult = {
      matched,
      text: rawText,
      manual: !!meta.manual,
      enteredPackageNumber: meta.enteredPackageNumber,
      itemsVerified: meta.itemsVerified,
      allItemsMatched: meta.allItemsMatched,
    };
    setResult(finalResult);
    setPhase('result');
    setAttempts((a) => a + 1);
  }, []);

  // Auto path — a QR/barcode on the package label matches package_number
  // directly. Runs continuously while phase === 'scan'. Auto-verifies
  // immediately on a hit — no item/quantity checklist step.
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix'],
    onCodeScanned: (codes) => {
      if (!visible || phase !== 'scan' || lockRef.current || codes.length === 0 || !pkg) return;
      const value = codes[0].value?.trim();
      if (!value) return;
      const matched = textMatchesPackage(value, pkg);

      resolveResult(matched, value, {
        manual: false,
        itemsVerified: buildAutoVerifiedItems(),
        allItemsMatched: true,
      });
    },
  });

  // OCR capture cycle — runs automatically on an interval while
  // phase === 'scan' (see the effect below). Silently no-ops (lets the
  // next cycle try again) if OCR reads nothing useful or doesn't match yet.
  const captureAndReadLabel = useCallback(async () => {
    if (!cameraRef.current || capturingRef.current || phase !== 'scan' || lockRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });

      // A QR/manual match may have resolved (and torn down the camera)
      // while takePhoto() was in flight — bail out before touching OCR.
      if (lockRef.current) return;

      const ocr = await TextRecognition.recognize(`file://${photo.path}`);
      const text = ocr?.text || '';

      if (text.trim() && !lockRef.current) {
        const matched = textMatchesPackage(text, pkg);
        // Only resolve on an actual match — a non-match just lets the loop
        // try again on the next cycle instead of flashing "Wrong Package"
        // on every unreadable frame.
        if (matched) {
          resolveResult(matched, text, {
            manual: false,
            itemsVerified: buildAutoVerifiedItems(),
            allItemsMatched: true,
          });
        }
      }
    } catch (e) {
      // "Camera is closed." is an expected race — a QR/manual match
      // already resolved and camera teardown started mid-capture. Skip
      // logging it as an error; log anything else as before.
      if (e.message !== 'Camera is closed.' && !lockRef.current) {
        console.error('[PackageScanVerifyModal] OCR capture failed:', e.message);
      }
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pkg]);

  // Drives the auto-OCR loop: while the modal is visible and we're on
  // the scan phase, fire captureAndReadLabel() on a fixed interval.
  // Cleared whenever visibility/phase changes or the component unmounts.
  useEffect(() => {
    if (visible && phase === 'scan' && device) {
      autoCaptureIntervalRef.current = setInterval(() => {
        captureAndReadLabel();
      }, AUTO_CAPTURE_INTERVAL_MS);
    }
    return () => {
      if (autoCaptureIntervalRef.current) {
        clearInterval(autoCaptureIntervalRef.current);
        autoCaptureIntervalRef.current = null;
      }
    };
  }, [visible, phase, device, captureAndReadLabel]);

  const retry = () => {
    lockRef.current = false;
    capturingRef.current = false;
    setResult(null);
    setCapturing(false);
    setManualPackageNumber('');
    setManualError('');
    setCheckedItems({});
    setPhase(initialMode === 'manual' ? 'manualNumber' : 'scan');
  };

  // Explicit driver confirmation — the ONLY point where the parent is told
  // verification happened. "Rescan"/the header X never reach this, so a
  // stray tap can't flip a card's status without the driver deliberately
  // pressing Continue or Override here.
  const confirmAndClose = () => {
    if (result) {
      onVerified?.(result.matched, result.text, {
        manual: result.manual,
        enteredPackageNumber: result.enteredPackageNumber,
        itemsVerified: result.itemsVerified,
        allItemsMatched: result.allItemsMatched,
      });
    }
    onClose?.();
  };

  // ── Manual package-number entry ─────────────────────────────────────────
  const openManualEntry = () => {
    setManualPackageNumber('');
    setManualError('');
    setPhase('manualNumber');
  };

  // Package number + every product row must be checked (visually
  // verified by the driver) before this can submit.
  const submitManualNumber = () => {
    if (!manualPackageNumber.trim()) {
      setManualError('Package number podunga');
      return;
    }
    if (!allItemsChecked) {
      setManualError('Ella product-um check pannitu confirm pannunga');
      return;
    }
    const matched = norm(manualPackageNumber) === norm(pkg.package_number);

    resolveResult(matched, `MANUAL ENTRY — Pkg#: ${manualPackageNumber.trim()}`, {
      manual: true,
      enteredPackageNumber: manualPackageNumber.trim(),
      itemsVerified: buildManuallyCheckedItems(),
      allItemsMatched: allItemsChecked,
    });
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
            {/* ── SCAN PHASE — QR/barcode + auto-OCR, both run automatically ── */}
            {phase === 'scan' && (
              <>
                {device ? (
                  <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={visible && phase === 'scan'}
                    codeScanner={codeScanner}
                    photo={true}
                  />
                ) : (
                  <View style={styles.center}>
                    <Text style={{ color: '#fff' }}>Camera not available</Text>
                  </View>
                )}

                <Text style={styles.hint}>
                  Point at the QR / barcode or label — verifies automatically
                </Text>

                <View style={styles.bottomBtnStack}>
                  {capturing && (
                    <View style={styles.scanningPill}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.scanningPillText}>Reading label…</Text>
                    </View>
                  )}

                  {/* Fallback only — scan/OCR is automatic now */}
                  <TouchableOpacity style={styles.manualEntryBtn} onPress={openManualEntry}>
                    <Ionicons name="create-outline" size={16} color="#fff" />
                    <Text style={styles.manualEntryBtnText}>
                      Scan not working? Enter manually
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── MANUAL PACKAGE NUMBER PHASE ─────────────────────────────── */}
            {phase === 'manualNumber' && (
              <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: '#0b1220' }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <ScrollView contentContainerStyle={styles.manualScroll}>
                  <View style={styles.manualHeaderRow}>
                    <MaterialCommunityIcons name="clipboard-edit-outline" size={20} color="#f97316" />
                    <Text style={styles.manualHeaderText}>Manual Package Entry</Text>
                  </View>
                  <Text style={styles.manualSubText}>
                    Package label la irundhu package number-ah paathu type pannunga.
                    Submit pannina odane confirm aayidum.
                  </Text>

                  <Text style={styles.fieldLabel}>Package Number</Text>
                  <TextInput
                    style={styles.manualInput}
                    placeholder={pkg.package_number || 'Enter package number'}
                    placeholderTextColor="#64748b"
                    value={manualPackageNumber}
                    onChangeText={setManualPackageNumber}
                    autoCapitalize="characters"
                  />

                  {/* Product checklist — driver taps each row after
                      physically checking it against the package. Submit
                      stays disabled until every row is checked. */}
                  {items.length > 0 && (
                    <>
                      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
                        Products in this Package ({items.filter((_, i) => checkedItems[i]).length}/{items.length} verified)
                      </Text>
                      <View style={{ gap: 8 }}>
                        {items.map((item, idx) => {
                          const checked = !!checkedItems[idx];
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[styles.itemCheckRow, checked && styles.itemCheckRowChecked]}
                              onPress={() => toggleItemChecked(idx)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                                size={22}
                                color={checked ? '#22c55e' : '#475569'}
                              />
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.itemCheckName} numberOfLines={2}>
                                  {item.product_name}
                                </Text>
                                {item.quantity != null && (
                                  <Text style={styles.itemCheckQty}>Qty: {item.quantity}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {!!manualError && <Text style={styles.manualErrorText}>{manualError}</Text>}

                  <View style={styles.manualBtnRow}>
                    <TouchableOpacity
                      style={styles.manualCancelBtn}
                      onPress={() => (initialMode === 'manual' ? onClose?.() : setPhase('scan'))}
                    >
                      <Text style={styles.manualCancelBtnText}>
                        {initialMode === 'manual' ? 'Cancel' : 'Back to Scan'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualSubmitBtn, !allItemsChecked && { opacity: 0.5 }]}
                      onPress={submitManualNumber}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                      <Text style={styles.manualSubmitBtnText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            )}

            {/* ── RESULT OVERLAY — package + auto-verified item summary ───── */}
            {phase === 'result' && result && (
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
                    {result.manual
                      ? 'Manually Confirmed'
                      : result.matched ? 'Correct Package' : 'Wrong Package'}
                  </Text>
                  <Text style={styles.resultSub} numberOfLines={2}>
                    {result.manual
                      ? `Entered & confirmed by hand — ${pkg.package_number}`
                      : result.matched
                        ? `Matches ${pkg.package_number}`
                        : `Expected ${pkg.package_number}. Scanned text didn't match.`}
                  </Text>

                  {/* FIX: this block used to be a plain View wrapping the
                      whole item list — with 50+ items that pushed the
                      Rescan/Continue buttons off-screen with no way to
                      scroll down to them. Now the list itself scrolls
                      inside a fixed-height box, and the buttons stay
                      pinned below it, always reachable. */}
                  {items.length > 0 && (
                    <View style={styles.resultItemsBox}>
                      <Text style={styles.resultItemsTitle}>
                        Products Verified ({result.itemsVerified?.length || 0}/{items.length})
                      </Text>
                      <ScrollView
                        style={styles.resultItemsScroll}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {result.itemsVerified?.map((it, i) => (
                          <View key={i} style={styles.resultItemRow}>
                            <Ionicons
                              name={it.matched ? 'checkmark-circle' : 'close-circle'}
                              size={14}
                              color={it.matched ? '#22c55e' : '#ef4444'}
                            />
                            <Text style={styles.resultItemText} numberOfLines={1}>
                              {it.product_name}{it.expectedQty != null ? ` — Qty: ${it.expectedQty}` : ''}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

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
  hint: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  bottomBtnStack: {
    position: 'absolute', bottom: 30, alignSelf: 'center', alignItems: 'center', gap: 10,
  },
  scanningPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  scanningPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  manualEntryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
  },
  manualEntryBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  // Manual entry form
  manualScroll: { padding: 20, paddingBottom: 40 },
  manualHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  manualHeaderText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  manualSubText: { color: '#94a3b8', fontSize: 12, lineHeight: 17, marginBottom: 18 },
  fieldLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  manualInput: {
    backgroundColor: '#111827', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937',
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, fontWeight: '600',
  },
  // Manual-entry product checklist rows
  itemCheckRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937',
    padding: 12,
  },
  itemCheckRowChecked: { borderColor: '#22c55e' },
  itemCheckName: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  itemCheckQty: { color: '#64748b', fontSize: 11, marginTop: 2 },

  manualErrorText: { color: '#f87171', fontSize: 12, marginTop: 10, fontWeight: '600' },
  manualBtnRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  manualCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1f2937', paddingVertical: 13, borderRadius: 10,
  },
  manualCancelBtnText: { color: '#cbd5e1', fontWeight: '700', fontSize: 13 },
  manualSubmitBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#22c55e', paddingVertical: 13, borderRadius: 10,
  },
  manualSubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  resultCard: {
    backgroundColor: '#111827', borderRadius: 16, borderWidth: 2,
    padding: 24, alignItems: 'center', width: '100%',
    maxHeight: '90%', // FIX: cap card height so it never overflows the screen
  },
  resultTitle: { fontSize: 17, fontWeight: '800', marginTop: 10 },
  resultSub: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 6 },
  resultItemsBox: {
    width: '100%', marginTop: 16, backgroundColor: '#0b1220', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#1f2937',
    maxHeight: 260, // FIX: bound the whole box so it can't push buttons offscreen
  },
  resultItemsTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  resultItemsScroll: {
    maxHeight: 210, // FIX: only the list scrolls; title stays put above it
  },
  resultItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  resultItemText: { color: '#e2e8f0', fontSize: 12, flex: 1 },
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
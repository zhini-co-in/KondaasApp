import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  Image, ActivityIndicator, Alert, SafeAreaView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import Signature from 'react-native-signature-canvas';
import API from '../api/api1';

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCH FORM — everything for the "Reached" -> Photos -> Signature ->
// Submit delivery-confirmation flow lives in this one file:
//   1. SERVICE LOGIC   — template fetch, multipart submit, offline queue
//   2. SIGNATURE PAD   — small internal component
//   3. DispatchForm    — the modal exported as default
//
// Endpoints used:
//   GET  /template/get/delivery_documentation
//   POST /logistic/upload-package-photos
// ═══════════════════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────────────────
 * 1. SERVICE LOGIC
 * ────────────────────────────────────────────────────────────────────── */

const TEMPLATE_ENDPOINT = (id) => `/template/get/${id}`;
const UPLOAD_ENDPOINT = '/logistic/upload-package-photos';
const DELIVERY_TEMPLATE_ID = 'delivery_documentation';

const DEFAULT_TEMPLATE_FIELDS = [
  { id: 'delivery_photo', label: 'Delivery Photo', type: 'photo', required: true, min: 1, max: 3 },
  { id: 'signature', label: 'Customer Signature', type: 'signature', required: true },
];

export const fetchDeliveryTemplate = async (templateId = DELIVERY_TEMPLATE_ID) => {
  try {
    const res = await API.get(TEMPLATE_ENDPOINT(templateId));
    const data = res?.data?.data || res?.data;
    const fields = Array.isArray(data?.fields) && data.fields.length > 0 ? data.fields : DEFAULT_TEMPLATE_FIELDS;
    return { templateId, fields, raw: data };
  } catch (err) {
    console.warn('[DispatchForm] fetchDeliveryTemplate failed, using default fields:', err?.response?.data || err.message);
    return { templateId, fields: DEFAULT_TEMPLATE_FIELDS, raw: null };
  }
};

// ── Durable local file storage (survives OS cache clears) ─────────────────
const UPLOADS_DIR = `${RNFS.DocumentDirectoryPath}/delivery_uploads`;

const ensureUploadsDir = async () => {
  const exists = await RNFS.exists(UPLOADS_DIR);
  if (!exists) await RNFS.mkdir(UPLOADS_DIR);
};

// Call right after capturing a photo — copies it out of vision-camera's
// volatile cache dir into permanent app storage.
const persistCapturedPhoto = async (sourcePath, fileName) => {
  try {
    await ensureUploadsDir();
    const destPath = `${UPLOADS_DIR}/${fileName}`;
    const cleanSource = sourcePath.startsWith('file://') ? sourcePath.replace('file://', '') : sourcePath;
    await RNFS.copyFile(cleanSource, destPath);
    return destPath;
  } catch (e) {
    console.warn('[DispatchForm] persistCapturedPhoto failed, using original path:', e.message);
    return sourcePath;
  }
};

const deleteLocalFile = async (path) => {
  try {
    const clean = path.startsWith('file://') ? path.replace('file://', '') : path;
    if (await RNFS.exists(clean)) await RNFS.unlink(clean);
  } catch (e) {
    console.warn('[DispatchForm] deleteLocalFile failed:', e.message);
  }
};

// ── FormData builder ────────────────────────────────────────────────────
const buildDeliveryFormData = ({ deal_id, package_number, dispatch_number, state, photos = [], signatureBase64, extraFields = {} }) => {
  const formData = new FormData();
  formData.append('deal_id', deal_id);
  formData.append('package_number', package_number);
  if (dispatch_number) formData.append('dispatch_number', dispatch_number);
  if (state) formData.append('state', state);

  photos.forEach((photo, idx) => {
    const uri = Platform.OS === 'android' && !photo.path.startsWith('file://') ? `file://${photo.path}` : photo.path;
    formData.append('photos', { uri, type: photo.type || 'image/jpeg', name: photo.fileName || `delivery_photo_${idx + 1}.jpg` });
  });

  if (signatureBase64) {
    formData.append('photos', {
      uri: `data:image/png;base64,${signatureBase64}`,
      type: 'image/png',
      name: `signature_${Date.now()}.png`,
    });
  }

  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });

  return formData;
};

const isOnline = async () => {
  const net = await NetInfo.fetch();
  return net.isConnected === true && net.isInternetReachable !== false;
};

const trySubmit = async (payload) => {
  const formData = buildDeliveryFormData(payload);
  const res = await API.post(UPLOAD_ENDPOINT, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res?.data;
};

const anyPhotoMissing = async (photos = []) => {
  for (const p of photos) {
    const clean = p.path.startsWith('file://') ? p.path.replace('file://', '') : p.path;
    if (!(await RNFS.exists(clean))) return true;
  }
  return false;
};

const cleanupPayloadFiles = async (payload) => {
  for (const p of payload.photos || []) await deleteLocalFile(p.path);
};

// ── Offline queue ───────────────────────────────────────────────────────
const DELIVERY_QUEUE_KEY = 'delivery_photo_queue:v1';
let isFlushingDeliveryQueue = false;
let netInfoUnsubscribe = null;
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getDeliveryQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(DELIVERY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[DispatchForm] getDeliveryQueue error:', e.message);
    return [];
  }
};

const saveDeliveryQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(DELIVERY_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[DispatchForm] saveDeliveryQueue error:', e.message);
  }
};

export const getDeliveryQueueLength = async () => (await getDeliveryQueue()).length;

const queueDeliverySubmission = async (payload) => {
  const queue = await getDeliveryQueue();
  queue.push({ id: genId(), payload, createdAt: new Date().toISOString(), attempts: 0 });
  await saveDeliveryQueue(queue);
  console.log('📥 [DispatchForm] queued delivery submission (offline):', payload.deal_id, payload.package_number);
};

// Replays every queued delivery. Call this whenever connectivity returns.
export const flushDeliveryQueue = async () => {
  if (isFlushingDeliveryQueue) return;
  isFlushingDeliveryQueue = true;

  try {
    let queue = await getDeliveryQueue();
    if (queue.length === 0) return;

    console.log(`🔄 [DispatchForm] flushing ${queue.length} queued delivery submission(s)...`);
    const remaining = [];

    for (const item of queue) {
      const missingFile = await anyPhotoMissing(item.payload.photos);
      if (missingFile) {
        console.error('❌ [DispatchForm] photo file missing on disk, dropping item:', item.payload.deal_id, item.payload.package_number);
        continue;
      }

      try {
        await trySubmit(item.payload);
        console.log('✅ [DispatchForm] synced:', item.payload.deal_id, item.payload.package_number);
        await cleanupPayloadFiles(item.payload);
      } catch (e) {
        const attempts = (item.attempts || 0) + 1;
        console.warn('⚠️ [DispatchForm] still failing, will retry later:', e?.response?.data || e.message);
        if (attempts < 8) {
          remaining.push({ ...item, attempts });
        } else {
          console.error('❌ [DispatchForm] giving up after 8 attempts:', item.payload.deal_id, item.payload.package_number);
          await cleanupPayloadFiles(item.payload);
        }
      }
    }

    await saveDeliveryQueue(remaining);
    if (remaining.length === 0) console.log('✅ [DispatchForm] delivery queue fully drained');
  } finally {
    isFlushingDeliveryQueue = false;
  }
};

// Call ONCE — e.g. in App.js on mount.
export const initDeliveryQueueSync = () => {
  if (netInfoUnsubscribe) return;
  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) flushDeliveryQueue();
  });
  NetInfo.fetch().then((state) => {
    if (state.isConnected && state.isInternetReachable !== false) flushDeliveryQueue();
  });
};

export const teardownDeliveryQueueSync = () => {
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
};

// Local-first submit: tries immediately if online; queues + auto-retries if
// offline or the request fails.
export const submitPackageDeliveryPhotos = async ({ deal_id, package_number, dispatch_number, state, photos, signatureBase64, extraFields }) => {
  const payload = { deal_id, package_number, dispatch_number, state, photos, signatureBase64, extraFields };

  const online = await isOnline();
  if (!online) {
    await queueDeliverySubmission(payload);
    return { ok: true, queued: true };
  }

  try {
    await trySubmit(payload);
    await cleanupPayloadFiles(payload);
    return { ok: true, queued: false };
  } catch (e) {
    console.warn('⚠️ [DispatchForm] immediate submit failed, queuing for retry:', e?.response?.data || e.message);
    await queueDeliverySubmission(payload);
    return { ok: true, queued: true };
  }
};

/* ─────────────────────────────────────────────────────────────────────────
 * 2. SIGNATURE PAD (internal component)
 * ────────────────────────────────────────────────────────────────────── */

const SignaturePad = forwardRef(({ onChangeHasDrawing }, ref) => {
  const innerRef = useRef();
  const pendingResolve = useRef(null);

  const handleOK = (dataUri) => {
    const raw = dataUri?.includes(',') ? dataUri.split(',')[1] : dataUri;
    pendingResolve.current?.(raw);
    pendingResolve.current = null;
  };

  const handleEmpty = () => {
    pendingResolve.current?.(null);
    pendingResolve.current = null;
  };

  useImperativeHandle(ref, () => ({
    capture: () =>
      new Promise((resolve) => {
        pendingResolve.current = resolve;
        innerRef.current?.readSignature();
      }),
    clear: () => innerRef.current?.clearSignature(),
  }));

  return (
    <View style={styles.sigWrap}>
      <Signature
        ref={innerRef}
        onOK={handleOK}
        onEmpty={handleEmpty}
        onBegin={() => onChangeHasDrawing?.(true)}
        descriptionText=""
        webStyle={sigWebStyle}
        autoClear={false}
      />
      <TouchableOpacity
        style={styles.sigClearBtn}
        onPress={() => {
          innerRef.current?.clearSignature();
          onChangeHasDrawing?.(false);
        }}
      >
        <Text style={styles.sigClearBtnText}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
});

const sigWebStyle = `
  .m-signature-pad--footer { display: none; margin: 0; }
  .m-signature-pad { box-shadow: none; border: none; }
  body,html { background-color: #F8FAFC; }
`;

/* ─────────────────────────────────────────────────────────────────────────
 * 3. DISPATCH FORM MODAL (default export)
 *
 * Props:
 *   visible: boolean
 *   pkg: { deal_id, package_number, dispatch_number, state }
 *   onClose: () => void
 *   onSubmitted: (result: { queued: boolean }) => void
 *     -> caller advances the package stage here (this component only
 *        handles capture + upload, never touches stage logic).
 * ────────────────────────────────────────────────────────────────────── */

const DispatchForm = ({ visible, pkg, onClose, onSubmitted }) => {
  const [step, setStep] = useState('photos'); // 'photos' | 'signature'
  const [template, setTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const [photos, setPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);
  const signatureRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setStep('photos');
    setPhotos([]);
    setLoadingTemplate(true);

    fetchDeliveryTemplate('delivery_documentation')
      .then(setTemplate)
      .finally(() => setLoadingTemplate(false));

    if (!hasPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pkg?.package_number]);

  const photoField = template?.fields?.find((f) => f.type === 'photo');
  const minPhotos = photoField?.min ?? 1;
  const maxPhotos = photoField?.max ?? 3;

  const openCamera = () => setCameraOpen(true);
  const closeCamera = () => setCameraOpen(false);

  const takePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) return;
      const shot = await cameraRef.current.takePhoto({ flash: 'off' });
      const fileName = `delivery_${pkg?.package_number}_${Date.now()}.jpg`;
      const durablePath = await persistCapturedPhoto(shot.path, fileName);
      setPhotos((prev) => [...prev, { path: durablePath, fileName, type: 'image/jpeg' }]);
      closeCamera();
    } catch (e) {
      console.error('[DispatchForm] takePhoto failed:', e);
      Alert.alert('Camera Error', 'Could not capture photo. Please try again.');
    }
  }, [pkg]);

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const goToSignature = () => {
    if (photos.length < minPhotos) {
      Alert.alert('Photo required', `Please take at least ${minPhotos} photo${minPhotos > 1 ? 's' : ''} before continuing.`);
      return;
    }
    setStep('signature');
  };

  const handleSubmit = async () => {
    const signatureBase64 = await signatureRef.current?.capture();
    if (!signatureBase64) {
      Alert.alert('Signature required', 'Please ask the customer to sign before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitPackageDeliveryPhotos({
        deal_id: pkg?.deal_id,
        package_number: pkg?.package_number,
        dispatch_number: pkg?.dispatch_number,
        state: pkg?.state,
        photos,
        signatureBase64,
      });

      onSubmitted?.(result);

      if (result.queued) {
        Alert.alert(
          'Saved — will upload automatically',
          "No internet right now. This delivery is saved on your device and will be sent automatically once you're back online."
        );
      }
      onClose?.();
    } catch (e) {
      console.error('[DispatchForm] submit failed:', e);
      Alert.alert('Error', 'Could not save the delivery. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Delivery Confirmation</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subTitle}>{pkg?.package_number || pkg?.deal_id}</Text>

          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDotActive]}>
              <Text style={styles.stepDotText}>1</Text>
            </View>
            <View style={[styles.stepLine, step === 'signature' && styles.stepLineDone]} />
            <View style={[styles.stepDot, step === 'signature' && styles.stepDotActive]}>
              <Text style={styles.stepDotText}>2</Text>
            </View>
          </View>
          <View style={styles.stepLabelsRow}>
            <Text style={styles.stepLabelText}>Photos</Text>
            <Text style={styles.stepLabelText}>Signature</Text>
          </View>

          {loadingTemplate ? (
            <ActivityIndicator style={{ marginTop: 30 }} color="#4f46e5" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {step === 'photos' && (
                <>
                  <Text style={styles.sectionLabel}>
                    {photoField?.label || 'Delivery Photo'} ({photos.length}/{maxPhotos})
                  </Text>

                  <View style={styles.photoGrid}>
                    {photos.map((p, idx) => (
                      <View key={idx} style={styles.photoThumbWrap}>
                        <Image source={{ uri: `file://${p.path}` }} style={styles.photoThumb} />
                        <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {photos.length < maxPhotos && (
                      <TouchableOpacity style={styles.addPhotoBtn} onPress={openCamera}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={26} color="#4f46e5" />
                        <Text style={styles.addPhotoText}>Add Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, photos.length < minPhotos && styles.primaryBtnDisabled]}
                    onPress={goToSignature}
                    disabled={photos.length < minPhotos}
                  >
                    <Text style={styles.primaryBtnText}>Next</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              {step === 'signature' && (
                <>
                  <Text style={styles.sectionLabel}>Customer Signature</Text>
                  <SignaturePad ref={signatureRef} />

                  <View style={styles.rowBtns}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('photos')} disabled={submitting}>
                      <Ionicons name="arrow-back" size={16} color="#475569" />
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { flex: 1.4 }, submitting && styles.primaryBtnDisabled]}
                      onPress={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Submit</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Full-screen camera for capturing delivery photos */}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={closeCamera}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.cameraTopBar}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Delivery Photo</Text>
              <TouchableOpacity onPress={closeCamera}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {device && hasPermission ? (
                <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive={cameraOpen} photo />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>Camera not available</Text>
                </View>
              )}
            </View>

            <View style={styles.captureBar}>
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </Modal>
  );
};

export default DispatchForm;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '90%', minHeight: '55%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  subTitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 30 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: '#4f46e5' },
  stepDotText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  stepLine: { flex: 1, height: 2, backgroundColor: '#e2e8f0', marginHorizontal: 6 },
  stepLineDone: { backgroundColor: '#4f46e5' },
  stepLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 4 },
  stepLabelText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  sectionLabel: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  photoThumbWrap: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemoveBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: 90, height: 90, borderRadius: 10, borderWidth: 1.5, borderColor: '#c7d2fe', borderStyle: 'dashed', backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', gap: 4 },
  addPhotoText: { fontSize: 10, color: '#4f46e5', fontWeight: '700' },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4f46e5', paddingVertical: 13, borderRadius: 10, marginTop: 6 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 10 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f1f5f9', paddingVertical: 13, borderRadius: 10 },
  secondaryBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },

  cameraTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  captureBar: { alignItems: 'center', paddingBottom: 24, paddingTop: 12 },
  captureBtn: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  sigWrap: { height: 220, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#F8FAFC', overflow: 'hidden' },
  sigClearBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  sigClearBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
});
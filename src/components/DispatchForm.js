import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Signature from 'react-native-signature-canvas';
import API from '../api/api1';

/* ─────────────────────────────────────────────────────────────────────────
 * 1. TEMPLATE
 * ────────────────────────────────────────────────────────────────────── */

const TEMPLATE_ENDPOINT = (id) => `/template/get/${id}`;
const UPLOAD_ENDPOINT = '/logistic/upload-package-photos';
const DELIVERY_TEMPLATE_ID = 'delivery_documentation';

// Template fetch fail aana idhu use aagum (DB template-oda same)
const DEFAULT_SECTIONS = [
  {
    label: 'Section 1: Delivery Documentation / Photos',
    fields: [
      { key: 'deliveryPhoto', label: 'Delivery Photo', kind: 'photo', required: true },
      { key: 'solarPanelPhoto', label: 'Solar Panel Photo', kind: 'photo', required: true },
      { key: 'inverterPhoto', label: 'Inverter Photo', kind: 'photo', required: true },
      { key: 'kitItemsPhoto', label: 'Kit Items Photo', kind: 'photo', required: true },
      { key: 'customerSignature', label: 'Customer Signature', kind: 'signature', required: true },
      { key: 'driverSignature', label: 'Driver Signature', kind: 'signature', required: true },
      { key: 'chequePhoto', label: 'Cheque Photo', kind: 'photo', required: false },
    ],
  },
];

// schema + uischema → [{ label, fields: [{ key, label, kind, required }] }]
const buildSectionsFromTemplate = (data) => {
  const schema = data?.schema;
  const ui = data?.uischema;
  if (!schema?.properties || !ui) return DEFAULT_SECTIONS;

  const required = schema.required || [];
  const sections = [];

  const walk = (el, current) => {
    let section = current;
    if (el.type === 'Category') {
      section = { label: el.label || '', fields: [] };
      sections.push(section);
    }
    if (el.type === 'Control' && el.scope) {
      const key = el.scope.split('/').pop();
      if (schema.properties[key]) {
        if (!section) {
          section = { label: '', fields: [] };
          sections.push(section);
        }
        section.fields.push({
          key,
          label: el.label || schema.properties[key].title || key,
          kind: el.options?.format === 'signature' ? 'signature' : 'photo',
          required: required.includes(key),
        });
      }
    }
    (el.elements || []).forEach((child) => walk(child, section));
  };
  walk(ui, null);

  const nonEmpty = sections.filter((s) => s.fields.length > 0);
  return nonEmpty.length > 0 ? nonEmpty : DEFAULT_SECTIONS;
};

export const fetchDeliveryTemplate = async (templateId = DELIVERY_TEMPLATE_ID) => {
  try {
    const res = await API.get(TEMPLATE_ENDPOINT(templateId));
    const data = res?.data?.data || res?.data?.template || res?.data;
    return { templateId, sections: buildSectionsFromTemplate(data) };
  } catch (err) {
    console.warn('[DispatchForm] template fetch failed, using default:', err?.response?.data || err.message);
    return { templateId, sections: DEFAULT_SECTIONS };
  }
};

/* ─────────────────────────────────────────────────────────────────────────
 * 2. LOCAL FILES + UPLOAD + OFFLINE QUEUE
 * ────────────────────────────────────────────────────────────────────── */

const UPLOADS_DIR = `${RNFS.DocumentDirectoryPath}/delivery_uploads`;

const stripFile = (p) => (p && p.startsWith('file://') ? p.replace('file://', '') : p);
const toFileUri = (p) => (p && !p.startsWith('file://') ? `file://${p}` : p);

// FIX: Zoho's Delivery_Date field is a DATETIME field, not a plain date —
// it rejected "2026-09-24" (INVALID_DATA / expected_data_type: "datetime").
// Zoho's API requires ISO 8601 WITH a timezone offset, e.g.
// "2026-09-24T14:30:00+05:30" — no trailing "Z", no milliseconds.
// toISOString() gives neither of those (it's UTC + "Z" + ms), so build the
// string by hand from local device time + local device timezone offset.
const toZohoDateTime = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');

  const offsetMin = -date.getTimezoneOffset(); // e.g. +330 for IST
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offH = pad(Math.floor(absOffset / 60));
  const offM = pad(absOffset % 60);

  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());

  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${offH}:${offM}`;
};

const ensureUploadsDir = async () => {
  if (!(await RNFS.exists(UPLOADS_DIR))) await RNFS.mkdir(UPLOADS_DIR);
};

const persistCapturedPhoto = async (sourcePath, fileName) => {
  try {
    await ensureUploadsDir();
    const destPath = `${UPLOADS_DIR}/${fileName}`;
    await RNFS.copyFile(stripFile(sourcePath), destPath);
    return destPath;
  } catch (e) {
    console.warn('[DispatchForm] persistCapturedPhoto failed, using original:', e.message);
    return stripFile(sourcePath);
  }
};

const persistBase64Png = async (base64, name) => {
  await ensureUploadsDir();
  const destPath = `${UPLOADS_DIR}/${name}`;
  await RNFS.writeFile(destPath, base64, 'base64');
  return destPath;
};

const deleteLocalFile = async (path) => {
  try {
    const clean = stripFile(path);
    if (clean && (await RNFS.exists(clean))) await RNFS.unlink(clean);
  } catch (e) {
    console.warn('[DispatchForm] deleteLocalFile failed:', e.message);
  }
};

// files: [{ field, path, type, fileName }]  — multipart part name = field key
/// files: [{ field, path, type, fileName }] — multipart part name = field key
// (backend per-key fields expect pannudhu: deliveryPhoto, chequePhoto, ...)
const buildDeliveryFormData = ({ deal_id, package_number, dispatch_number, state, files = [], extraFields = {} }) => {
  const formData = new FormData();
  formData.append('deal_id', deal_id);
  formData.append('package_number', package_number);
  if (dispatch_number) formData.append('dispatch_number', dispatch_number);
  if (state) formData.append('state', state);

  files.forEach((f) => {
    formData.append(f.field, {          // 👈 'photos' badhila f.field
      uri: toFileUri(f.path),
      type: f.type || 'image/jpeg',
      name: f.fileName || `${f.field}_${package_number}_${Date.now()}.jpg`,
    });
  });

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
   const info = await Promise.all(
    (payload.files || []).map(async (f) => {
      const st = await RNFS.stat(stripFile(f.path)).catch(() => null);
      return `${f.field} | ${f.fileName} | ${st ? (st.size / 1024).toFixed(0) + 'KB' : 'MISSING'}`;
    })
  );
  console.log('📤 sending', info.length, 'files:\n' + info.join('\n'));
  const formData = buildDeliveryFormData(payload);
  const res = await API.post(UPLOAD_ENDPOINT, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });
  return res?.data;
};

const anyFileMissing = async (payload) => {
  for (const f of payload.files || []) {
    if (!(await RNFS.exists(stripFile(f.path)))) return true;
  }
  return false;
};

const cleanupPayloadFiles = async (payload) => {
  for (const f of payload.files || []) await deleteLocalFile(f.path);
};

const DELIVERY_QUEUE_KEY = 'delivery_photo_queue:v2';
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
  console.log('📥 [DispatchForm] queued delivery (offline):', payload.deal_id, payload.package_number);
};

export const flushDeliveryQueue = async () => {
  if (isFlushingDeliveryQueue) return;
  isFlushingDeliveryQueue = true;
  try {
    const queue = await getDeliveryQueue();
    if (queue.length === 0) return;

    console.log(`🔄 [DispatchForm] flushing ${queue.length} queued delivery submission(s)...`);
    const remaining = [];

    for (const item of queue) {
      if (await anyFileMissing(item.payload)) {
        console.error('❌ [DispatchForm] file missing, dropping item:', item.payload.package_number);
        continue;
      }
      try {
        await trySubmit(item.payload);
        console.log('✅ [DispatchForm] synced:', item.payload.package_number);
        await cleanupPayloadFiles(item.payload);
      } catch (e) {
        const status = e?.response?.status;
        const attempts = (item.attempts || 0) + 1;
        console.warn('⚠️ [DispatchForm] failed:', status, e?.response?.data || e.message);
        // 4xx (408/429 thavira) = request thappu, retry vendam
        const badRequest = status && status >= 400 && status < 500 && status !== 408 && status !== 429;
        if (!badRequest && attempts < 8) {
          remaining.push({ ...item, attempts });
        } else {
          console.error('❌ [DispatchForm] dropping item:', item.payload.package_number);
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

export const submitPackageDeliveryPhotos = async ({ deal_id, package_number, dispatch_number, state, files, extraFields }) => {
  const payload = { deal_id, package_number, dispatch_number, state, files, extraFields };

  if (!(await isOnline())) {
    await queueDeliverySubmission(payload);
    return { ok: true, queued: true };
  }
  try {
    await trySubmit(payload);
    await cleanupPayloadFiles(payload);
    return { ok: true, queued: false };
  } catch (e) {
    console.warn('⚠️ [DispatchForm] immediate submit failed, queuing:', e?.response?.data || e.message);
    await queueDeliverySubmission(payload);
    return { ok: true, queued: true };
  }
};

/* ─────────────────────────────────────────────────────────────────────────
 * 3. UI
 * ────────────────────────────────────────────────────────────────────── */

const ACCENT_PHOTO = '#f59e0b';
const ACCENT_SIGN = '#3b82f6';
const ACCENT_UPLOAD = '#22c55e';

const Req = ({ show }) => (show ? <Text style={{ color: '#ED1C25' }}> *</Text> : null);

const DispatchForm = ({ visible, pkg, onClose, onSubmitted }) => {
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [photos, setPhotos] = useState({});
  const [signatures, setSignatures] = useState({});
  const [drawKey, setDrawKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const sigRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setPhotos({});
    setSignatures({});
    setDrawKey(null);
    setLoadingTemplate(true);

    fetchDeliveryTemplate(DELIVERY_TEMPLATE_ID)
      .then((t) => setSections(t.sections))
      .finally(() => setLoadingTemplate(false));
  }, [visible, pkg?.package_number]);

  const allFields = sections.flatMap((s) => s.fields);
  const drawField = allFields.find((f) => f.key === drawKey);
  const missingFields = allFields
    .filter((f) => f.required)
    .filter((f) => (f.kind === 'signature' ? !signatures[f.key] : !photos[f.key]));
  const canSubmit = missingFields.length === 0 && !submitting;

  // ── Photos ──
  const setPhotoFromAsset = async (key, asset) => {
    if (!asset?.uri) return;
    const fileName = `${key}_${pkg?.package_number}_${Date.now()}.jpg`;
    const path = await persistCapturedPhoto(asset.uri, fileName);
    setPhotos((prev) => {
      if (prev[key]) deleteLocalFile(prev[key].path);
      return { ...prev, [key]: { path, fileName, type: 'image/jpeg' } };
    });
  };

  const capturePhoto = (key) => {
    launchCamera({ mediaType: 'photo', quality: 0.7, saveToPhotos: false }, async (res) => {
      if (res.didCancel || res.errorCode) return;
      await setPhotoFromAsset(key, res.assets?.[0]);
    });
  };

  const uploadPhoto = (key) => {
    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.7 }, async (res) => {
      if (res.didCancel || res.errorCode) return;
      await setPhotoFromAsset(key, res.assets?.[0]);
    });
  };

  const removePhoto = (key) => {
    const target = photos[key];
    if (target) deleteLocalFile(target.path);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // ── Signatures ──
  const uploadSignature = (key) => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.3, maxWidth: 800, maxHeight: 800, selectionLimit: 1, includeBase64: true },
      (res) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (!asset?.base64) return;
        setSignatures((prev) => ({ ...prev, [key]: `data:${asset.type ?? 'image/jpeg'};base64,${asset.base64}` }));
      }
    );
  };

  const handleSignatureOK = (dataUri) => {
    if (drawKey) setSignatures((prev) => ({ ...prev, [drawKey]: dataUri }));
    setDrawKey(null);
  };

  const clearSignature = (key) =>
    setSignatures((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // ── Submit ──
  const handleSubmit = async () => {
    if (missingFields.length > 0) {
      Alert.alert(
        'Required Fields Missing',
        `Please fill in the following before submitting:\n\n${missingFields.map((f) => f.label).join('\n')}`
      );
      return;
    }

    const crmDealId = String(pkg?.crm_deal_id || '').trim();
    if (!crmDealId) {
      Alert.alert('Error', 'CRM Deal ID not found for this package.');
      return;
    }

    setSubmitting(true);
    try {
      const files = [];

      for (const f of allFields) {
        if (f.kind === 'photo' && photos[f.key]) {
          files.push({ field: f.key, path: photos[f.key].path, type: 'image/jpeg', fileName: photos[f.key].fileName });
        }
        if (f.kind === 'signature' && signatures[f.key]) {
          const dataUri = signatures[f.key];
          const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
          const isJpeg = dataUri.startsWith('data:image/jpeg');
          const name = `${f.key}_${pkg?.package_number}_${Date.now()}.${isJpeg ? 'jpg' : 'png'}`;
          const path = await persistBase64Png(base64, name);
          files.push({ field: f.key, path, type: isJpeg ? 'image/jpeg' : 'image/png', fileName: name });
        }
      }

      const result = await submitPackageDeliveryPhotos({
        deal_id: crmDealId,
        package_number: pkg?.package_number,
        dispatch_number: pkg?.dispatch_number,
        state: pkg?.state,
        files,
        extraFields: {
          // FIX: Zoho's Delivery_Date field is a DATETIME field — it was
          // getting a date-only string ("2026-09-24") and rejecting it
          // with INVALID_DATA (expected_data_type: "datetime"). Send a
          // full ISO 8601 datetime WITH a timezone offset instead.
          delivery_date: toZohoDateTime(),
        },
      });

      onSubmitted?.(result);

      if (result.queued) {
        Alert.alert(
          '✔ Saved Offline',
          "This delivery is saved on your device and will be sent automatically once you're back online."
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

  const renderPhotoField = (f) => {
    const file = photos[f.key];
    return (
      <View key={f.key} style={styles.fieldContainer}>
        <Text style={styles.label}>{f.label}<Req show={f.required} /></Text>

        {file ? (
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: toFileUri(file.path) }} style={styles.photoPreview} resizeMode="cover" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: ACCENT_PHOTO }]} onPress={() => capturePhoto(f.key)}>
                <Ionicons name="camera-outline" size={16} color={ACCENT_PHOTO} />
                <Text style={[styles.smallBtnText, { color: ACCENT_PHOTO }]}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: ACCENT_UPLOAD }]} onPress={() => uploadPhoto(f.key)}>
                <Ionicons name="cloud-upload-outline" size={16} color={ACCENT_UPLOAD} />
                <Text style={[styles.smallBtnText, { color: ACCENT_UPLOAD }]}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: '#ED1C25' }]} onPress={() => removePhoto(f.key)}>
                <Ionicons name="trash-outline" size={16} color="#ED1C25" />
                <Text style={[styles.smallBtnText, { color: '#ED1C25' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.dashedBtn, { borderColor: ACCENT_PHOTO }]} onPress={() => capturePhoto(f.key)}>
              <Ionicons name="camera-outline" size={20} color={ACCENT_PHOTO} />
              <Text style={[styles.dashedBtnText, { color: ACCENT_PHOTO }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dashedBtn, { borderColor: ACCENT_PHOTO }]} onPress={() => uploadPhoto(f.key)}>
              <Ionicons name="cloud-upload-outline" size={20} color={ACCENT_PHOTO} />
              <Text style={[styles.dashedBtnText, { color: ACCENT_PHOTO }]}>Upload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSignatureField = (f) => {
    const sig = signatures[f.key];
    return (
      <View key={f.key} style={styles.fieldContainer}>
        <Text style={styles.label}>{f.label}<Req show={f.required} /></Text>

        {sig ? (
          <View style={{ alignItems: 'center' }}>
            <Image source={{ uri: sig }} style={styles.signaturePreview} resizeMode="contain" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: ACCENT_SIGN }]} onPress={() => setDrawKey(f.key)}>
                <Ionicons name="create-outline" size={16} color={ACCENT_SIGN} />
                <Text style={[styles.smallBtnText, { color: ACCENT_SIGN }]}>Re-sign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: ACCENT_UPLOAD }]} onPress={() => uploadSignature(f.key)}>
                <Ionicons name="cloud-upload-outline" size={16} color={ACCENT_UPLOAD} />
                <Text style={[styles.smallBtnText, { color: ACCENT_UPLOAD }]}>Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { borderColor: '#ED1C25' }]} onPress={() => clearSignature(f.key)}>
                <Ionicons name="trash-outline" size={16} color="#ED1C25" />
                <Text style={[styles.smallBtnText, { color: '#ED1C25' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[styles.dashedBtn, { borderColor: ACCENT_SIGN }]} onPress={() => setDrawKey(f.key)}>
              <Ionicons name="create-outline" size={20} color={ACCENT_SIGN} />
              <Text style={[styles.dashedBtnText, { color: ACCENT_SIGN }]}>Draw Signature</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dashedBtn, { borderColor: ACCENT_UPLOAD }]} onPress={() => uploadSignature(f.key)}>
              <Ionicons name="cloud-upload-outline" size={20} color={ACCENT_UPLOAD} />
              <Text style={[styles.dashedBtnText, { color: ACCENT_UPLOAD }]}>Upload Image</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={drawKey ? () => setDrawKey(null) : onClose}>
      <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Delivery Confirmation</Text>
            <Text style={styles.subTitle}>{pkg?.package_number || pkg?.deal_id}</Text>
          </View>
        </View>

        {loadingTemplate ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ED1C25" />
            <Text style={{ marginTop: 10, color: '#888' }}>Loading form...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            {sections.map((section, sIdx) => (
              <View key={sIdx}>
                {!!section.label && (
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionDot} />
                    <Text style={styles.sectionTitle}>{section.label}</Text>
                  </View>
                )}
                {section.fields.map((f) =>
                  f.kind === 'signature' ? renderSignatureField(f) : renderPhotoField(f)
                )}
              </View>
            ))}

            {missingFields.length > 0 && (
              <Text style={styles.pendingText}>
                {missingFields.length} required field{missingFields.length > 1 ? 's' : ''} pending:{' '}
                {missingFields.map((f) => f.label).join(', ')}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit Delivery</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Signature draw pad overlay */}
        {!!drawKey && (
          <View style={styles.sigOverlay}>
            <View style={styles.sigModalHeader}>
              <Text style={styles.sigModalTitle}>{drawField?.label || 'Signature'}</Text>
              <TouchableOpacity onPress={() => setDrawKey(null)}>
                <Ionicons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 320, marginHorizontal: 16, marginTop: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
  <Signature
    key={drawKey}
    ref={sigRef}
    onOK={handleSignatureOK}
    onEmpty={() => Alert.alert('Signature required', 'Please sign before saving.')}
    autoClear={false}
    descriptionText=""
    backgroundColor="rgb(255,255,255)"
    penColor="black"
    imageType="image/png"
    webStyle={`
      .m-signature-pad--footer { display: none; margin: 0; }
      .m-signature-pad { box-shadow: none; border: none; margin: 0; }
      body, html { background-color: #fff; }
    `}
  />
</View>

            <View style={styles.sigModalFooter}>
              <TouchableOpacity style={styles.sigFooterBtn} onPress={() => sigRef.current?.clearSignature()}>
                <Text style={styles.sigFooterBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sigFooterBtn, { backgroundColor: '#ED1C25', borderColor: '#ED1C25' }]}
                onPress={() => sigRef.current?.readSignature()}
              >
                <Text style={[styles.sigFooterBtnText, { color: '#fff' }]}>Save Signature</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default DispatchForm;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#ED1C25', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  subTitle: { fontSize: 12, color: '#ffcccc', marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 20, paddingBottom: 8,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ED1C25', marginRight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', flex: 1 },

  fieldContainer: {
    backgroundColor: '#fff', marginHorizontal: 15,
    marginBottom: 10, borderRadius: 10, padding: 14, elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 },

  dashedBtn: {
    flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: '#fff',
  },
  dashedBtnText: { fontWeight: '700', fontSize: 13 },

  photoPreview: {
    width: '100%', height: 160, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  signaturePreview: {
    width: '100%', height: 130, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff',
  },
  smallBtn: {
    borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff',
  },
  smallBtnText: { fontWeight: '700', fontSize: 12 },

  submitBtn: {
    backgroundColor: '#ED1C25', marginHorizontal: 15,
    marginTop: 16, paddingVertical: 15, borderRadius: 10,
    alignItems: 'center', elevation: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    submitBtnDisabled: { backgroundColor: '#cbd5e1', elevation: 0 },
  pendingText: { marginHorizontal: 15, marginTop: 12, fontSize: 12, color: '#ED1C25', fontWeight: '600' },

  sigOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fff', zIndex: 50 },
  sigModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  sigModalTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  sigModalFooter: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  sigFooterBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingVertical: 13, alignItems: 'center', backgroundColor: '#fff',
  },
  sigFooterBtnText: { fontWeight: '700', fontSize: 14, color: '#333' },
});
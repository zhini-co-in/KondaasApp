import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TextInput, TouchableOpacity, Alert, Modal, FlatList, Image,
  PermissionsAndroid, Platform,
} from 'react-native';
import API from '../api/api1';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useLocationTracking, requestLocationPermissions } from '../service/locationService';
import {
  cacheTemplate, getCachedTemplate,
  saveFormDataLocally, getSavedFormData,
} from '../service/Localleadsstorage';
import { enqueue } from '../service/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import ImageResizer from 'react-native-image-resizer';
import DateTimePicker from '@react-native-community/datetimepicker';
// ✅ ADDED — video compression library (npm install react-native-compressor)
import { Video } from 'react-native-compressor';

interface FieldProperty {
  title?: string; description?: string; type?: string;
  enum?: string[]; properties?: Record<string, FieldProperty>; format?: string;
  items?: { type?: string; format?: string };
}
interface SchemaProperties { [key: string]: FieldProperty; }
interface Schema { properties?: SchemaProperties; required?: string[]; }

// ── uischema conditional "rule" support (SHOW/HIDE) ─────────────────────────
// Matches JSONForms-style rules: { effect: "SHOW", condition: { scope, schema: { const } } }
interface UIRuleCondition {
  scope: string;
  schema: { const?: any };
}
interface UIRule {
  effect: 'SHOW' | 'HIDE';
  condition: UIRuleCondition;
}
interface UIElement {
  type: string; scope?: string; label?: string;
  elements?: UIElement[];
  // ✅ ADDED: readOnly — lets uischema mark a field (e.g. Report_Number,
  // Plant_Cost_After_Subsidy) as view-only so the field renderer disables
  // editing instead of silently showing an editable text box.
  options?: { multi?: boolean; uploadType?: string; readOnly?: boolean };
  rule?: UIRule;
}
interface UISchema { type: string; elements: UIElement[]; }
interface Template { id: string; schema: Schema; uischema: UISchema; }
interface Lead { id: string; name: string; phone: string; [key: string]: string; }

interface PhotoFile {
  uri: string;
  name: string;
  type: string;
}

interface GpsCoords {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  [key: string]: any;
}

// ── Upload helpers ──────────────────────────────────────────────────────────────
// Multi-file array fields (EB_Bill_Copy, Site_Survey_Photos, and every new
// "sitePhoto" / "siteVideo" field from the schema) are colour-coded by
// uploadType so the UI stays visually distinct without hardcoding each field.
const colorForUploadType = (uploadType?: string): string => {
  switch (uploadType) {
    case 'ebBill': return '#22c55e';
    case 'siteSurvey': return '#3b82f6';
    case 'sitePhoto': return '#f59e0b';
    case 'siteVideo': return '#8b5cf6';
    default: return '#64748b';
  }
};

// Backend now loops over every multipart field name dynamically
// (`for (const fieldName of Object.keys(body))`) and only special-cases
// "EB_Bill_Copy" for the WorkDrive folder name. So the multipart part name
// MUST be the exact schema field key — no renaming, or the backend can't
// match it to the schema / pick the right folder.
const multipartFieldName = (fieldKey: string): string => fieldKey;

// ── Zoho "Single Line" text-field enforcer ──────────────────────────────────
// Some schema fields (Report_Number, Zip_Postal_Code, etc.) are plain
// strings on our side, but if a value happens to be all-digits (e.g.
// Report_Number = "105"), some serialization paths can let it slip through
// as a JS number instead of a string, which Zoho's "Single Line" (text)
// custom fields reject with "expected_data_type":"text". This list is the
// single source of truth for which schema fields must always be forced to
// a real string right before they're sent — add a new field key here if a
// future Zoho text field starts throwing the same INVALID_DATA error.
const ZOHO_TEXT_FIELDS = [
  'Report_Number',
  'Zip_Postal_Code',
  'Consumer_Number',
  'Advance_Payment_UTR',
];

const enforceZohoTextFields = (
  payload: Record<string, any>,
): Record<string, any> => {
  const fixed = { ...payload };
  ZOHO_TEXT_FIELDS.forEach((key) => {
    if (fixed[key] !== undefined && fixed[key] !== null) {
      fixed[key] = String(fixed[key]).trim();
    }
  });
  return fixed;
};

// ── Zoho DateTime formatter ──────────────────────────────────────────────────
// Zoho's DateTime custom field expects "yyyy-MM-ddTHH:mm:ss±HH:mm" (local
// time with a numeric offset) — NOT raw .toISOString(), which returns UTC
// with a trailing "Z" and milliseconds (e.g. "2026-07-13T05:00:00.000Z").
// Sending that raw ISO-Z string is exactly what triggers Zoho's
// "expected_data_type":"datetime" INVALID_DATA error. Every place that used
// to call .toISOString() for a datetime field now calls this instead.
const toZohoDateTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset(); // e.g. IST => +330
  const sign = offsetMin >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offM = pad(Math.abs(offsetMin) % 60);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
};

// ── Conditional field visibility (uischema "rule": SHOW/HIDE) ──────────────────
// formValues stores everything as strings, so boolean/number `const` values
// from the schema are coerced to string before comparing.
const isFieldVisible = (
  element: UIElement,
  formValues: Record<string, string>,
): boolean => {
  if (!element.rule) return true;
  const { effect, condition } = element.rule;
  const fieldKey = condition.scope.split('/').pop() ?? '';
  const rawValue = formValues[fieldKey] ?? '';
  const expected = condition.schema.const;
  const expectedStr = typeof expected === 'boolean' || typeof expected === 'number'
    ? String(expected)
    : expected;
  const matches = rawValue === expectedStr;
  return effect === 'SHOW' ? matches : !matches;
};

// Walks every group's elements, keeps only fields whose rule currently
// evaluates to visible, and drops any empty-string / null / undefined values
// so hidden or untouched optional fields (e.g. Advance_Paid_Date when
// Advance_payment_Received is false) never reach the backend/Zoho as "".
const buildVisiblePayload = (
  groups: UIElement[],
  formValues: Record<string, string>,
): Record<string, string> => {
  const visibleKeys = new Set<string>();
  groups.forEach((group) => {
    (group.elements ?? []).forEach((element) => {
      const fieldKey = element.scope?.split('/').pop();
      if (!fieldKey) return;
      if (isFieldVisible(element, formValues)) visibleKeys.add(fieldKey);
    });
  });

  const cleaned: Record<string, string> = {};
  Object.entries(formValues).forEach(([key, val]) => {
    // Fields with no matching uischema control (e.g. Longitude, GPS_Accuracy,
    // Google_Map_Location which are rendered inline by the Latitude group)
    // are always kept — only rule-driven fields get filtered.
    const isRuleControlled = groups.some((group) =>
      (group.elements ?? []).some((el) => el.scope?.split('/').pop() === key && el.rule)
    );
    if (isRuleControlled && !visibleKeys.has(key)) return; // hidden → skip
    if (val === '' || val === null || val === undefined) return; // empty → skip
    cleaned[key] = val;
  });
  return cleaned;
};

// ── Dropdown ──────────────────────────────────────────────────────────────────
const DropdownPicker = ({
  label, options, value, onChange, required, readOnly,
}: {
  label: string; options: string[]; value: string;
  onChange: (val: string) => void; required?: boolean; readOnly?: boolean;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.dropdownBtn, readOnly && styles.readOnlyBox]}
        onPress={() => { if (!readOnly) setVisible(true); }}
        activeOpacity={readOnly ? 1 : 0.7}
      >
        <Text style={{ color: value ? '#333' : '#aaa', fontSize: 14, flex: 1 }}>
          {value || 'Select...'}
        </Text>
        {!readOnly && <Ionicons name="chevron-down-outline" size={16} color="#888" />}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.dropdownItem, value === item && { backgroundColor: '#FFF0F0' }]}
                  onPress={() => { onChange(item); setVisible(false); }}
                >
                  <Text style={{ color: '#333', fontSize: 14 }}>{item}</Text>
                  {value === item && <Ionicons name="checkmark" size={16} color="#ED1C25" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── GPS Location Field ─────────────────────────────────────────────────────────
const GpsLocationField = ({
  label, coords, mapLink, loading, onRefetch, required,
}: {
  label: string; coords: GpsCoords; mapLink: string;
  loading: boolean; onRefetch: () => void; required?: boolean;
}) => {
  const hasCoords = coords.latitude != null && coords.longitude != null;

  return (
    <View style={[styles.fieldContainer, { padding: 16 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={16} color="#ED1C25" />
          <Text style={styles.label}>
            {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
          </Text>
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center',
            gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
          }}
          onPress={onRefetch}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="navigate" size={14} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            {hasCoords ? 'Refetch GPS' : 'Fetch GPS Location'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{
        backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca',
        borderRadius: 6, padding: 12,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#888' }}>LATITUDE</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>
              {coords.latitude != null ? coords.latitude.toFixed(6) : '—'}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#888' }}>LONGITUDE</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#333' }}>
              {coords.longitude != null ? coords.longitude.toFixed(6) : '—'}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#888' }}>ACCURACY</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#ED1C25' }}>
              {coords.accuracy != null ? `±${coords.accuracy.toFixed(1)}m` : '—'}
            </Text>
          </View>
        </View>
        {!!mapLink && (
          <Text style={{ fontSize: 10, color: '#ED1C25', marginTop: 8 }} numberOfLines={1}>
            {mapLink}
          </Text>
        )}
      </View>
    </View>
  );
};

// ── Date / DateTime Picker Field ────────────────────────────────────────────────
// Handles schema fields with format: "date" (date only) or format: "date-time"
// (date + time). Stores value as a Zoho-compatible string in formValues:
//   - date-only:      "yyyy-MM-dd"
//   - date-time:      "yyyy-MM-ddTHH:mm:ss±HH:mm"  (via toZohoDateTime)
// Android's native picker has no combined "datetime" mode, so on Android a
// date-time field opens the date picker first, then the time picker.
// iOS supports mode="datetime" directly in a single spinner.
const DateTimeField = ({
  label, value, onChange, required, mode, readOnly,
}: {
  label: string; value: string; onChange: (val: string) => void;
  required?: boolean; mode: 'date' | 'datetime'; readOnly?: boolean;
}) => {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(
    value && !isNaN(new Date(value).getTime()) ? new Date(value) : new Date()
  );

  const parsedValue = value && !isNaN(new Date(value).getTime()) ? new Date(value) : null;

  const displayValue = parsedValue
    ? mode === 'datetime'
      ? parsedValue.toLocaleString('en-IN')
      : parsedValue.toLocaleDateString('en-IN')
    : '';

  const openPicker = () => {
    if (readOnly) return; // ✅ ADDED — readOnly fields never open the picker
    setTempDate(parsedValue ?? new Date());
    setShowDate(true);
  };

  const formatDateOnly = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (event: any, selected?: Date) => {
    setShowDate(false);
    if (event?.type === 'dismissed' || !selected) return;

    if (mode === 'date') {
      onChange(formatDateOnly(selected));           // ← Pure YYYY-MM-DD
      return;
    }

    // datetime handling
    if (Platform.OS === 'ios') {
      // ✅ CHANGED — was selected.toISOString() (UTC + "Z" + millis, which
      // Zoho's DateTime field rejects). Now uses the local-time,
      // offset-formatted string Zoho actually expects.
      onChange(toZohoDateTime(selected));
      return;
    }

    setTempDate(selected);
    setShowTime(true);
  };

  const handleTimeChange = (event: any, selected?: Date) => {
    setShowTime(false);
    if (event?.type === 'dismissed' || !selected) return;

    const combined = new Date(tempDate);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    // ✅ CHANGED — was combined.toISOString(); now Zoho-formatted.
    onChange(toZohoDateTime(combined));
  };

  const clear = () => onChange('');

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.dropdownBtn, readOnly && styles.readOnlyBox]}
        onPress={openPicker}
        activeOpacity={readOnly ? 1 : 0.7}
      >
        <Ionicons name="calendar-outline" size={16} color="#888" style={{ marginRight: 8 }} />
        <Text style={{ color: parsedValue ? '#333' : '#aaa', fontSize: 14, flex: 1 }}>
          {displayValue || (mode === 'datetime' ? 'Select date & time...' : 'Select date...')}
        </Text>
        {!readOnly && !!parsedValue && (
          <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#ccc" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showDate && !readOnly && (
        <DateTimePicker
          value={tempDate}
          mode={Platform.OS === 'ios' ? mode : 'date'}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
      {showTime && !readOnly && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

// ── Multi-file Upload Field (photos OR videos) ─────────────────────────────────
// ✅ CHANGED — stronger compression: 1280→1024 max dimension, quality 70→50.
// This shrinks every photo further so the total multipart payload stays
// safely under server body-size limits.
async function compressImage(uri: string): Promise<string> {
  try {
    const resized = await ImageResizer.createResizedImage(
      uri, 1024, 1024, 'JPEG', 50, 0
    );
    return resized.uri;
  } catch (err) {
    console.warn('⚠️ Image compress failed, using original:', err);
    return uri;
  }
}

// ✅ ADDED — video compression. Previously videos were sent completely
// uncompressed (raw camera/gallery file, often 20-50MB+ each), which was
// the single biggest contributor to the 413 "Request Entity Too Large"
// error. This shrinks resolution/bitrate before the file ever reaches
// FormData, so the whole multipart body stays much smaller.
async function compressVideo(uri: string): Promise<string> {
  try {
    console.log('🎬 Compressing video:', uri);
    const compressedUri = await Video.compress(
      uri,
      {
        compressionMethod: 'auto',
        maxSize: 640,                    // caps resolution — plenty for site-survey clips
        minimumFileSizeForCompress: 2,    // MB — skip already-tiny videos
      },
      (progress) => {
        console.log('📹 Video compress progress:', Math.round(progress * 100), '%');
      }
    );
    console.log('✅ Video compressed:', compressedUri);
    return compressedUri;
  } catch (err) {
    console.warn('⚠️ Video compress failed, using original:', err);
    return uri;
  }
}

const PhotoUploadField = ({
  label, photoFiles, onChange, required,
  selectionLimit, namePrefix, accentColor, mediaType = 'photo',
}: {
  label: string; photoFiles: PhotoFile[];
  onChange: (files: PhotoFile[]) => void; required?: boolean;
  selectionLimit: number; namePrefix: string; accentColor: string;
  mediaType?: 'photo' | 'video';
}) => {
  const isVideo = mediaType === 'video';

  const appendFiles = (newFiles: PhotoFile[]) => {
    onChange([...photoFiles, ...newFiles]);
  };

  const mapAssets = async (assets: any[]): Promise<PhotoFile[]> => {
    const valid = assets.filter((asset) => asset.uri);
    const results = await Promise.all(
      valid.map(async (asset) => {
        // ✅ CHANGED — videos now also get compressed (was: asset.uri as-is,
        // which is what caused huge uncompressed videos to blow past the
        // server's body-size limit and trigger 413 errors).
        const finalUri = isVideo
          ? await compressVideo(asset.uri)
          : await compressImage(asset.uri);
        const ext = isVideo ? 'mp4' : 'jpg';
        return {
          uri: finalUri,
          name: asset.fileName ?? asset.uri?.split('/').pop() ?? `${namePrefix}_${Date.now()}.${ext}`,
          type: isVideo ? (asset.type ?? 'video/mp4') : 'image/jpeg',
        };
      })
    );
    return results;
  };

  const handleCapture = () => {
    launchCamera(
      {
        mediaType: isVideo ? 'video' : 'photo',
        quality: 0.8,
        saveToPhotos: !isVideo,
        ...(isVideo ? { videoQuality: 'medium' as const } : {}),
      },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        const mapped = await mapAssets(assets);
        appendFiles(mapped);
      }
    );
  };

  const handleUpload = () => {
    const remaining = Math.max(selectionLimit - photoFiles.length, 1);
    launchImageLibrary(
      { mediaType: isVideo ? 'video' : 'photo', selectionLimit: remaining, quality: 0.8 },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        const mapped = await mapAssets(assets);
        appendFiles(mapped);
      }
    );
  };

  const removeAt = (idx: number) => {
    const next = photoFiles.filter((_, i) => i !== idx);
    onChange(next);
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={{
            flex: 1, borderWidth: 1.5, borderColor: accentColor, borderStyle: 'dashed',
            borderRadius: 8, paddingVertical: 14, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 6,
            backgroundColor: '#fff',
          }}
          onPress={handleCapture}
        >
          <Ionicons name={isVideo ? 'videocam-outline' : 'camera-outline'} size={20} color={accentColor} />
          <Text style={{ color: accentColor, fontWeight: '700', fontSize: 13 }}>
            {isVideo ? 'Record Video' : 'Take Photo'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1, borderWidth: 1.5, borderColor: accentColor, borderStyle: 'dashed',
            borderRadius: 8, paddingVertical: 14, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 6,
            backgroundColor: '#fff',
          }}
          onPress={handleUpload}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={accentColor} />
          <Text style={{ color: accentColor, fontWeight: '700', fontSize: 13 }}>Upload</Text>
        </TouchableOpacity>
      </View>

      {photoFiles.length > 0 && (
        <>
          <Text style={{ fontSize: 12, color: accentColor, fontWeight: '600', marginTop: 10 }}>
            {photoFiles.length} file(s) selected
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {photoFiles.map((file, idx) => (
              <View key={idx} style={{ marginRight: 10 }}>
                {isVideo ? (
                  <View style={{
                    width: 64, height: 64, borderRadius: 8,
                    borderWidth: 1.5, borderColor: accentColor,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#f1f1f1',
                  }}>
                    <Ionicons name="videocam" size={26} color={accentColor} />
                  </View>
                ) : (
                  <Image
                    source={{ uri: file.uri }}
                    style={{
                      width: 64, height: 64, borderRadius: 8,
                      borderWidth: 1.5, borderColor: accentColor,
                    }}
                  />
                )}
                <TouchableOpacity
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    backgroundColor: '#ED1C25', borderRadius: 10,
                    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
                  }}
                  onPress={() => removeAt(idx)}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};

// ── Single-file Data-URL Upload Field (Aadhar, PAN, screenshots, etc) ──────────
// These schema fields are `type: "string", format: "data-url"` (not arrays),
// so — like the signature field — the picked image is base64-encoded and
// stored directly in formValues rather than sent as a multipart file.
const DataUrlUploadField = ({
  label, value, onChange, required, accentColor,
}: {
  label: string; value: string; onChange: (val: string) => void;
  required?: boolean; accentColor: string;
}) => {
  const pick = (fromCamera: boolean) => {
    const launcher = fromCamera ? launchCamera : launchImageLibrary;
    launcher(
      {
        mediaType: 'photo',
        quality: 0.3,        // ✅ CHANGED — was 0.5, smaller base64 payload
        maxWidth: 800,         // ✅ CHANGED — was 1000
        maxHeight: 800,        // ✅ CHANGED — was 1000
        selectionLimit: 1,
        includeBase64: true,
        saveToPhotos: fromCamera,
      },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.base64) return;
        const mime = asset.type ?? 'image/jpeg';
        onChange(`data:${mime};base64,${asset.base64}`);
      }
    );
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>

      {value ? (
        <View style={{ alignItems: 'center' }}>
          <Image source={{ uri: value }} style={styles.signaturePreview} resizeMode="contain" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.sigSmallBtn, { borderColor: accentColor }]}
              onPress={() => pick(false)}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={accentColor} />
              <Text style={[styles.sigSmallBtnText, { color: accentColor }]}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sigSmallBtn, { borderColor: '#ED1C25' }]}
              onPress={() => onChange('')}
            >
              <Ionicons name="trash-outline" size={16} color="#ED1C25" />
              <Text style={[styles.sigSmallBtnText, { color: '#ED1C25' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={[styles.sigActionBtn, { borderColor: accentColor }]} onPress={() => pick(true)}>
            <Ionicons name="camera-outline" size={20} color={accentColor} />
            <Text style={[styles.sigActionBtnText, { color: accentColor }]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sigActionBtn, { borderColor: accentColor }]} onPress={() => pick(false)}>
            <Ionicons name="cloud-upload-outline" size={20} color={accentColor} />
            <Text style={[styles.sigActionBtnText, { color: accentColor }]}>Upload</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── Signature Field (Draw or Upload) ───────────────────────────────────────────
const SignatureField = ({
  label, value, onChange, required,
}: {
  label: string; value: string; onChange: (val: string) => void; required?: boolean;
}) => {
  const [drawVisible, setDrawVisible] = useState(false);
  const sigRef = useRef<any>(null);

  const handleOK = (signature: string) => {
    // signature already arrives as "data:image/png;base64,...."
    onChange(signature);
    setDrawVisible(false);
  };

  const handleUpload = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.3,        // ✅ CHANGED — was 0.5
        maxWidth: 800,         // ✅ CHANGED — was 1000
        maxHeight: 800,        // ✅ CHANGED — was 1000
        selectionLimit: 1,
        includeBase64: true,
      },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset?.base64) return;
        const mime = asset.type ?? 'image/jpeg';
        onChange(`data:${mime};base64,${asset.base64}`);
      }
    );
  };

  const handleClear = () => onChange('');

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>

      {value ? (
        <View style={{ alignItems: 'center' }}>
          <Image
            source={{ uri: value }}
            style={styles.signaturePreview}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.sigSmallBtn, { borderColor: '#3b82f6' }]}
              onPress={() => setDrawVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color="#3b82f6" />
              <Text style={[styles.sigSmallBtnText, { color: '#3b82f6' }]}>Re-sign</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sigSmallBtn, { borderColor: '#22c55e' }]}
              onPress={handleUpload}
            >
              <Ionicons name="cloud-upload-outline" size={16} color="#22c55e" />
              <Text style={[styles.sigSmallBtnText, { color: '#22c55e' }]}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sigSmallBtn, { borderColor: '#ED1C25' }]}
              onPress={handleClear}
            >
              <Ionicons name="trash-outline" size={16} color="#ED1C25" />
              <Text style={[styles.sigSmallBtnText, { color: '#ED1C25' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.sigActionBtn, { borderColor: '#3b82f6' }]}
            onPress={() => setDrawVisible(true)}
          >
            <Ionicons name="create-outline" size={20} color="#3b82f6" />
            <Text style={[styles.sigActionBtnText, { color: '#3b82f6' }]}>Draw Signature</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sigActionBtn, { borderColor: '#22c55e' }]}
            onPress={handleUpload}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#22c55e" />
            <Text style={[styles.sigActionBtnText, { color: '#22c55e' }]}>Upload Image</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={drawVisible} animationType="slide" onRequestClose={() => setDrawVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.sigModalHeader}>
            <Text style={styles.sigModalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setDrawVisible(false)}>
              <Ionicons name="close" size={26} color="#333" />
            </TouchableOpacity>
          </View>

          <SignatureScreen
            ref={sigRef}
            onOK={handleOK}
            autoClear={false}
            descriptionText=""
            webStyle={`
              .m-signature-pad--footer { display: none; margin: 0; }
              .m-signature-pad { box-shadow: none; border: 1px solid #ddd; margin: 0; }
              body,html { height: 100%; background-color: #fff; }
            `}
          />

          <View style={styles.sigModalFooter}>
            <TouchableOpacity
              style={styles.sigFooterBtn}
              onPress={() => sigRef.current?.clearSignature()}
            >
              <Text style={styles.sigFooterBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sigFooterBtn, { backgroundColor: '#ED1C25' }]}
              onPress={() => sigRef.current?.readSignature()}
            >
              <Text style={[styles.sigFooterBtnText, { color: '#fff' }]}>Save Signature</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const sanitizePayload = (data: Record<string, string>): Record<string, any> => {
  const cleaned: Record<string, any> = {};
  Object.entries(data).forEach(([key, val]) => {
    if (val === '-' || val === '' || val === null || val === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = val;
    }
  });
  return cleaned;
};

// ── Field Renderer ─────────────────────────────────────────────────────────────
const renderField = (
  fieldKey: string,
  field: FieldProperty,
  formValues: Record<string, string>,
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  filesByField: Record<string, PhotoFile[]>,
  setFilesByField: React.Dispatch<React.SetStateAction<Record<string, PhotoFile[]>>>,
  required: boolean,
  isMulti: boolean | undefined,
  uploadType: string | undefined,
  gpsCoords: GpsCoords,
  gpsMapLink: string,
  gpsLoading: boolean,
  onRefetchGps: () => void,
  isReadOnly: boolean,               // ✅ ADDED
) => {
  const label = field.title ?? fieldKey;
  const value = formValues[fieldKey] ?? '';

  if (fieldKey === 'Latitude') {
    return (
      <GpsLocationField
        key="gps-location-group"
        label="GPS Geo-Location Coordinates"
        coords={gpsCoords}
        mapLink={gpsMapLink}
        loading={gpsLoading}
        onRefetch={onRefetchGps}
        required={required}
      />
    );
  }
  if (fieldKey === 'Longitude' || fieldKey === 'GPS_Accuracy' || fieldKey === 'Google_Map_Location') {
    return null;
  }

  if (fieldKey === 'Site_Engineer_Signature' || fieldKey === 'Customer_Confirmation_Signature') {
    return (
      <SignatureField
        key={fieldKey}
        label={label}
        value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
      />
    );
  }

  // Date / DateTime fields — e.g. Site_Survey_Completed_Date_Time (date-time),
  // Advance_Paid_Date (date). Driven off field.format, so any new date/date-time
  // field added to the schema gets the picker automatically.
  if (field.format === 'date-time' || field.format === 'date') {
    return (
      <DateTimeField
        key={fieldKey}
        label={label}
        value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
        mode={field.format === 'date-time' ? 'datetime' : 'date'}
        readOnly={isReadOnly}          // ✅ ADDED
      />
    );
  }

  // Multi-file array fields — EB_Bill_Copy, Site_Survey_Photos, and every new
  // "sitePhoto" / "siteVideo" upload field. Driven purely off the schema
  // (type: array, items.format: data-url) so no per-field hardcoding needed.
  if (field.type === 'array' && field.items?.format === 'data-url') {
    const currentFiles = filesByField[fieldKey] ?? [];
    return (
      <PhotoUploadField
        key={fieldKey}
        label={label}
        photoFiles={currentFiles}
        onChange={(files) => setFilesByField((prev) => ({ ...prev, [fieldKey]: files }))}
        required={required}
        selectionLimit={uploadType === 'ebBill' ? 6 : 10}
        namePrefix={fieldKey.toLowerCase()}
        accentColor={colorForUploadType(uploadType)}
        mediaType={uploadType === 'siteVideo' ? 'video' : 'photo'}
      />
    );
  }

  // Single-file data-url fields — Aadhar Card, PAN Card, Passport Photo,
  // Bank Passbook Copy, Advance Payment Screenshot, etc.
  if (field.type === 'string' && field.format === 'data-url') {
    return (
      <DataUrlUploadField
        key={fieldKey}
        label={label}
        value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
        accentColor={colorForUploadType(uploadType)}
      />
    );
  }

  if (field.enum && field.enum.length > 0) {
    return (
      <DropdownPicker
        key={fieldKey} label={label} options={field.enum} value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
        readOnly={isReadOnly}          // ✅ ADDED
      />
    );
  }

  if (field.type === 'object' && field.properties) {
    return (
      <View key={fieldKey} style={styles.groupContainer}>
        <Text style={styles.groupTitle}>{label}</Text>
        {Object.entries(field.properties).map(([subKey, subField]) => {
          const fullKey = `${fieldKey}.${subKey}`;
          return (
            <View key={fullKey} style={{ marginBottom: 10 }}>
              <Text style={styles.label}>{subField.title ?? subKey}</Text>
              <TextInput
                style={styles.input}
                value={formValues[fullKey] ?? ''}
                onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fullKey]: val }))}
                placeholderTextColor="#aaa"
                placeholder={subField.title ?? subKey}
              />
            </View>
          );
        })}
      </View>
    );
  }

  if (isMulti) {
    return (
      <View key={fieldKey} style={styles.fieldContainer}>
        <Text style={styles.label}>
          {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
        </Text>
        <TextInput
          style={[styles.input, styles.textarea, isReadOnly && styles.readOnlyBox]}
          multiline numberOfLines={4} value={value}
          onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
          placeholderTextColor="#aaa" placeholder={label}
          editable={!isReadOnly}       // ✅ ADDED
        />
      </View>
    );
  }

  return (
    <View key={fieldKey} style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, isReadOnly && styles.readOnlyBox]}
        value={value}
        onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        placeholderTextColor="#aaa" placeholder={label}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        editable={!isReadOnly}         // ✅ ADDED
      />
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
const FormScreen = ({
  route, navigation,
}: {
  route: { params: { category: string; lead: Lead; mode?: string } };
  navigation: any;
}) => {
  const { lead, mode } = route.params;
  const isEditMode = mode === 'edit';
  const isMounted = useRef(true);

  const { currentLocation, startTracking } = useLocationTracking(isMounted);
  const typedLocation = currentLocation as LocationCoords | null;

  // Keep a ref in sync with the latest location so the setInterval callback
  // inside fetchGpsLocation always reads the live value instead of a stale
  // snapshot captured when fetchGpsLocation was first called.
  const locationRef = useRef<LocationCoords | null>(null);
  useEffect(() => {
    locationRef.current = typedLocation;
  }, [typedLocation]);

  const [template, setTemplate]                 = useState<Template | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [formValues, setFormValues]             = useState<Record<string, string>>({});
  // Every multi-file (array) upload field keeps its own bucket here, keyed by
  // schema field name — e.g. filesByField.EB_Bill_Copy, filesByField.Roof_Videos.
  const [filesByField, setFilesByField]         = useState<Record<string, PhotoFile[]>>({});
  const [submitting, setSubmitting]             = useState(false);
  const [isOnline, setIsOnline]                 = useState(true);
  const [offlineBanner, setOfflineBanner]       = useState(false);

  const [gpsCoords, setGpsCoords] = useState<GpsCoords>({ latitude: null, longitude: null, accuracy: null });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const gpsMapLink = gpsCoords.latitude != null && gpsCoords.longitude != null
    ? `https://www.google.com/maps?q=${gpsCoords.latitude},${gpsCoords.longitude}`
    : '';

  const fetchGpsLocation = async () => {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required to fetch GPS.');
      return;
    }

    setGpsLoading(true);

    try {
      startTracking();

      let attempts = 0;
      const maxAttempts = 200;

      const checkLocation = setInterval(() => {
        attempts++;

        setGpsCoords((prev) => {
          const liveLocation = locationRef.current;

          if (liveLocation?.latitude != null && liveLocation?.longitude != null) {
            const accuracy = liveLocation.accuracy ?? null;

            setFormValues((prevForm) => ({
              ...prevForm,
              Latitude: String(liveLocation.latitude),
              Longitude: String(liveLocation.longitude),
              GPS_Accuracy: String(accuracy ?? 0),
              Google_Map_Location: `https://www.google.com/maps?q=${liveLocation.latitude},${liveLocation.longitude}`,
            }));

            clearInterval(checkLocation);
            setGpsLoading(false);

            return {
              latitude: liveLocation.latitude,
              longitude: liveLocation.longitude,
              accuracy,
            };
          }

          if (attempts >= maxAttempts) {
  clearInterval(checkLocation);
  setGpsLoading(false);

  // fallback to last cached location instead of hard error
  AsyncStorage.getItem('last_known_location').then((cached) => {
    if (cached) {
      const parsed = JSON.parse(cached);
      setFormValues((prevForm) => ({
        ...prevForm,
        Latitude: String(parsed.latitude),
        Longitude: String(parsed.longitude),
        Google_Map_Location: `https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`,
      }));
      setGpsCoords({ latitude: parsed.latitude, longitude: parsed.longitude, accuracy: null });
      Alert.alert
    } else {
      Alert.alert('GPS Error', 'Could not get accurate GPS location.\nPlease tap "Refetch GPS" button again.');
    }
  });
}
          return prev;
        });
      }, 600);

    } catch (err) {
      console.error("GPS fetch error:", err);
      setGpsLoading(false);
      Alert.alert('GPS Error', 'Something went wrong.');
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchGpsLocation();
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (typedLocation?.latitude != null &&
      typedLocation?.longitude != null &&
      !gpsCoords.latitude) {
      const accuracy = typedLocation.accuracy ?? null;

      setGpsCoords({
        latitude: typedLocation.latitude,
        longitude: typedLocation.longitude,
        accuracy,
      });

      setFormValues((prev) => ({
        ...prev,
        Latitude: String(typedLocation.latitude),
        Longitude: String(typedLocation.longitude),
        GPS_Accuracy: String(accuracy ?? 0),
        Google_Map_Location: `https://www.google.com/maps?q=${typedLocation.latitude},${typedLocation.longitude}`,
      }));
    }
  }, [typedLocation, gpsCoords.latitude]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      setOfflineBanner(!online);
    });
    return () => unsub();
  }, []);

  useEffect(() => { fetchTemplate(); }, []);

useEffect(() => {
    if (!template) return;
    const restoreData = async () => {
      if (isEditMode) {
        try {
          const res = await API.get(`/user/get?mobile=${lead.phone}`);
          const existing = res.data?.data || res.data || {};
          const flattened: Record<string, string> = {};
          const flatten = (obj: any, prefix = '') => {
            Object.entries(obj).forEach(([key, val]) => {
              const fullKey = prefix ? `${prefix}.${key}` : key;
              if (val && typeof val === 'object' && !Array.isArray(val)) {
                flatten(val, fullKey);
              } else {
                const strVal = val != null ? String(val) : '';
flattened[fullKey] = strVal === '-' ? '' : strVal;
              }
            });
          };
          flatten(existing);
console.log('🔎 Flattened existing data:', JSON.stringify(flattened, null, 2));

// dash value scan
Object.entries(flattened).forEach(([k, v]) => {
  if (v === '-' || (typeof v === 'string' && v.startsWith('-') && !/^-?\d/.test(v.slice(1)))) {
    console.log('⚠️ Suspicious dash value found:', k, '=', JSON.stringify(v));
  }
});

setFormValues(flattened);
setOriginalValues(flattened);// ✅ ADD THIS LINE — baseline snapshot
        } catch (err) {
          const draft = await getSavedFormData(lead.id);
          if (draft) {
            setFormValues(draft);
            setOriginalValues(draft); // ✅ ADD THIS LINE — offline draft baseline
          }
        }
      } else {
        const draft = await getSavedFormData(lead.id);
        if (draft) setFormValues(draft);
      }
    };
    restoreData();
  }, [template]);

  useEffect(() => {
    if (Object.keys(formValues).length === 0) return;
    saveFormDataLocally(lead.id, formValues);
  }, [formValues]);

  // ✅ ADDED — auto-calculate Plant_Cost_After_Subsidy (readOnly field) any
  // time Total_Plant_Cost or Subsidy changes, so the value shown/submitted
  // always stays in sync instead of relying on manual entry.
  useEffect(() => {
    const total = parseFloat(formValues.Total_Plant_Cost || '');
    const subsidy = parseFloat(formValues.Subsidy || '');
    if (isNaN(total)) return; // nothing entered yet — leave field as-is

    const safeSubsidy = isNaN(subsidy) ? 0 : subsidy;
    const computed = String(total - safeSubsidy);

    if (formValues.Plant_Cost_After_Subsidy !== computed) {
      setFormValues((prev) => ({ ...prev, Plant_Cost_After_Subsidy: computed }));
    }
  }, [formValues.Total_Plant_Cost, formValues.Subsidy]);

  const fetchTemplate = async () => {
    try {
      // solarv1
      const res = await API.get('/template/get/solarv1');
      const templateData = res.data?.data || res.data?.template || res.data;
      if (!templateData?.schema || !templateData?.uischema) {
        throw new Error('Invalid template structure');
      }
      await cacheTemplate(templateData);
      setTemplate(templateData);
    } catch (err) {
      const cached = await getCachedTemplate();
      if (cached) {
        setTemplate(cached);
        setOfflineBanner(true);
      } else {
        Alert.alert(
          'No Connection',
          'Could not load form. Please connect to the internet at least once to cache the form.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Groups from the current template's uischema (used for both rendering
  // and for building the "visible-only" payload on submit/update).
  const groups = template?.uischema?.elements ?? [];

  // ── Submit (New Form) ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);

    // ✅ ADDED — "Site Survey Completed Date & Time" is auto-stamped with the
    // live current date/time right at submission, instead of relying on a
    // manual picker value. Computed here (not via setFormValues) because the
    // state update below is async and the payload is built synchronously
    // right after — using `nowZoho` directly guarantees the fresh timestamp
    // actually makes it into this submission.
    // ✅ CHANGED — was `new Date().toISOString()` (UTC + "Z" + millis,
    // rejected by Zoho's DateTime field). Now formatted via toZohoDateTime()
    // as local time with a proper "+HH:mm" offset, e.g. 2026-07-13T14:30:00+05:30.
    const nowZoho = toZohoDateTime(new Date());
    const stampedValues = { ...formValues, Site_survey_Completed_Date_Time: nowZoho };
    setFormValues(stampedValues); // keeps on-screen field in sync too

    if (isOnline) {
      try {
        const formData = new FormData();

        // Zoho field mapping removed — raw form field names are sent as-is.
        // The backend now owns all field-name handling / type coercion for Zoho.
        // Only fields currently VISIBLE per the uischema rules are sent, and
        // empty-string values are dropped — this is what stops things like an
        // untouched "Advance_Paid_Date" from reaching Zoho as "".
        const dataPayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          ...buildVisiblePayload(groups, stampedValues),
        };
        console.log('🔍 Clean visible payload:', JSON.stringify(dataPayload, null, 2));
        console.log('🆔 [handleSubmit] leadId (local):', lead.id, '| deal_id (backend):', dataPayload.deal_id);
        formData.append('data', JSON.stringify(dataPayload));

        // ✅ ADDED — quick diagnostic log of estimated file payload size so
        // you can see in the console whether compression is actually
        // bringing things down (helps confirm before/after when testing).
        const totalFilesSizeEstimateMB = Object.values(filesByField).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        console.log(`📦 Total files about to upload: ${totalFilesSizeEstimateMB}`);

        // Append every array-upload field under its own multipart part name.
        Object.entries(filesByField).forEach(([fieldKey, files]) => {
          const partName = multipartFieldName(fieldKey);
          files.forEach((file) => {
            formData.append(partName, {
              uri: file.uri,
              name: file.name,
              type: file.type,
            } as any);
          });
        });

        const totalFiles = Object.values(filesByField).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`📤 Submitting form with ${totalFiles} file(s) across ${Object.keys(filesByField).length} field(s)...`);

        const res = await API.post('/user/add', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000,
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            console.log(`📤 Upload progress: ${percent}%`);
          },
        });

        if (res.status === 201 || res.data?.message) {
          Alert.alert('✔ Submitted', 'Form submitted successfully!', [
            { text: 'OK', onPress: _navigateBack },
          ]);
          setFormValues({});
          setFilesByField({});
        }
      } catch (err: any) {
        console.error('Submit error:', err);
        // ✅ CHANGED — friendlier message specifically for 413, so the
        // surveyor knows to retake with fewer/shorter videos instead of
        // just seeing a generic failure.
        if (err?.response?.status === 413) {
          Alert.alert(
            'Files Too Large',
            'The photos/videos attached are too large to upload. Please remove a video or retake photos, then try again.',
          );
        } else {
          Alert.alert(
            'Error',
            err?.response?.data?.error || err?.message || 'Submit failed. Please try again.',
          );
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        // Zoho field mapping removed — raw form field names are saved/queued as-is.
        // Offline drafts keep the full formValues (including empty fields) so
        // resuming the draft later restores exactly what was on screen; the
        // visible-only cleanup happens at actual submit time (see syncQueue).
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          ...stampedValues, // ✅ CHANGED — was ...formValues, now carries the live completion timestamp
          _filesByField: filesByField,
        };
        console.log('🆔 [handleSubmit/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
        await enqueue(`form_submit_${lead.id}`, 'FORM_SUBMIT', {
          formData: offlinePayload,
          filesByField: filesByField,
          mobile: lead.phone,
        });
        Alert.alert(
          '✔ Saved Offline',
          'Form and photos saved locally. Will be submitted when internet is available.',
          [{ text: 'OK', onPress: _navigateBack }],
        );
        setFormValues({});
        setFilesByField({});
      } catch (e) {
        Alert.alert('Error', 'Failed to save form offline.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // ── Update (Edit Mode) ─────────────────────────────────────────────────────
  const handleUpdate = async () => {
    setSubmitting(true);

    // Only fields that actually changed from the loaded baseline are sent.
    const changedFields: Record<string, string> = {};
Object.entries(formValues).forEach(([key, val]) => {
  if (originalValues[key] !== val) {
    // Skip unchanged base64/signature fields
    if (
      (key === 'Site_Engineer_Signature' || key === 'Customer_Confirmation_Signature') &&
      val === originalValues[key]
    ) return;
    changedFields[key] = val;
  }
});
console.log('✏️ Changed fields (diagnostic only):', JSON.stringify(changedFields, null, 2));

    if (isOnline) {
      try {
        const formData = new FormData();

        // Zoho field mapping removed — raw form field names are sent as-is.
        // buildVisiblePayload drops any changed field that is currently
        // hidden by a uischema rule, and drops empty-string values, so a
        // cleared-then-hidden date/amount field never reaches Zoho as "".
        const updatePayload = {
  id: lead.dealId,
  mobileNumber: lead.phone,
  deal_id: lead.dealId,
  ...buildVisiblePayload(groups, changedFields),   // ✅ CHANGED — was sanitizePayload(changedFields)
};
console.log('🆔 [handleUpdate] leadId (local):', lead.id, '| deal_id (backend):', updatePayload.deal_id);
console.log('📦 updatePayload JSON:', JSON.stringify(updatePayload));
formData.append('data', JSON.stringify(updatePayload));

        // Append every array-upload field under its own multipart part name.
        Object.entries(filesByField).forEach(([fieldKey, files]) => {
          const partName = multipartFieldName(fieldKey);
          files.forEach((file) => {
            formData.append(partName, {
              uri: file.uri,
              name: file.name,
              type: file.type,
            } as any);
          });
        });

        const totalFiles = Object.values(filesByField).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`📤 Updating form with ${totalFiles} file(s) across ${Object.keys(filesByField).length} field(s)...`);

        // ✅ Use BASE_URL instead of hardcoded URL
        const res = await API.put('/user/update', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000,
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            console.log(`📤 Update upload progress: ${percent}%`);
          },
        });

        Alert.alert('✔ Updated', 'Form updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        setFormValues({});
        setFilesByField({});
      } catch (err: any) {
  console.error('Update error:', err);
  console.error('Update error response:', JSON.stringify(err?.response?.data));  // ← ADD THIS
  // ✅ CHANGED — friendlier message specifically for 413.
  if (err?.response?.status === 413) {
    Alert.alert(
      'Files Too Large',
      'The photos/videos attached are too large to upload. Please remove a video or retake photos, then try again.',
    );
  } else {
    Alert.alert(
      'Error',
      err?.response?.data?.error || err?.message || 'Update failed.',
    );
  }
} finally {
        setSubmitting(false);
      }
    } else {
      try {
        // Zoho field mapping removed — raw form field names are saved/queued as-is.
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          ...formValues,
          _filesByField: filesByField,
        };
        console.log('🆔 [handleUpdate/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
        // ✅ Use BASE_URL instead of hardcoded URL
        await enqueue(`form_update_${lead.id}`, 'FORM_UPDATE', {
  formData: offlinePayload,
  filesByField: filesByField,
  mobile: lead.phone,
  url: '/user/update',
});
        Alert.alert(
          '✔ Saved Offline',
          'Update saved locally with photos. Will be synced when online.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        setFormValues({});
        setFilesByField({});
      } catch (e) {
        Alert.alert('Error', 'Failed to save update offline.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const _navigateBack = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Surveyerscreen' },
        {
          name: 'InProgress',
          params: {
            lead: { ...lead, manualSiteEnabled: true },
            completedLeadId: null,
            formSubmittedLeadId: lead.id,
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ED1C25" />
        <Text style={{ marginTop: 10, color: '#888' }}>Loading form...</Text>
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color="#ccc" />
        <Text style={{ color: '#888', marginTop: 12, textAlign: 'center', paddingHorizontal: 30 }}>
          Form template not available.{'\n'}Please connect to internet once to load the form.
        </Text>
      </View>
    );
  }

  const properties     = template.schema?.properties ?? {};
  const requiredFields = template.schema?.required ?? [];

  return (
    <View style={{ flex: 1 }}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Edit Observation' : 'Site Observation'}
          </Text>
          <Text style={styles.subTitle}>{lead.name} | {lead.phone}</Text>
        </View>
        {isEditMode && (
          <View style={styles.editBadge}>
            <Ionicons name="create-outline" size={12} color="#fff" />
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        )}
      </View>

      {offlineBanner && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.offlineBannerText}>
            You're offline — form will be submitted when connected
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F5F5F5' }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>{group.label}</Text>
            </View>
            {(group.elements ?? []).map((element) => {
              const fieldKey   = element.scope?.split('/').pop() ?? '';
              const field      = properties[fieldKey];
              if (!field) return null;

              // uischema "rule": SHOW/HIDE — skip rendering (and thus
              // collecting) fields that aren't currently applicable, e.g.
              // Advance_Paid_Date when Advance_payment_Received is false.
              if (!isFieldVisible(element, formValues)) return null;

              const isRequired = requiredFields.includes(fieldKey);
              const isMulti    = element.options?.multi === true;
              const uploadType = element.options?.uploadType;
              const isReadOnly = element.options?.readOnly === true; // ✅ ADDED
              return renderField(
                fieldKey,
                field,
                formValues,
                setFormValues,
                filesByField,
                setFilesByField,
                isRequired,
                isMulti,
                uploadType,
                gpsCoords,
                gpsMapLink,
                gpsLoading,
                fetchGpsLocation,
                isReadOnly,           // ✅ ADDED
              );
            })}
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            submitting && { opacity: 0.7 },
            !isOnline && styles.submitBtnOffline,
            isEditMode && styles.submitBtnEdit,
          ]}
          onPress={isEditMode ? handleUpdate : handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={isEditMode ? 'save-outline' : isOnline ? 'cloud-upload-outline' : 'save-outline'}
                size={18} color="#fff"
              />
              <Text style={styles.submitBtnText}>
                {isEditMode
                  ? isOnline ? 'Update Form' : 'Save Update Offline'
                  : isOnline ? 'Submit Form' : 'Save Offline'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default FormScreen;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#ED1C25', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  subTitle: { fontSize: 12, color: '#ffcccc', marginTop: 2 },
  editBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  editBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  offlineBanner: {
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 20, paddingBottom: 8,
  },
  sectionDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#ED1C25', marginRight: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  groupContainer: {
    backgroundColor: '#fff', marginHorizontal: 15,
    marginBottom: 12, borderRadius: 10, padding: 14, elevation: 2,
  },
  groupTitle: { fontSize: 13, fontWeight: 'bold', color: '#ED1C25', marginBottom: 10 },
  fieldContainer: {
    backgroundColor: '#fff', marginHorizontal: 15,
    marginBottom: 10, borderRadius: 10, padding: 14, elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa',
  },
  // ✅ ADDED — visually distinct style for readOnly / auto-filled fields
  readOnlyBox: {
    backgroundColor: '#eef1f4', borderColor: '#dbe0e5', opacity: 0.85,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  dropdownBtn: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, backgroundColor: '#fafafa',
    flexDirection: 'row', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 12, padding: 16, maxHeight: '60%', elevation: 10,
  },
  dropdownModalTitle: {
    fontSize: 15, fontWeight: 'bold', color: '#333',
    marginBottom: 12, textAlign: 'center',
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  submitBtn: {
    backgroundColor: '#ED1C25', marginHorizontal: 15,
    marginTop: 16, paddingVertical: 15, borderRadius: 10,
    alignItems: 'center', elevation: 4,
  },
  submitBtnOffline: { backgroundColor: '#f97316' },
  submitBtnEdit: { backgroundColor: '#3b82f6' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  signaturePreview: {
    width: '100%', height: 130, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff',
  },
  sigActionBtn: {
    flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff',
  },
  sigActionBtnText: { fontWeight: '700', fontSize: 13 },
  sigSmallBtn: {
    borderWidth: 1.5, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff',
  },
  sigSmallBtnText: { fontWeight: '700', fontSize: 12 },
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
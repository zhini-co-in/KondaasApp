import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TextInput, TouchableOpacity, Alert, Modal, FlatList, Image,
  PermissionsAndroid, Platform, Keyboard,
} from 'react-native';
import API from '../api/api1';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useLocationTracking, requestLocationPermissions } from '../service/locationService';
import {
  cacheTemplate, getCachedTemplate,
  saveFormDataLocally, getSavedFormData,
  deleteSavedFormData,
} from '../service/Localleadsstorage';
import { enqueue } from '../service/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import SignatureScreen from 'react-native-signature-canvas';
import ImageResizer from 'react-native-image-resizer';
import DateTimePicker from '@react-native-community/datetimepicker';
import KondaasPaymentQR from '../../assets/images/kondaas_payment_qr.png';

interface FieldProperty {
  title?: string; description?: string; type?: string;
  enum?: string[]; properties?: Record<string, FieldProperty>; format?: string;
  items?: { type?: string; format?: string };
  pattern?: string; minLength?: number; maxLength?: number;
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
  // readOnly — lets uischema mark a field (e.g. Report_Number,
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
const colorForUploadType = (uploadType?: string): string => {
  switch (uploadType) {
    case 'ebBill': return '#22c55e';
    case 'siteSurvey': return '#3b82f6';
    case 'sitePhoto': return '#f59e0b';
    case 'siteVideo': return '#8b5cf6';
    default: return '#64748b';
  }
};

const multipartFieldName = (fieldKey: string): string => fieldKey;

// Fields that must ALWAYS be sent as text/string to Zoho, even though their
// values look numeric (leading zeros, fixed-length codes, IDs, etc). These
// are deliberately excluded from the number coercion below.
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

// ── Coerce string form values back to their schema type before sending ─────
// The form UI stores every value as a string in `formValues` (that's what
// lets TextInput / dropdowns work uniformly and is why the keyboard/typing
// behaviour never needs to change). But Zoho's schema marks many of these
// fields as `type: "number"` (Connected_Load, Inverter_Capacity,
// No_of_Panels, Total_Plant_Cost, Subsidy, AC_Cable, etc). If we send them
// as strings, Zoho either rejects them or stores them as text instead of a
// numeric field.
//
// This function walks the OUTGOING payload only (never touches formValues,
// never touches the TextInput/keyboardType rendering) and converts any key
// whose schema type is "number" into an actual JS number — except fields
// explicitly listed in ZOHO_TEXT_FIELDS, which must stay text (e.g.
// Consumer_Number / Zip_Postal_Code can have leading zeros that a number
// would silently strip).
const coerceSchemaTypes = (
  payload: Record<string, any>,
  properties: SchemaProperties,
): Record<string, any> => {
  const coerced: Record<string, any> = { ...payload };

  Object.entries(coerced).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    if (ZOHO_TEXT_FIELDS.includes(key)) return; // force-kept as text

    const fieldDef = properties[key];
    if (fieldDef?.type === 'number' && typeof val === 'string') {
      const num = Number(val);
      if (!Number.isNaN(num)) {
        coerced[key] = num;
      }
      // if it doesn't parse cleanly, leave the original string in place
      // rather than silently dropping the field — validation earlier in
      // the flow should have already caught truly empty/invalid values.
    }
  });

  return coerced;
};

const toZohoDateTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offM = pad(Math.abs(offsetMin) % 60);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
};

const buildPrefillFromLead = (leadData: Lead & Record<string, any>): Record<string, string> => {
  const prefill: Record<string, string> = {};
  const set = (key: string, val: any) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      prefill[key] = String(val);
    }
  };

  set('Deal_Name', leadData.name);
  set('Mobile_Number', leadData.phone);
  set('Phone_Number', leadData.phone);
  set('WhatsApp_Number', leadData.whatsappNo);
  set('Lead_Source', leadData.leadSource);
  set('Referred_By', leadData.referredBy);
  set('Site_Survey_Assigned_By', leadData.siteSurveyAssignedBy);
  set('State_Province', leadData.state);
  set('District', leadData.District);
  set('Sub_District', leadData.subDistrict);
  set('City', leadData.city);
  set('Street_Address', leadData.street);
  set('Order_Type', leadData.orderType);
  set('Project_Under', leadData.projectType);   // backend key is "projectType", value holds "Hybrid Subsidy" etc.
  set('Product_Type', leadData.productType);
  set('Inverter_Connection_Type', leadData.inverterConnectionType);
  set('Inverter_Capacity', leadData.inverterCapacity);
  set('Solar_Panel_Model', leadData.solarPanelModel);
  set('Solar_Panel_Brand', leadData.solarPanelBrand);
  set('No_of_Panels', leadData.noOfPanels);
  set('Roof_Type', leadData.roofType);
  set('Country_Region', leadData.country);
  set('Zip_Postal_Code', leadData.zipCode);      // backend key is "zipCode", not "Code"

  return prefill;
};

const getMySurveyorNumber = async (): Promise<string> => {
  try {
    const userData = await AsyncStorage.getItem(USER_DATA);
    const parsed = userData ? JSON.parse(userData) : null;
    return parsed?.UserInfo?.phoneNo || '';
  } catch {
    return '';
  }
};

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
    const isRuleControlled = groups.some((group) =>
      (group.elements ?? []).some((el) => el.scope?.split('/').pop() === key && el.rule)
    );
    if (isRuleControlled && !visibleKeys.has(key)) return;
    if (val === '' || val === null || val === undefined) return;
    cleaned[key] = val;
  });
  return cleaned;
};

const validateRequiredFields = (
  properties: SchemaProperties,
  requiredFields: string[],
  groups: UIElement[],
  formValues: Record<string, string>,
  filesByField: Record<string, PhotoFile[]>,
): string[] => {
  const missing: string[] = [];
  const seen = new Set<string>();

  groups.forEach((group) => {
    (group.elements ?? []).forEach((element) => {
      const fieldKey = element.scope?.split('/').pop();
      if (!fieldKey) return;
      if (!requiredFields.includes(fieldKey)) return;
      if (seen.has(fieldKey)) return;
      if (!isFieldVisible(element, formValues)) return;

      const field = properties[fieldKey];
      const label = field?.title ?? fieldKey;

      // Photo / video fields (data-url arrays) — mandatory means at least
      // one file must be attached. This covers all Site Survey Photos,
      // Roof_Videos, Roof_Surround_Videos, and document uploads (Aadhar,
      // PAN, Bank Passbook, etc) since they're all schema type "array"
      // with items format "data-url".
      if (field?.type === 'array' && field.items?.format === 'data-url') {
        const files = filesByField[fieldKey] ?? [];
        if (files.length === 0) {
          missing.push(label);
          seen.add(fieldKey);
        }
        return;
      }

      const val = formValues[fieldKey];
      if (val === undefined || val === null || String(val).trim() === '') {
        missing.push(label);
        seen.add(fieldKey);
      }
    });
  });

  return missing;
};
interface FieldTypeError {
  label: string;
  reason: string;
}

const validateSchemaTypes = (
  properties: SchemaProperties,
  groups: UIElement[],
  formValues: Record<string, string>,
  filesByField: Record<string, PhotoFile[]>,
): FieldTypeError[] => {
  const errors: FieldTypeError[] = [];
  const seen = new Set<string>();

  groups.forEach((group) => {
    (group.elements ?? []).forEach((element) => {
      const fieldKey = element.scope?.split('/').pop();
      if (!fieldKey || seen.has(fieldKey)) return;
      if (!isFieldVisible(element, formValues)) return;
      const field = properties[fieldKey];
      if (!field) return;
      const label = field.title ?? fieldKey;
      const val = formValues[fieldKey];
      const isEmpty = val === undefined || val === null || String(val).trim() === '';

      if (field.type === 'number' && !isEmpty) {
        if (Number.isNaN(Number(val)) || val.trim() === '-' || val.trim() === '.') {
          errors.push({ label, reason: 'Must be a valid number' });
          seen.add(fieldKey);
          return;
        }
      }

      if (field.type === 'string' && field.pattern && !isEmpty) {
        const re = new RegExp(field.pattern);
        if (!re.test(val)) {
          errors.push({ label, reason: 'Format is invalid (e.g. phone: 10 digits, zip: 6 digits)' });
          seen.add(fieldKey);
          return;
        }
      }

      if (field.type === 'string' && !isEmpty) {
        if (field.minLength && val.length < field.minLength) {
          errors.push({ label, reason: `Must be at least ${field.minLength} characters` });
          seen.add(fieldKey);
          return;
        }
        if (field.maxLength && val.length > field.maxLength) {
          errors.push({ label, reason: `Must be at most ${field.maxLength} characters` });
          seen.add(fieldKey);
          return;
        }
      }

      if (field.enum && field.enum.length > 0 && !isEmpty) {
        if (!field.enum.includes(val)) {
          errors.push({ label, reason: 'Value is not one of the allowed options' });
          seen.add(fieldKey);
          return;
        }
      }

      if ((field.format === 'date' || field.format === 'date-time') && !isEmpty) {
        if (Number.isNaN(new Date(val).getTime())) {
          errors.push({ label, reason: 'Invalid date/date-time format' });
          seen.add(fieldKey);
          return;
        }
      }

      if (field.type === 'string' && field.format === 'data-url' && !isEmpty) {
        if (!val.startsWith('data:')) {
          errors.push({ label, reason: 'Invalid image/signature data' });
          seen.add(fieldKey);
          return;
        }
      }

      if (field.type === 'array' && field.items?.format === 'data-url') {
        const files = filesByField[fieldKey] ?? [];
        const badFile = files.find((f) => !f.uri || !f.type);
        if (badFile) {
          errors.push({ label, reason: 'One of the attached files is corrupt — please re-attach it' });
          seen.add(fieldKey);
        }
      }
    });
  });

  return errors;
};

// ── Network failure detection ───────────────────────────────────────────────
// Distinguishes a genuine connectivity drop (no response received,
// timeout, DNS/socket failure) from a real server-side error (4xx/5xx with a
// response). Used to auto-fallback into the offline save + sync queue flow
// instead of just showing a dead-end "Network Error" alert.
const isNetworkFailure = (err: any): boolean => {
  if (!err?.response) return true;          // axios: no response received at all
  if (err?.message === 'Network Error') return true;
  if (err?.code === 'ECONNABORTED') return true; // timeout
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// ── Keyboard / input restriction helper ─────────────────────────────────────
// Restricts the mobile keyboard shown AND live-sanitizes every keystroke
// based on the field's actual schema type/pattern, so users physically
// cannot type the wrong kind of character into a field (letters in a phone
// number, symbols in a numeric field, more than 6 digits in a postal code,
// etc). This only affects what CAN be typed — it never changes what gets
// sent over the wire (coerceSchemaTypes / enforceZohoTextFields still
// handle that separately).
// ─────────────────────────────────────────────────────────────────────────────
type KeyboardTypeOption =
  | 'default' | 'numeric' | 'number-pad' | 'decimal-pad'
  | 'phone-pad' | 'email-address' | 'url';

interface InputRestriction {
  keyboardType: KeyboardTypeOption;
  sanitize: (text: string) => string;
  maxLength?: number;
}

// Fields that are logically phone numbers even though a couple of them
// (Site_Engineer_Contact) don't literally end in "_Number".
const PHONE_FIELD_KEYS = [
  'Mobile_Number',
  'Phone_Number',
  'WhatsApp_Number',
  'Site_Engineer_Contact',
  'EB_Section_Office_Contact_Number',
  'Co_Applicant_Mobile_Number',
];

// Strips everything except digits, keeping only a single LEADING '+' if present.
const sanitizePhone = (text: string): string => {
  const hasLeadingPlus = text.trim().startsWith('+');
  const digitsOnly = text.replace(/[^0-9]/g, '');
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
};

// Strips everything except digits (for pure numeric-string fields like
// Zip_Postal_Code / Consumer_Number that must stay type "string" on the
// wire but should never accept letters/symbols from the keyboard).
const sanitizeDigitsOnly = (text: string): string => text.replace(/[^0-9]/g, '');

// Strips everything except digits, a single leading '-' and a single '.'
// (for true schema type "number" fields — quantities, currency, capacities).
const sanitizeDecimal = (text: string): string => {
  const hasLeadingMinus = text.trim().startsWith('-');
  let cleaned = text.replace(/[^0-9.]/g, '');
  // collapse to a single decimal point
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return hasLeadingMinus ? `-${cleaned}` : cleaned;
};

// Strips everything except letters, spaces and common name punctuation
// (apostrophe, period, hyphen) — used for pure "Name" fields so digits
// typed via the keyboard's 123/symbols page get silently rejected.
const sanitizeAlpha = (text: string): string => text.replace(/[^a-zA-Z\s.'-]/g, '');

const getInputRestriction = (
  fieldKey: string,
  field: FieldProperty,
): InputRestriction => {
  // 1) True numeric schema fields (Connected_Load, Inverter_Capacity,
  //    No_of_Panels, Total_Plant_Cost, Subsidy, AC/DC/Earthing/LA/UG Cable,
  //    Advanced_Paid, Additional_Structure_Cost, Additional_EB_Charges, etc)
  if (field.type === 'number') {
    return {
      keyboardType: Platform.OS === 'ios' ? 'decimal-pad' : 'numeric',
      sanitize: sanitizeDecimal,
    };
  }

  // 2) Phone-style fields — digits (+ optional leading '+'), capped at 15
  //    digits to match the schema pattern ^\+?[0-9]{10,15}$.
  if (PHONE_FIELD_KEYS.includes(fieldKey)) {
    return {
      keyboardType: 'phone-pad',
      sanitize: sanitizePhone,
      maxLength: 16, // 15 digits + optional leading '+'
    };
  }

  // 3) Postal code — exactly 6 digits, kept as a STRING on the wire
  //    (see ZOHO_TEXT_FIELDS) but the keyboard should still be numeric-only.
  if (fieldKey === 'Zip_Postal_Code') {
    return {
      keyboardType: 'number-pad',
      sanitize: sanitizeDigitsOnly,
      maxLength: 6,
    };
  }

  // 4) Consumer number — digits only, but forced to stay a string
  //    (leading zeros must survive) so we restrict the keyboard without
  //    touching its schema type.
  if (fieldKey === 'Consumer_Number') {
    return {
      keyboardType: 'number-pad',
      sanitize: sanitizeDigitsOnly,
    };
  }

  // 5) Pure "Name" fields (Deal_Name, Consumer_Name, etc) — letters/spaces
  //    only. Digits and symbols typed via the keyboard's 123/symbols page
  //    get silently stripped, so numbers can never end up in a Name field.
  if (/name/i.test(fieldKey) || /name/i.test(field.title ?? '')) {
    return {
      keyboardType: 'default',
      sanitize: sanitizeAlpha,
    };
  }

  // 6) Email fields, if any ever get rendered through the plain text path.
  if (field.format === 'email' || /email/i.test(fieldKey)) {
    return {
      keyboardType: 'email-address',
      sanitize: (t: string) => t.trim(),
    };
  }

  // 7) URL fields (Google_Map_Location etc).
  if (field.format === 'uri') {
    return {
      keyboardType: 'url',
      sanitize: (t: string) => t.trim(),
    };
  }

  // 8) Default — free text, no restriction.
  return {
    keyboardType: 'default',
    sanitize: (t: string) => t,
  };
};

// Tracks which keyboardType was last actively focused, across ALL fields
// on this screen. Deliberately a plain module-level variable (not React
// state) — it doesn't need to trigger a re-render, it only needs to be
// readable/writable from every FieldRenderer instance so we can detect
// "the previous field used a different keyboard type than this one".
let globalActiveKeyboardType: KeyboardTypeOption = 'default';

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
    if (readOnly) return;
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
      onChange(formatDateOnly(selected));
      return;
    }

    if (Platform.OS === 'ios') {
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

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const getFileSizeInBytes = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (err) {
    console.warn('⚠️ Could not determine file size for', uri, err);
    return 0;
  }
};

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
    const rejectedForSize: string[] = [];

    const results = await Promise.all(
      valid.map(async (asset) => {
        const finalUri = isVideo
          ? asset.uri
          : await compressImage(asset.uri);

        const displayName = asset.fileName ?? asset.uri?.split('/').pop() ?? `${namePrefix}_${Date.now()}`;

        if (isVideo) {
          const sizeBytes = await getFileSizeInBytes(finalUri);
          if (sizeBytes > MAX_VIDEO_SIZE_BYTES) {
            const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
            console.warn(`⚠️ Rejected video "${displayName}" — ${sizeMB} MB exceeds 50 MB limit`);
            rejectedForSize.push(`${displayName} (${sizeMB} MB)`);
            return null;
          }
        }

        const ext = isVideo ? 'mp4' : 'jpg';
        return {
          uri: finalUri,
          name: asset.fileName ?? asset.uri?.split('/').pop() ?? `${namePrefix}_${Date.now()}.${ext}`,
          type: isVideo ? (asset.type ?? 'video/mp4') : 'image/jpeg',
        };
      })
    );

    if (rejectedForSize.length > 0) {
      Alert.alert(
        'Video Too Large',
        `The following video(s) exceed the 50 MB limit and were NOT added:\n\n${rejectedForSize.join('\n')}\n\nPlease record a shorter clip or trim the video and try again.`,
      );
    }

    return results.filter((r): r is PhotoFile => r !== null);
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

      {isVideo && (
        <Text style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
          Maximum upload size: 50 MB per video
        </Text>
      )}

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
        quality: 0.3,
        maxWidth: 800,
        maxHeight: 800,
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
    onChange(signature);
    setDrawVisible(false);
  };

  const handleUpload = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.3,
        maxWidth: 800,
        maxHeight: 800,
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

// ── Field Renderer (memoized component — module level, NOT inside JSX) ────────
interface FieldRendererProps {
  fieldKey: string;
  field: FieldProperty;
  value: string;
  onChange: (val: string) => void;
  filesByField: Record<string, PhotoFile[]>;
  setFilesByField: React.Dispatch<React.SetStateAction<Record<string, PhotoFile[]>>>;
  required: boolean;
  isMulti: boolean | undefined;
  uploadType: string | undefined;
  gpsCoords: GpsCoords;
  gpsMapLink: string;
  gpsLoading: boolean;
  onRefetchGps: () => void;
  isReadOnly: boolean;
  onChangeObjectField: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const FieldRenderer = React.memo(({
  fieldKey, field, value, onChange, filesByField, setFilesByField,
  required, isMulti, uploadType, gpsCoords, gpsMapLink, gpsLoading,
  onRefetchGps, isReadOnly, onChangeObjectField,
}: FieldRendererProps) => {
  const label = field.title ?? fieldKey;

  if (fieldKey === 'Latitude') {
    return (
      <GpsLocationField
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
    return <SignatureField label={label} value={value} onChange={onChange} required={required} />;
  }

  if (field.format === 'date-time' || field.format === 'date') {
    return (
      <DateTimeField
        label={label} value={value} onChange={onChange} required={required}
        mode={field.format === 'date-time' ? 'datetime' : 'date'}
        readOnly={isReadOnly}
      />
    );
  }

  if (field.type === 'array' && field.items?.format === 'data-url') {
    const currentFiles = filesByField[fieldKey] ?? [];
    return (
      <PhotoUploadField
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

  if (field.type === 'string' && field.format === 'data-url') {
    return (
      <DataUrlUploadField
        label={label} value={value} onChange={onChange} required={required}
        accentColor={colorForUploadType(uploadType)}
      />
    );
  }

  if (field.enum && field.enum.length > 0) {
    return (
      <DropdownPicker
        label={label} options={field.enum} value={value}
        onChange={onChange} required={required} readOnly={isReadOnly}
      />
    );
  }

  if (field.type === 'object' && field.properties) {
    return (
      <View style={styles.groupContainer}>
        <Text style={styles.groupTitle}>{label}</Text>
        {Object.entries(field.properties).map(([subKey, subField]) => {
          const fullKey = `${fieldKey}.${subKey}`;
          const restriction = getInputRestriction(subKey, subField);
          return (
            <View key={fullKey} style={{ marginBottom: 10 }}>
              <Text style={styles.label}>{subField.title ?? subKey}</Text>
              <TextInput
                style={styles.input}
                onChangeText={(val) =>
                  onChangeObjectField((prev) => ({ ...prev, [fullKey]: restriction.sanitize(val) }))
                }
                placeholderTextColor="#aaa"
                placeholder={subField.title ?? subKey}
                keyboardType={restriction.keyboardType}
                maxLength={restriction.maxLength}
              />
            </View>
          );
        })}
      </View>
    );
  }

  // ── Restricted keyboard + live sanitization based on schema type ──────────
  const inputRestriction = getInputRestriction(fieldKey, field);
  const handleRestrictedChange = (val: string) => {
    onChange(inputRestriction.sanitize(val));
  };

  const textInputRef = useRef<TextInput>(null);

  // Android's soft keyboard (Gboard especially) sometimes keeps showing the
  // PREVIOUS field's page (e.g. numbers/symbols from Consumer Number) even
  // after focus moves to a field whose keyboardType is 'default' — the IME
  // isn't always restarted just because keyboardType prop differs. Detect
  // that on focus and force a full dismiss + refocus so Android re-reads
  // the correct keyboard type for THIS field.
  const handleRestrictedFocus = () => {
    const nextType = inputRestriction.keyboardType;
    if (globalActiveKeyboardType !== nextType) {
      Keyboard.dismiss();
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 60);
    }
    globalActiveKeyboardType = nextType;
  };

  if (isMulti) {
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}</Text>
        <TextInput
          ref={textInputRef}
          style={[styles.input, styles.textarea, isReadOnly && styles.readOnlyBox]}
          multiline numberOfLines={4} value={value}
          onChangeText={handleRestrictedChange}
          onFocus={handleRestrictedFocus}
          placeholderTextColor="#aaa" placeholder={label}
          editable={!isReadOnly}
          keyboardType={inputRestriction.keyboardType}
          maxLength={inputRestriction.maxLength}
        />
      </View>
    );
  }

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}</Text>
      <TextInput
        ref={textInputRef}
        style={[styles.input, isReadOnly && styles.readOnlyBox]}
        value={value}
        onChangeText={handleRestrictedChange}
        onFocus={handleRestrictedFocus}
        placeholderTextColor="#aaa" placeholder={label}
        keyboardType={inputRestriction.keyboardType}
        maxLength={inputRestriction.maxLength}
        editable={!isReadOnly}
      />
    </View>
  );
});

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

  const locationRef = useRef<LocationCoords | null>(null);
  useEffect(() => {
    locationRef.current = typedLocation;
  }, [typedLocation]);

  const [template, setTemplate]                 = useState<Template | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [formValues, setFormValues]             = useState<Record<string, string>>({});
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

  // Real connectivity probe. `isOnline` (from NetInfo listener) can be a
  // false positive on some devices (Wi-Fi connected but no actual internet
  // route), so we re-check right before a submit/update attempt.
  const checkRealConnectivity = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      return !!state.isConnected && state.isInternetReachable !== false;
    } catch {
      return false;
    }
  };

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
    const online = !!state.isConnected && state.isInternetReachable !== false;  // 👈 permissive
    setIsOnline(online);
    setOfflineBanner(!online);
  });
  return () => unsub();
}, []);

  useEffect(() => { fetchTemplate(); }, []);

  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!template) return;
    const restoreData = async () => {
      console.log('🟢 restoreData called, isEditMode:', isEditMode, 'lead:', JSON.stringify(lead));
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

          Object.entries(flattened).forEach(([k, v]) => {
            if (v === '-' || (typeof v === 'string' && v.startsWith('-') && !/^-?\d/.test(v.slice(1)))) {
              console.log('⚠️ Suspicious dash value found:', k, '=', JSON.stringify(v));
            }
          });

          setFormValues(flattened);
          setOriginalValues(flattened);
        } catch (err) {
          const draft = await getSavedFormData(lead.id);
          if (draft) {
            setFormValues((prev) => ({ ...prev, ...draft }));
            setOriginalValues(draft);
          }
        }
      } else {
        const draft = await getSavedFormData(lead.id);
        const prefill = buildPrefillFromLead(lead);
        const isDraftUsable = draft && draft.Deal_Name;
        setFormValues((prev) => ({
          ...prev,
          ...prefill,
          ...(isDraftUsable ? draft : {}),
        }));
      }
      hasRestoredRef.current = true;
      console.log('🟡 restoreData FINISHED');
    };
    restoreData();
  }, [template]);

  useEffect(() => {
    if (isEditMode) return;
    (async () => {
      const myNumber = await getMySurveyorNumber();
      if (myNumber) {
        setFormValues((prev) =>
          prev.Site_Engineer_Contact ? prev : { ...prev, Site_Engineer_Contact: myNumber }
        );
      }
    })();
  }, [isEditMode]);

  // Per-field stable onChange handlers, created ONCE per fieldKey.
  const fieldChangeHandlersRef = useRef<Record<string, (val: string) => void>>({});
  const getFieldChangeHandler = (fieldKey: string) => {
    if (!fieldChangeHandlersRef.current[fieldKey]) {
      fieldChangeHandlersRef.current[fieldKey] = (val: string) => {
        setFormValues((prev) => ({ ...prev, [fieldKey]: val }));
      };
    }
    return fieldChangeHandlersRef.current[fieldKey];
  };

  // Debounced auto-save.
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasRestoredRef.current) return;
    if (Object.keys(formValues).length === 0) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveFormDataLocally(lead.id, formValues);
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formValues]);

  useEffect(() => {
    const total = parseFloat(formValues.Total_Plant_Cost || '');
    const subsidy = parseFloat(formValues.Subsidy || '');
    if (isNaN(total)) return;

    const safeSubsidy = isNaN(subsidy) ? 0 : subsidy;
    const computed = String(total - safeSubsidy);

    if (formValues.Plant_Cost_After_Subsidy !== computed) {
      setFormValues((prev) => ({ ...prev, Plant_Cost_After_Subsidy: computed }));
    }
  }, [formValues.Total_Plant_Cost, formValues.Subsidy]);

  const fetchTemplate = async () => {
    try {
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

  const groups = template?.uischema?.elements ?? [];
  const schemaProperties = template?.schema?.properties ?? {};
  const schemaRequiredFields = template?.schema?.required ?? [];

  // ── Submit (New Form) ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const missingFields = validateRequiredFields(
      schemaProperties, schemaRequiredFields, groups, formValues, filesByField,
    );
    if (missingFields.length > 0) {
      Alert.alert(
        'Required Fields Missing',
        `Please fill in the following before submitting:\n\n${missingFields.join('\n')}`,
      );
      return;
    }
     const typeErrors = validateSchemaTypes(schemaProperties, groups, formValues, filesByField);
    if (typeErrors.length > 0) {
      Alert.alert(
        'Check These Fields',
        typeErrors.map((e) => `• ${e.label}: ${e.reason}`).join('\n'),
      );
      return;
    }

    setSubmitting(true);

    const nowZoho = toZohoDateTime(new Date());
    const stampedValues = { ...formValues, Site_survey_Completed_Date_Time: nowZoho };
    setFormValues(stampedValues);

    // Re-verify connectivity right before attempting the network call,
    // instead of trusting the possibly-stale `isOnline` state.
    const reallyOnline = await checkRealConnectivity();

    if (reallyOnline) {
      try {
        const formData = new FormData();

        // ✅ FIX: buildVisiblePayload gives us the correct visible fields
        // as strings (matches formValues typing) — coerceSchemaTypes then
        // converts anything whose schema type is "number" into an actual
        // number before it goes over the wire. Keyboard/typing UX is
        // completely untouched; only the outgoing payload types change.
        const visiblePayload = buildVisiblePayload(groups, stampedValues);
        const typedPayload = coerceSchemaTypes(visiblePayload, schemaProperties);
        const dataPayload = enforceZohoTextFields({
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          state: lead.state,
          ...typedPayload,
        });

        console.log('🔍 Clean visible payload:', JSON.stringify(dataPayload, null, 2));
        console.log('🆔 [handleSubmit] leadId (local):', lead.id, '| deal_id (backend):', dataPayload.deal_id);
        formData.append('data', JSON.stringify(dataPayload));

        const totalFilesSizeEstimateMB = Object.values(filesByField).reduce(
          (sum, arr) => sum + arr.length,
          0
        );
        console.log(`📦 Total files about to upload: ${totalFilesSizeEstimateMB}`);

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

        // Network drop mid-upload: fall back to offline save + sync queue
        // instead of showing a dead-end "Network Error" alert.
        if (isNetworkFailure(err)) {
          try {
            const offlinePayload = {
              mobileNumber: lead.phone,
              deal_id: lead.dealId,
              state: lead.state,
              ...stampedValues,
              _filesByField: filesByField,
            };
            console.log('🆔 [handleSubmit/network-fallback] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
            await saveFormDataLocally(lead.id, offlinePayload);
            await enqueue(`form_submit_${lead.id}`, 'FORM_SUBMIT', {
              formData: offlinePayload,
              filesByField: filesByField,
              mobile: lead.phone,
              leadId: lead.id,
            });
            Alert.alert(
              '⚠ Network Issue',
              'Connection dropped mid-upload. Your form & photos are saved locally and will auto-submit once internet is stable.',
              [{ text: 'OK', onPress: _navigateBack }],
            );
            setFormValues({});
            setFilesByField({});
          } catch (offlineErr) {
            console.error('Offline fallback save failed:', offlineErr);
            Alert.alert(
              'Error',
              'Network failed AND could not save offline. Please screenshot this form and contact support.',
            );
          }
        } else if (err?.response?.status === 413) {
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
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          state: lead.state,
          ...stampedValues,
          _filesByField: filesByField,
        };
        console.log('🆔 [handleSubmit/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
        await enqueue(`form_submit_${lead.id}`, 'FORM_SUBMIT', {
          formData: offlinePayload,
          filesByField: filesByField,
          mobile: lead.phone,
          leadId: lead.id,
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
    const missingFields = validateRequiredFields(
      schemaProperties, schemaRequiredFields, groups, formValues, filesByField,
    );
    if (missingFields.length > 0) {
      Alert.alert(
        'Required Fields Missing',
        `Please fill in the following before updating:\n\n${missingFields.join('\n')}`,
      );
      return;
    }
    const typeErrors = validateSchemaTypes(schemaProperties, groups, formValues, filesByField);
    if (typeErrors.length > 0) {
      Alert.alert(
        'Check These Fields',
        typeErrors.map((e) => `• ${e.label}: ${e.reason}`).join('\n'),
      );
      return;
    }

    setSubmitting(true);

    const changedFields: Record<string, string> = {};
    Object.entries(formValues).forEach(([key, val]) => {
      if (originalValues[key] !== val) {
        if (
          (key === 'Site_Engineer_Signature' || key === 'Customer_Confirmation_Signature') &&
          val === originalValues[key]
        ) return;
        changedFields[key] = val;
      }
    });
    console.log('✏️ Changed fields (diagnostic only):', JSON.stringify(changedFields, null, 2));

    // Real connectivity re-check before attempting update.
    const reallyOnline = await checkRealConnectivity();

    if (reallyOnline) {
      try {
        const formData = new FormData();

        // ✅ FIX: same coercion applied on update — only changed, visible
        // fields go out, and anything schema-typed "number" is sent as a
        // real number instead of a string.
        const visibleChanged = buildVisiblePayload(groups, changedFields);
        const typedChanged = coerceSchemaTypes(visibleChanged, schemaProperties);
        const updatePayload = enforceZohoTextFields({
          id: lead.dealId,
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          state: lead.state,
          ...typedChanged,
        });

        console.log('🆔 [handleUpdate] leadId (local):', lead.id, '| deal_id (backend):', updatePayload.deal_id);
        console.log('📦 updatePayload JSON:', JSON.stringify(updatePayload));
        formData.append('data', JSON.stringify(updatePayload));

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
        console.error('Update error response:', JSON.stringify(err?.response?.data));

        // Network drop mid-update: fall back to offline save + sync queue.
        if (isNetworkFailure(err)) {
          try {
            const offlinePayload = {
              mobileNumber: lead.phone,
              deal_id: lead.dealId,
              state: lead.state,
              ...formValues,
              _filesByField: filesByField,
            };
            console.log('🆔 [handleUpdate/network-fallback] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
            await saveFormDataLocally(lead.id, offlinePayload);
            await enqueue(`form_update_${lead.id}`, 'FORM_UPDATE', {
              formData: offlinePayload,
              filesByField: filesByField,
              mobile: lead.phone,
              url: '/user/update',
            });
            Alert.alert(
              '⚠ Network Issue',
              'Connection dropped mid-update. Saved locally and will sync automatically when online.',
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            setFormValues({});
            setFilesByField({});
          } catch (offlineErr) {
            console.error('Offline fallback save failed:', offlineErr);
            Alert.alert(
              'Error',
              'Network failed AND could not save offline. Please screenshot this form and contact support.',
            );
          }
        } else if (err?.response?.status === 413) {
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
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          state: lead.state,
          ...formValues,
          _filesByField: filesByField,
        };
        console.log('🆔 [handleUpdate/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
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
              if (!isFieldVisible(element, formValues)) return null;

              const isRequired = requiredFields.includes(fieldKey);
              const isMulti    = element.options?.multi === true;
              const uploadType = element.options?.uploadType;
              const isReadOnly = element.options?.readOnly === true;
              return (
                <FieldRenderer
                  key={fieldKey}
                  fieldKey={fieldKey}
                  field={field}
                  value={formValues[fieldKey] ?? ''}
                  onChange={getFieldChangeHandler(fieldKey)}
                  filesByField={filesByField}
                  setFilesByField={setFilesByField}
                  required={isRequired}
                  isMulti={isMulti}
                  uploadType={uploadType}
                  gpsCoords={gpsCoords}
                  gpsMapLink={gpsMapLink}
                  gpsLoading={gpsLoading}
                  onRefetchGps={fetchGpsLocation}
                  isReadOnly={isReadOnly}
                  onChangeObjectField={setFormValues}
                />
              );
            })}

            {/* QR code shows only inside "Payment Details" group,
                only when Advance Payment Collection Status = "Collected" */}
            {group.label === 'Payment Details' &&
              formValues.Advance_Payment_Collection_Status === 'Collected' && (
                <View style={styles.qrContainer}>
                  <Text style={styles.qrLabel}>Scan & Pay — Kondaas Automation</Text>
                  <Image
                    source={KondaasPaymentQR}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.qrUpiId}>kondaasautomationpltd016@tmb</Text>
                </View>
            )}
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

  qrContainer: {
    backgroundColor: '#fff', marginHorizontal: 15,
    marginBottom: 10, borderRadius: 10, padding: 16,
    elevation: 2, alignItems: 'center',
  },
  qrLabel: {
    fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 10,
  },
  qrImage: {
    width: 220, height: 220, borderRadius: 6,
  },
  qrUpiId: {
    fontSize: 12, color: '#666', marginTop: 8, fontWeight: '600',
  },
});
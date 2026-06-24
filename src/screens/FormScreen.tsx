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

interface FieldProperty {
  title?: string; description?: string; type?: string;
  enum?: string[]; properties?: Record<string, FieldProperty>; format?: string;
}
interface SchemaProperties { [key: string]: FieldProperty; }
interface Schema { properties?: SchemaProperties; required?: string[]; }
interface UIElement {
  type: string; scope?: string; label?: string;
  elements?: UIElement[]; options?: { multi?: boolean; uploadType?: string };
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

// ── Zoho Field Mapping ─────────────────────────────────────────────────────────
const zohoFieldMap: Record<string, string> = {
  clientName:                       'Consumer_Name',
  clientContact:                    'Phone',
  engineerName:                     'engineerName',          // ✅ no confirmed Zoho field — kept distinct (was clashing with engineerContact)
  engineerContact:                  'Site_Engineer_Contact',
  siteAddress:                      'Street_Address',
  ksebConnectionUnderContactPerson: 'KSEB_Connection_Under_Contact_Person',
  latitude:                         'Latitude',
  longitude:                        'Longitude',
  gpsAccuracy:                      'gpsAccuracy',
  googleMapLink:                    'Google_Map_Location',
  orderType:                        'Order_Type',
  telecallerName:                   'telecallerName',
  projectType:                      'Project_Type',
  consumerNumber:                   'Consumer_Number',
  consumerName:                     'Consumer_Name',
  connectionStatus:                 'Connection_Type',
  tariffType:                       'Tariff',
  connectionPhase:                  'connectionPhase',       // ✅ no confirmed Zoho field — kept distinct (was clashing with connectionStatus)
  connectedLoad:                    'Connected_Load',
  balanceTransformerCapacity:       'Balance_Transformer_Capacity',
  inverterType:                     'inverterType',          // ✅ no confirmed Zoho field — kept distinct (was clashing with inverterConnectionType)
  inverterConnectionType:           'Inverter_Connection_Type',
  inverterCapacity:                 'Inverter_Capacity',
  panelType:                        'Solar_Panel_Model',
  numberOfPanels:                   'No_of_Panels',
  spaceNorthSouth:                  'North_to_South_Space_Available_in_meters',
  spaceEastWest:                    'West_to_East_Space_Available_meters',
  structureType:                    'Structure_Type',
  roofType:                         'Roof_Type',
  roofCondition:                    'Roof_Surface_Physical_Condition',
  buildingHeight:                   'Building_Height_Profile',
  shadowPossibility:                'Shadow_Possibility',
  roofAccess:                       'Roof_Access_Available',
  ladderRequirement:                'Ladder',
  walkwayRequirement:               'Walkway',
  slidingDoorRequirement:           'Sliding_Door',
  cableRequirement:                 'Cable_Requirements',
  customerDocsProvided:             'customerDocsProvided',  // ✅ no confirmed Zoho field — kept distinct (was clashing with documentsCollectedStatus)
  ksebNameChange:                   'Name_Change_In_EB_Bill',
  bankNameChange:                   'Name_Change_in_Bank',
  gridLoadChange:                   'Connected_Load_Revise',
  paymentMode:                      'Mode_of_Payment',
  advanceCollectionStatus:          'Advance_payment_Received',
  documentsCollectedStatus:         'Document_collected',
  collectedSitePhotosStatus:        'Site_Survey',
  photoNorthSouth:                  'photoNorthSouth',
  photoSouthNorth:                  'photoSouthNorth',
  photoEastWest:                    'photoEastWest',
  photoWestEast:                    'photoWestEast',
  photoPanelMounting:               'photoPanelMounting',
  photoGeoTagged:                   'photoGeoTagged',
  videoRoof:                        'videoRoof',
  videoSurround:                    'videoSurround',
  photoBuildingView:                'photoBuildingView',
  photoMeter:                       'photoMeter',
  photoEarthing:                    'photoEarthing',
  photoInverterDb:                  'photoInverterDb',
  productName:                      'Product_Name',
  totalPlantCost:                   'Total_Plant_Cost',
  governmentSubsidy:                'Subsidy_Amount',
  netCostAfterSubsidy:              'Plant_Cost_After_Subsidy',
  additionalKsebCharges:            'Additional_EB_Charges',
  additionalStructureCost:          'Additional_Structure_Cost',
  remarks:                          'Site_Survey_Remarks',
  siteEngineerSignature:            'Site_Engineer_Signature',
  customerConfirmationSignature:    'Customer_Confirmation',
};

const mapToZohoFields = (values: Record<string, string>): Record<string, string> => {
  const mapped: Record<string, string> = {};
  Object.entries(values).forEach(([key, value]) => {
    const zohoKey = zohoFieldMap[key] ?? key;
    mapped[zohoKey] = value;
  });
  return mapped;
};
const numberFields = new Set([
  'Consumer_Number',
  'Connected_Load',
  'Balance_Transformer_Capacity',
  'Inverter_Capacity',
  'No_of_Panels',
  'North_to_South_Space_Available_in_meters',
  'West_to_East_Space_Available_meters',
  'Total_Plant_Cost',
  'Subsidy_Amount',
  'Plant_Cost_After_Subsidy',
  'Additional_EB_Charges',
  'Additional_Structure_Cost',
  'gpsAccuracy',
]);

const coerceNumbers = (mapped: Record<string, string>): Record<string, any> => {
  const result: Record<string, any> = {};
  Object.entries(mapped).forEach(([key, val]) => {
    if (numberFields.has(key) && val !== '' && val != null) {
      // Consumer_Number must be strict integer
      if (key === 'Consumer_Number') {
  const parsed = Math.trunc(Number(val));
  result[key] = isNaN(parsed) ? 0 : parsed;
} else {
        const num = Number(val);
        result[key] = isNaN(num) ? val : num;
      }
    } else {
      result[key] = val;
    }
  });
  return result;
};

// ── Dropdown ──────────────────────────────────────────────────────────────────
const DropdownPicker = ({
  label, options, value, onChange, required,
}: {
  label: string; options: string[]; value: string;
  onChange: (val: string) => void; required?: boolean;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>
      <TouchableOpacity style={styles.dropdownBtn} onPress={() => setVisible(true)}>
        <Text style={{ color: value ? '#333' : '#aaa', fontSize: 14, flex: 1 }}>
          {value || 'Select...'}
        </Text>
        <Ionicons name="chevron-down-outline" size={16} color="#888" />
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

// ── Photo Upload Field ─────────────────────────────────────────────────────────
const PhotoUploadField = ({
  label, photoFiles, onChange, required,
  selectionLimit, namePrefix, accentColor,
}: {
  label: string; photoFiles: PhotoFile[];
  onChange: (files: PhotoFile[]) => void; required?: boolean;
  selectionLimit: number; namePrefix: string; accentColor: string;
}) => {
  const appendFiles = (newFiles: PhotoFile[]) => {
    onChange([...photoFiles, ...newFiles]);
  };

  const mapAssets = (assets: any[]): PhotoFile[] =>
    assets
      .map((asset) => ({
        uri: asset.uri ?? '',
        name: asset.fileName ?? asset.uri?.split('/').pop() ?? `${namePrefix}_${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      }))
      .filter((f) => f.uri);

  const handleTakePhoto = () => {
    launchCamera(
      { mediaType: 'photo', quality: 0.8, saveToPhotos: true },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        appendFiles(mapAssets(assets));
      }
    );
  };

  const handleUpload = () => {
    const remaining = Math.max(selectionLimit - photoFiles.length, 1);
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: remaining, quality: 0.8 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;
        appendFiles(mapAssets(assets));
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
          onPress={handleTakePhoto}
        >
          <Ionicons name="camera-outline" size={20} color={accentColor} />
          <Text style={{ color: accentColor, fontWeight: '700', fontSize: 13 }}>Take Photo</Text>
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
                <Image
                  source={{ uri: file.uri }}
                  style={{
                    width: 64, height: 64, borderRadius: 8,
                    borderWidth: 1.5, borderColor: accentColor,
                  }}
                />
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

// ── Field Renderer ─────────────────────────────────────────────────────────────
const renderField = (
  fieldKey: string,
  field: FieldProperty,
  formValues: Record<string, string>,
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  photoFiles: PhotoFile[],
  setPhotoFiles: React.Dispatch<React.SetStateAction<PhotoFile[]>>,
  siteSurveyPhotos: PhotoFile[],
  setSiteSurveyPhotos: React.Dispatch<React.SetStateAction<PhotoFile[]>>,
  required: boolean,
  isMulti: boolean | undefined,
  uploadType: string | undefined,
  gpsCoords: GpsCoords,
  gpsMapLink: string,
  gpsLoading: boolean,
  onRefetchGps: () => void,
) => {
  const label = field.title ?? fieldKey;
  const value = formValues[fieldKey] ?? '';

  if (fieldKey === 'latitude') {
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
  if (fieldKey === 'longitude' || fieldKey === 'gpsAccuracy' || fieldKey === 'googleMapLink') {
    return null;
  }

  if (fieldKey === 'ebBillUpload' || uploadType === 'ebBill') {
    return (
      <PhotoUploadField
        key={fieldKey}
        label={label}
        photoFiles={photoFiles}
        onChange={(files) => setPhotoFiles(files)}
        required={required}
        selectionLimit={6}
        namePrefix="eb_bill"
        accentColor="#22c55e"
      />
    );
  }

  if (fieldKey === 'siteSurveyPhotos' || uploadType === 'siteSurvey') {
    return (
      <PhotoUploadField
        key={fieldKey}
        label={label}
        photoFiles={siteSurveyPhotos}
        onChange={(files) => setSiteSurveyPhotos(files)}
        required={required}
        selectionLimit={10}
        namePrefix="site_survey"
        accentColor="#3b82f6"
      />
    );
  }

  if (field.enum && field.enum.length > 0) {
    return (
      <DropdownPicker
        key={fieldKey} label={label} options={field.enum} value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
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
          style={[styles.input, styles.textarea]}
          multiline numberOfLines={4} value={value}
          onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
          placeholderTextColor="#aaa" placeholder={label}
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
        style={styles.input} value={value}
        onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        placeholderTextColor="#aaa" placeholder={label}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
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

  const [template, setTemplate]                 = useState<Template | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [formValues, setFormValues]             = useState<Record<string, string>>({});
  const [photoFiles, setPhotoFiles]             = useState<PhotoFile[]>([]);
  const [siteSurveyPhotos, setSiteSurveyPhotos] = useState<PhotoFile[]>([]);
  const [submitting, setSubmitting]             = useState(false);
  const [isOnline, setIsOnline]                 = useState(true);
  const [offlineBanner, setOfflineBanner]       = useState(false);

  const [gpsCoords, setGpsCoords] = useState<GpsCoords>({ latitude: null, longitude: null, accuracy: null });
  const [gpsLoading, setGpsLoading] = useState(false);
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
      const maxAttempts = 20;

      const checkLocation = setInterval(() => {
        attempts++;

        setGpsCoords((prev) => {
          if (typedLocation?.latitude != null && typedLocation?.longitude != null) {
            const accuracy = typedLocation.accuracy ?? null;

            setFormValues((prevForm) => ({
              ...prevForm,
              latitude: String(typedLocation.latitude),
              longitude: String(typedLocation.longitude),
              gpsAccuracy: String(accuracy ?? 0),
              googleMapLink: `https://www.google.com/maps?q=${typedLocation.latitude},${typedLocation.longitude}`,
            }));

            clearInterval(checkLocation);
            setGpsLoading(false);

            return {
              latitude: typedLocation.latitude,
              longitude: typedLocation.longitude,
              accuracy,
            };
          }

          if (attempts >= maxAttempts) {
            clearInterval(checkLocation);
            setGpsLoading(false);
            Alert.alert(
              'GPS Error',
              'Could not get accurate GPS location.\nPlease tap "Refetch GPS" button again.'
            );
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
        latitude: String(typedLocation.latitude),
        longitude: String(typedLocation.longitude),
        gpsAccuracy: String(accuracy ?? 0),
        googleMapLink: `https://www.google.com/maps?q=${typedLocation.latitude},${typedLocation.longitude}`,
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
                flattened[fullKey] = val != null ? String(val) : '';
              }
            });
          };
          flatten(existing);
          setFormValues(flattened);
        } catch (err) {
          const draft = await getSavedFormData(lead.id);
          if (draft) setFormValues(draft);
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

  // ── Submit (New Form) ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);

    if (isOnline) {
      try {
        const formData = new FormData();
        const mapped = coerceNumbers(mapToZohoFields(formValues));
console.log('🔍 Consumer_Number type:', typeof mapped['Consumer_Number'], '| value:', mapped['Consumer_Number']);
console.log('🔍 Site_Engineer_Contact type:', typeof mapped['Site_Engineer_Contact'], '| value:', mapped['Site_Engineer_Contact']);
console.log('🔍 Full mapped payload:', JSON.stringify(mapped, null, 2));

const dataPayload = {
  mobileNumber: lead.phone,
  deal_id: lead.dealId,
  ...mapped,  // ✅ reuse
};
        console.log('🆔 [handleSubmit] leadId (local):', lead.id, '| deal_id (backend):', dataPayload.deal_id);
        formData.append('data', JSON.stringify(dataPayload));

        photoFiles.forEach((file) => {
          formData.append('ebBillPhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        siteSurveyPhotos.forEach((file) => {
          formData.append('sitePhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        console.log(
          `📤 Submitting form with ${photoFiles.length} EB bill(s) and ${siteSurveyPhotos.length} site survey photo(s)...`
        );

        const res = await API.post('/user/add', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (res.status === 201 || res.data?.message) {
          Alert.alert('✔ Submitted', 'Form submitted successfully!', [
            { text: 'OK', onPress: _navigateBack },
          ]);
          setFormValues({});
          setPhotoFiles([]);
          setSiteSurveyPhotos([]);
        }
      } catch (err: any) {
        console.error('Submit error:', err);
        Alert.alert(
          'Error',
          err?.response?.data?.error || err?.message || 'Submit failed. Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        // ✅ Zoho field mapping applied for offline too
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          ...mapToZohoFields(formValues),
          _photoFiles: photoFiles,
          _siteSurveyPhotos: siteSurveyPhotos,
        };
        console.log('🆔 [handleSubmit/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
        await enqueue(`form_submit_${lead.id}`, 'FORM_SUBMIT', {
          formData: offlinePayload,
          photoFiles: photoFiles,
          siteSurveyPhotos: siteSurveyPhotos,
          mobile: lead.phone,
        });
        Alert.alert(
          '✔ Saved Offline',
          'Form and photos saved locally. Will be submitted when internet is available.',
          [{ text: 'OK', onPress: _navigateBack }],
        );
        setFormValues({});
        setPhotoFiles([]);
        setSiteSurveyPhotos([]);
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

    if (isOnline) {
      try {
        const formData = new FormData();

        // ✅ Zoho field mapping applied here
        const mapped = coerceNumbers(mapToZohoFields(formValues));

const updatePayload = {
  mobileNumber: lead.phone,
  deal_id: lead.dealId,
  ...mapped,  // ✅ reuse
};
        console.log('🆔 [handleUpdate] leadId (local):', lead.id, '| deal_id (backend):', updatePayload.deal_id);
        formData.append('data', JSON.stringify(updatePayload));

        photoFiles.forEach((file) => {
          formData.append('ebBillPhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        siteSurveyPhotos.forEach((file) => {
          formData.append('sitePhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        console.log(
          `📤 Updating form with ${photoFiles.length} EB bill(s) and ${siteSurveyPhotos.length} site survey photo(s)...`
        );

        const res = await API.put('https://board.trisentrix.com/user/update', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        Alert.alert('✔ Updated', 'Form updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        setFormValues({});
        setPhotoFiles([]);
        setSiteSurveyPhotos([]);
      } catch (err: any) {
        console.error('Update error:', err);
        Alert.alert(
          'Error',
          err?.response?.data?.error || err?.message || 'Update failed. Please try again.',
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        // ✅ Zoho field mapping applied for offline update too
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId,
          ...mapToZohoFields(formValues),
          _photoFiles: photoFiles,
          _siteSurveyPhotos: siteSurveyPhotos,
        };
        console.log('🆔 [handleUpdate/offline] leadId (local):', lead.id, '| deal_id (backend):', offlinePayload.deal_id);
        await saveFormDataLocally(lead.id, offlinePayload);
        await enqueue(`form_update_${lead.id}`, 'FORM_UPDATE', {
          formData: offlinePayload,
          photoFiles: photoFiles,
          siteSurveyPhotos: siteSurveyPhotos,
          mobile: lead.phone,
          url: 'https://board.trisentrix.com/user/update',
        });
        Alert.alert(
          '✔ Saved Offline',
          'Update saved locally with photos. Will be synced when online.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        setFormValues({});
        setPhotoFiles([]);
        setSiteSurveyPhotos([]);
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
  const groups         = template.uischema?.elements ?? [];

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
              const isRequired = requiredFields.includes(fieldKey);
              const isMulti    = element.options?.multi === true;
              const uploadType = element.options?.uploadType;
              return renderField(
                fieldKey,
                field,
                formValues,
                setFormValues,
                photoFiles,
                setPhotoFiles,
                siteSurveyPhotos,
                setSiteSurveyPhotos,
                isRequired,
                isMulti,
                uploadType,
                gpsCoords,
                gpsMapLink,
                gpsLoading,
                fetchGpsLocation,
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
});
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TextInput, TouchableOpacity, Alert, Modal, FlatList, Image,
} from 'react-native';
import API from '../api/api1';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import {
  cacheTemplate, getCachedTemplate,
  saveFormDataLocally, getSavedFormData,
} from '../service/Localleadsstorage';
import { enqueue } from '../service/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { launchImageLibrary } from 'react-native-image-picker';

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

// ── PhotoFile type ─────────────────────────────────────────────────────────────
interface PhotoFile {
  uri: string;
  name: string;
  type: string;
}

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

// ── EB Bill Upload Field ───────────────────────────────────────────────────────
const EbBillUploadField = ({
  label, photoFiles, onChange, required,
}: {
  label: string; photoFiles: PhotoFile[];
  onChange: (files: PhotoFile[]) => void; required?: boolean;
}) => {
  const [previewUris, setPreviewUris] = useState<string[]>(photoFiles.map(f => f.uri));

  const handlePick = async () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 6, quality: 0.8 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;

        const newFiles: PhotoFile[] = assets.map((asset) => ({
          uri: asset.uri ?? '',
          name: asset.fileName ?? asset.uri?.split('/').pop() ?? `eb_bill_${Date.now()}.jpg`,
          type: asset.type ?? 'image/jpeg',
        })).filter(f => f.uri);

        setPreviewUris(newFiles.map(f => f.uri));
        onChange(newFiles);
      }
    );
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>

      <TouchableOpacity
        style={{
          borderWidth: 1.5,
          borderColor: photoFiles.length > 0 ? '#22c55e' : '#ED1C25',
          borderStyle: 'dashed',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          backgroundColor: photoFiles.length > 0 ? '#f0fdf4' : '#fff5f5',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        }}
        onPress={handlePick}
      >
        <Ionicons
          name={photoFiles.length > 0 ? 'checkmark-circle' : 'cloud-upload-outline'}
          size={24}
          color={photoFiles.length > 0 ? '#22c55e' : '#ED1C25'}
        />
        <Text style={{
          color: photoFiles.length > 0 ? '#22c55e' : '#ED1C25',
          fontWeight: '600', fontSize: 13,
        }}>
          {photoFiles.length > 0 ? `✅ ${photoFiles.length} Bill(s) Selected` : 'Select Last 6 Months EB Bills'}
        </Text>
      </TouchableOpacity>

      {previewUris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {previewUris.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={{
                width: 60, height: 60, borderRadius: 6,
                marginRight: 8, borderWidth: 1, borderColor: '#ddd',
              }}
            />
          ))}
        </ScrollView>
      )}

      {photoFiles.length > 0 && (
        <Text style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
          Tap to change bills • Will upload on form submission
        </Text>
      )}
    </View>
  );
};

// ── Site Survey Photo Upload Field ────────────────────────────────────────────
const SiteSurveyUploadField = ({
  label, photoFiles, onChange, required,
}: {
  label: string; photoFiles: PhotoFile[];
  onChange: (files: PhotoFile[]) => void; required?: boolean;
}) => {
  const [previewUris, setPreviewUris] = useState<string[]>(photoFiles.map(f => f.uri));

  const handlePick = async () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 10, quality: 0.8 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const assets = response.assets ?? [];
        if (assets.length === 0) return;

        const newFiles: PhotoFile[] = assets.map((asset) => ({
          uri: asset.uri ?? '',
          name: asset.fileName ?? asset.uri?.split('/').pop() ?? `site_survey_${Date.now()}.jpg`,
          type: asset.type ?? 'image/jpeg',
        })).filter(f => f.uri);

        setPreviewUris(newFiles.map(f => f.uri));
        onChange(newFiles);
      }
    );
  };

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>

      <TouchableOpacity
        style={{
          borderWidth: 1.5,
          borderColor: photoFiles.length > 0 ? '#3b82f6' : '#ED1C25',
          borderStyle: 'dashed',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          backgroundColor: photoFiles.length > 0 ? '#eff6ff' : '#fff5f5',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        }}
        onPress={handlePick}
      >
        <Ionicons
          name={photoFiles.length > 0 ? 'images' : 'camera-outline'}
          size={24}
          color={photoFiles.length > 0 ? '#3b82f6' : '#ED1C25'}
        />
        <Text style={{
          color: photoFiles.length > 0 ? '#3b82f6' : '#ED1C25',
          fontWeight: '600', fontSize: 13,
        }}>
          {photoFiles.length > 0
            ? `📷 ${photoFiles.length} Site Photo(s) Selected`
            : 'Upload Site Survey Photos'}
        </Text>
      </TouchableOpacity>

      {previewUris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {previewUris.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={{
                width: 70, height: 70, borderRadius: 8,
                marginRight: 8, borderWidth: 1.5, borderColor: '#3b82f6',
              }}
            />
          ))}
        </ScrollView>
      )}

      {photoFiles.length > 0 && (
        <Text style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
          Tap to change photos • Will upload on form submission
        </Text>
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
  isMulti?: boolean,
  uploadType?: string,
) => {
  const label = field.title ?? fieldKey;
  const value = formValues[fieldKey] ?? '';

  // ✅ EB Bill upload
  if (fieldKey === 'ebBillUpload' || uploadType === 'ebBill') {
    return (
      <EbBillUploadField
        key={fieldKey}
        label={label}
        photoFiles={photoFiles}
        onChange={(files) => setPhotoFiles(files)}
        required={required}
      />
    );
  }

  // ✅ Site Survey Photos upload
  if (fieldKey === 'siteSurveyPhotos' || uploadType === 'siteSurvey') {
    return (
      <SiteSurveyUploadField
        key={fieldKey}
        label={label}
        photoFiles={siteSurveyPhotos}
        onChange={(files) => setSiteSurveyPhotos(files)}
        required={required}
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

  const [template, setTemplate]                   = useState<Template | null>(null);
  const [loading, setLoading]                     = useState(true);
  const [formValues, setFormValues]               = useState<Record<string, string>>({});
  const [photoFiles, setPhotoFiles]               = useState<PhotoFile[]>([]);       // EB Bills
  const [siteSurveyPhotos, setSiteSurveyPhotos]   = useState<PhotoFile[]>([]);       // Site Survey
  const [submitting, setSubmitting]               = useState(false);
  const [isOnline, setIsOnline]                   = useState(true);
  const [offlineBanner, setOfflineBanner]         = useState(false);

  // ── Net status ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      setOfflineBanner(!online);
    });
    return () => unsub();
  }, []);

  // ── Load template ─────────────────────────────────────────────────────────
  useEffect(() => { fetchTemplate(); }, []);

  // ── Restore draft / edit data ─────────────────────────────────────────────
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

  // ── Auto-save draft ───────────────────────────────────────────────────────
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

  // ── Submit (New) ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);

    if (isOnline) {
      try {
        const formData = new FormData();

        const dataPayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId, // ✅ FIX: was lead.id (local leadId) — must be lead.dealId (backend order id)
          ...formValues,
        };
        // 🆔 deal_id console log — shows exactly what deal_id is being sent to /user/add
        console.log('🆔 [handleSubmit] leadId (local):', lead.id, '| deal_id (backend):', dataPayload.deal_id);
        formData.append('data', JSON.stringify(dataPayload));

        // EB Bill photos
        photoFiles.forEach((file) => {
          formData.append('ebBillPhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        // Site Survey photos
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
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId, // ✅ FIX: was lead.id — must be lead.dealId
          ...formValues,
          _photoFiles: photoFiles,
          _siteSurveyPhotos: siteSurveyPhotos,
        };
        // 🆔 deal_id console log — offline path
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

  // ── Update (Edit) ─────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    setSubmitting(true);

    if (isOnline) {
      try {
        const formData = new FormData();

        const updatePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId, // ✅ FIX: was lead.id — must be lead.dealId
          ...formValues,
        };
        // 🆔 deal_id console log — shows exactly what deal_id is being sent to /user/update
        console.log('🆔 [handleUpdate] leadId (local):', lead.id, '| deal_id (backend):', updatePayload.deal_id);
        formData.append('data', JSON.stringify(updatePayload));

        // EB Bill photos
        photoFiles.forEach((file) => {
          formData.append('ebBillPhotos', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        });

        // Site Survey photos
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
        const offlinePayload = {
          mobileNumber: lead.phone,
          deal_id: lead.dealId, // ✅ FIX: was lead.id — must be lead.dealId
          ...formValues,
          _photoFiles: photoFiles,
          _siteSurveyPhotos: siteSurveyPhotos,
        };
        // 🆔 deal_id console log — offline path
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

  // ── Loading ───────────────────────────────────────────────────────────────
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

      {/* Header */}
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

      {/* Offline banner */}
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
              );
            })}
          </View>
        ))}

        {/* Submit / Update button */}
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

// ── Styles ─────────────────────────────────────────────────────────────────────
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
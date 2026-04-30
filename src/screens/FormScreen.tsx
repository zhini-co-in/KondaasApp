
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TextInput, TouchableOpacity, Alert, Modal, FlatList,
} from 'react-native';
import API from '../api/api1';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import {
  cacheTemplate,
  getCachedTemplate,
  saveFormDataLocally,
  updateAcceptedLeadStatus,
  getSavedFormData,
} from '../service/localLeadsStorage';
import { enqueue } from '../service/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';

// ── Types ──────────────────────────────────────────────────────────────────
interface FieldProperty {
  title?: string;
  description?: string;
  type?: string;
  enum?: string[];
  properties?: Record<string, FieldProperty>;
  format?: string;
}
interface SchemaProperties { [key: string]: FieldProperty; }
interface Schema { properties?: SchemaProperties; required?: string[]; }
interface UIElement {
  type: string; scope?: string; label?: string;
  elements?: UIElement[]; options?: { multi?: boolean };
}
interface UISchema { type: string; elements: UIElement[]; }
interface Template { id: string; schema: Schema; uischema: UISchema; }
interface Lead { id: string; name: string; phone: string; [key: string]: string; }

// ── Dropdown Component ─────────────────────────────────────────────────────
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

// ── Field Renderer ─────────────────────────────────────────────────────────
const renderField = (
  fieldKey: string, field: FieldProperty,
  formValues: Record<string, string>,
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  required: boolean, isMulti?: boolean
) => {
  const label = field.title ?? fieldKey;
  const value = formValues[fieldKey] ?? '';

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

// ── Main Screen ────────────────────────────────────────────────────────────
const FormScreen = ({
  route, navigation,
}: {
  route: { params: { category: string; lead: Lead } };
  navigation: any;
}) => {
  const { lead } = route.params;

  const [template, setTemplate]     = useState<Template | null>(null);
  const [loading, setLoading]       = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline]     = useState(true);
  const [offlineBanner, setOfflineBanner] = useState(false);

  // ── Net status watch ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      setOfflineBanner(!online);
    });
    return () => unsub();
  }, []);

  // ── Load template + restore draft ────────────────────────────────────────
useEffect(() => {
  const init = async () => {
    await fetchTemplate(); // template முதல்ல load ஆகட்டும்
  };
  init();
}, []);

// template load ஆன உடனே draft restore பண்ணு
useEffect(() => {
  if (!template) return;
  const restoreDraft = async () => {
    const draft = await getSavedFormData(lead.id);
    if (draft) setFormValues(draft);
  };
  restoreDraft();
}, [template]); // template மாறும்போதே trigger

  // Auto-save draft every time formValues changes
  useEffect(() => {
    if (Object.keys(formValues).length === 0) return;
    saveFormDataLocally(lead.id, formValues); // silent background save
  }, [formValues]);

  const fetchTemplate = async () => {
    try {
      const res = await API.get('/template/get');
      const templateData =
        res.data?.data || res.data?.template || res.data;

      if (!templateData?.schema || !templateData?.uischema) {
        throw new Error('Invalid template structure');
      }

      // Cache for offline use
      await cacheTemplate(templateData);
      setTemplate(templateData);

    } catch (err) {
      // Net இல்லாட்டி cached template try பண்ணு
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

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
  setSubmitting(true);
  const formPayload = { mobileNumber: lead.phone, ...formValues };

  if (isOnline) {
    try {
      let surveyorNumber = '';
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed = userData ? JSON.parse(userData) : null;
      surveyorNumber = parsed?.UserInfo?.phoneNo || '';

      await API.post('/user/add', formPayload);
      await API.put('/order/updatestatus', { mobile: lead.phone, status: 'completed' });
      await API.post('/order/complete', { mobile: lead.phone, surveyorNumber }); // ✅ சரியான payload

      const leadId = lead.id || lead._id;
      await updateAcceptedLeadStatus(leadId, 'completed');

      _navigateAfterSubmit();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Submit failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  } else {
  try {
    // Surveyor number offline-லயும் எடு
    let surveyorNumber = '';
    const userData = await AsyncStorage.getItem(USER_DATA);
    const parsed = userData ? JSON.parse(userData) : null;
    surveyorNumber = parsed?.UserInfo?.phoneNo || '';

    await saveFormDataLocally(lead.id, formPayload);
    await enqueue(`form_submit_${lead.id}`, 'FORM_SUBMIT', { formData: formPayload, mobile: lead.phone });
    await enqueue(`status_completed_${lead.id}`, 'STATUS_UPDATE', { mobile: lead.phone, status: 'completed' });
    
    // ── புதுசா add ──
    await enqueue(`completed_lead_${lead.id}`, 'COMPLETED_LEAD', { mobile: lead.phone, surveyorNumber });

    const leadId = lead.id || lead._id;
    await updateAcceptedLeadStatus(leadId, 'completed');

    Alert.alert('✓ Saved Offline', 'Form saved locally. It will be submitted automatically when internet is available.',
      [{ text: 'OK', onPress: _navigateAfterSubmit }]
    );
  } catch (e) {
    Alert.alert('Error', 'Failed to save form offline.');
  } finally {
    setSubmitting(false);
  }
}
  };

  const _navigateAfterSubmit = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Surveyerscreen' },
        {
          name: 'InProgress',
          params: {
            lead: { ...lead, status: 'completed' },
            completedLeadId: lead.id,
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

  const properties    = template.schema?.properties ?? {};
  const requiredFields = template.schema?.required ?? [];
  const groups        = template.uischema?.elements ?? [];

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Site Observation</Text>
          <Text style={styles.subTitle}>{lead.name} | {lead.phone}</Text>
        </View>
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
              const fieldKey = element.scope?.split('/').pop() ?? '';
              const field    = properties[fieldKey];
              if (!field) return null;
              const isRequired = requiredFields.includes(fieldKey);
              const isMulti    = element.options?.multi === true;
              return renderField(fieldKey, field, formValues, setFormValues, isRequired, isMulti);
            })}
          </View>
        ))}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }, !isOnline && styles.submitBtnOffline]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={isOnline ? 'cloud-upload-outline' : 'save-outline'}
                size={18} color="#fff"
              />
              <Text style={styles.submitBtnText}>
                {isOnline ? 'Submit Form' : 'Save Offline'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default FormScreen;

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#ED1C25', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  subTitle: { fontSize: 12, color: '#ffcccc', marginTop: 2 },

  offlineBanner: {
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 20, paddingBottom: 8,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ED1C25', marginRight: 8 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  dropdownModal: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 12, padding: 16, maxHeight: '60%', elevation: 10,
  },
  dropdownModalTitle: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
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
  submitBtnOffline: { backgroundColor: '#f97316' }, // orange when offline
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

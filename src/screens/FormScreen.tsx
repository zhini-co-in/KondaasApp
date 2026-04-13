// screens/FormScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, TextInput, TouchableOpacity, Alert, Modal, FlatList
} from 'react-native';
import API from '../api/api1';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ── Types ──────────────────────────────────────────────────────────────────
interface FieldProperty {
  title?: string;
  description?: string;
  type?: string;
  enum?: string[];
  properties?: Record<string, FieldProperty>;
  format?: string;
}

interface SchemaProperties {
  [key: string]: FieldProperty;
}

interface Schema {
  properties?: SchemaProperties;
  required?: string[];
}

interface UIElement {
  type: string;
  scope?: string;
  label?: string;
  elements?: UIElement[];
  options?: { multi?: boolean };
}

interface UISchema {
  type: string;
  elements: UIElement[];
}

interface Template {
  id: string;
  schema: Schema;
  uischema: UISchema;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  [key: string]: string;
}

interface RouteParams {
  category: string;
  lead: Lead;
}

// ── Dropdown Component ─────────────────────────────────────────────────────
const DropdownPicker = ({
  label, options, value, onChange, required,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <Text style={styles.dropdownModalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    value === item && { backgroundColor: '#FFF0F0' },
                  ]}
                  onPress={() => {
                    onChange(item);
                    setVisible(false);
                  }}
                >
                  <Text style={{ color: '#333', fontSize: 14 }}>{item}</Text>
                  {value === item && (
                    <Ionicons name="checkmark" size={16} color="#ED1C25" />
                  )}
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
  fieldKey: string,
  field: FieldProperty,
  formValues: Record<string, string>,
  setFormValues: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  required: boolean,
  isMulti?: boolean
) => {
  const label = field.title ?? fieldKey;
  const value = formValues[fieldKey] ?? '';

  // Enum → Dropdown
  if (field.enum && field.enum.length > 0) {
    return (
      <DropdownPicker
        key={fieldKey}
        label={label}
        options={field.enum}
        value={value}
        onChange={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        required={required}
      />
    );
  }

  // Nested object (flatRoof1, flatRoof2)
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
                onChangeText={(val) =>
                  setFormValues((prev) => ({ ...prev, [fullKey]: val }))
                }
                placeholderTextColor="#aaa"
                placeholder={subField.title ?? subKey}
              />
            </View>
          );
        })}
      </View>
    );
  }

  // Textarea (multi)
  if (isMulti) {
    return (
      <View key={fieldKey} style={styles.fieldContainer}>
        <Text style={styles.label}>
          {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
        </Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline numberOfLines={4}
          value={value}
          onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
          placeholderTextColor="#aaa"
          placeholder={label}
        />
      </View>
    );
  }

  // Number / Text input
  return (
    <View key={fieldKey} style={styles.fieldContainer}>
      <Text style={styles.label}>
        {label} {required && <Text style={{ color: '#ED1C25' }}>*</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(val) => setFormValues((prev) => ({ ...prev, [fieldKey]: val }))}
        placeholderTextColor="#aaa"
        placeholder={label}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
      />
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────
const FormScreen = ({
  route,
  navigation,
}: {
  route: { params: RouteParams };
  navigation: any;
}) => {
  const { lead } = route.params;
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, []);

  const fetchTemplate = async () => {
  try {
    const res = await API.get('/template/get');
    
    console.log('RAW response:', JSON.stringify(res.data));
    
    const templateData = 
      res.data?.data ||      // { data: { schema, uischema } }
      res.data?.template ||  // { template: { schema, uischema } }
      res.data;              // { schema, uischema } directly
    
    console.log('templateData:', JSON.stringify(templateData));
    console.log('has schema?', !!templateData?.schema);
    console.log('has uischema?', !!templateData?.uischema);
    
    if (!templateData?.schema || !templateData?.uischema) {
      Alert.alert('Debug', `Response: ${JSON.stringify(res.data).slice(0, 200)}`);
      setLoading(false);
      return;
    }
    
    setTemplate(templateData);
  } catch (err: unknown) {
    const error = err as any;
    console.log('Error status:', error?.response?.status);
    console.log('Error data:', JSON.stringify(error?.response?.data));
    Alert.alert(
      'API Error', 
      `Status: ${error?.response?.status || 'No response'}\n${JSON.stringify(error?.response?.data || error?.message)}`
    );
  } finally {
    setLoading(false);
  }
};

  const handleSubmit = async () => {
  setSubmitting(true);
  try {
    const payload = {
      mobileNumber: lead.phone,
      ...formValues,
    };

    // 1. Submit form data
    await API.post('/user/add', payload);

    // 2. ✅ Update status to completed
    await API.put('/order/updatestatus', {
      mobile: lead.phone,
      status: 'completed',
    });

    // 3. Navigate back
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

  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    Alert.alert('Error', error?.response?.data?.error || 'Failed to submit.');
  } finally {
    setSubmitting(false);
  }
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
        <Text style={{ color: '#888' }}>Form template not found.</Text>
      </View>
    );
  }

  const properties = template.schema?.properties ?? {};
  const requiredFields = template.schema?.required ?? [];
  const groups = template.uischema?.elements ?? [];

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Site Observation</Text>
          <Text style={styles.subTitle}>{lead.name} | {lead.phone}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Render groups from uischema */}
        {groups.map((group, gIdx) => (
          <View key={gIdx}>
            {/* Group Header */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>{group.label}</Text>
            </View>

            {/* Group Fields */}
            {(group.elements ?? []).map((element) => {
              const fieldKey = element.scope?.split('/').pop() ?? '';
              const field = properties[fieldKey];
              if (!field) return null;

              const isRequired = requiredFields.includes(fieldKey);
              const isMulti = element.options?.multi === true;

              return renderField(fieldKey, field, formValues, setFormValues, isRequired, isMulti);
            })}
          </View>
        ))}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Submit Form</Text>
          }
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
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },

  submitBtn: {
    backgroundColor: '#ED1C25', marginHorizontal: 15,
    marginTop: 16, paddingVertical: 15, borderRadius: 10,
    alignItems: 'center', elevation: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
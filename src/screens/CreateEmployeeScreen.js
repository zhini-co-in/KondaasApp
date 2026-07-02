import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';

const ROLES = [
  { key: 'admin',     label: 'Admin',     icon: 'shield-checkmark-outline' },
  { key: 'logistic',  label: 'Logistic',  icon: 'cube-outline' },
  { key: 'installer', label: 'Installer', icon: 'construct-outline' },
  { key: 'surveyor',  label: 'Surveyor',  icon: 'map-outline' },
];

export default function CreateEmployeeScreen({ navigation }) {
  const [mobile, setMobile]   = useState('');
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(false);

  const cleanMobile = mobile.replace(/\D/g, '');
  const canSubmit = cleanMobile.length === 10 && !!role && !loading;

  const handleCreateEmployee = async () => {
    if (cleanMobile.length !== 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!role) {
      Alert.alert('Select a role', 'Please choose a role for this employee.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/admin/assign-role', {
        mobileNumber: cleanMobile,
        role,
      });

      if (res.data?.success) {
        Alert.alert('Success', res.data.message || 'Employee whitelisted successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', res.data?.message || 'Could not create employee.');
      }
    } catch (e) {
      const serverMsg = e?.response?.data?.message;
      Alert.alert('Error', serverMsg || e?.message || 'Something went wrong.');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor="#C8000A" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Employee</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Mobile Number</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="call-outline" size={17} color="#999" />
          <TextInput
            style={styles.input}
            placeholder="10-digit mobile number"
            placeholderTextColor="#ccc"
            value={mobile}
            onChangeText={t => setMobile(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        <Text style={styles.sectionLabel}>Select Role</Text>
        <View style={styles.roleGrid}>
          {ROLES.map(r => {
            const active = role === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleCard, active && styles.roleCardActive]}
                activeOpacity={0.8}
                onPress={() => setRole(r.key)}
              >
                <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
                  <Ionicons name={r.icon} size={20} color={active ? '#fff' : '#C8000A'} />
                </View>
                <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{r.label}</Text>
                {active && (
                  <View style={styles.roleCheck}>
                    <Ionicons name="checkmark-circle" size={16} color="#C8000A" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleCreateEmployee}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="person-add-outline" size={17} color="#fff" />
          )}
          <Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create Employee'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FB' },

  header: {
    backgroundColor: '#C8000A',
    paddingHorizontal: 18, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flex: 1 },

  scrollContent: { padding: 18, paddingBottom: 50 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 18, marginBottom: 8,
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA',
  },
  input: { flex: 1, fontSize: 14, color: '#1a1a1a', paddingVertical: 0 },

  roleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  roleCard: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EAEAEA',
    paddingHorizontal: 14, paddingVertical: 14,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: '#C8000A', backgroundColor: '#FEF3F3',
  },
  roleIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FCEBEB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  roleIconWrapActive: {
    backgroundColor: '#C8000A',
  },
  roleLabel: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a' },
  roleLabelActive: { color: '#A32D2D' },
  roleCheck: { position: 'absolute', top: 10, right: 10 },

  button: {
    marginTop: 28,
    backgroundColor: '#C8000A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
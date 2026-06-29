import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const EXCLUDED_KEYS = ['_id', '__v', 'Site_Engineer_Signature', 'Customer_Confirmation_Signature', 'ebBillPhotos', 'sitePhotos'];

const prettyKey = key =>
  key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

const prettyValue = val => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.length ? val.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') : '—';
  if (typeof val === 'object') {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#C8000A',
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 14, marginTop: 14,
    borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F2F2F2',
  },
  rowKey: { width: 130, fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowVal: { flex: 1, fontSize: 13.5, color: '#1a1a1a', fontWeight: '500', lineHeight: 19 },
  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyText: { color: '#bbb', fontSize: 13, marginTop: 10 },
});

const LeadFullDetailsScreen = ({ navigation, route }) => {
  const lead = route?.params?.lead || {};
  const entries = Object.entries(lead).filter(
    ([key, val]) => !EXCLUDED_KEYS.includes(key) && typeof val !== 'function'
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar backgroundColor="#C8000A" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Full Lead Details</Text>
          <Text style={styles.headerSub}>{entries.length} field{entries.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-outline" size={44} color="#ddd" />
            <Text style={styles.emptyText}>No details available.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {entries.map(([key, val], idx) => (
              <View key={key} style={[styles.row, idx === entries.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.rowKey}>{prettyKey(key)}</Text>
                <Text style={styles.rowVal}>{prettyValue(val)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default LeadFullDetailsScreen;
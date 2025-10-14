import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';

type R = RouteProp<RootStackParamList, 'Detail'>;

export default function PanelDetailScreen() {
  const route = useRoute<R>();
  const id = route.params?.id ?? 'unknown';

  return (
    <View style={styles.safe}>
      <Header title={`Panel • ${id}`} back />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.title}>Performance Overview</Text>
        </View>

        <View style={styles.row}>
          <StatCard title="Today" value="28.3 kWh" subtitle="Generation" accent="#10B981" small />
          <StatCard title="This Month" value="842 kWh" subtitle="Est. yield" accent="#06B6D4" small />
        </View>

        <View style={styles.chartPlaceholder}>
          <Text style={{ color: '#94A3B8' }}>Graph placeholder — insert chart (recharts / victory-native)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.kv}>
            <Text style={styles.k}>Status</Text>
            <Text style={styles.v}>Online • No faults</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.k}>Installed</Text>
            <Text style={styles.v}>2023-06-12</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.k}>Location</Text>
            <Text style={styles.v}>Rooftop — Block A</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  chartPlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EEF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  k: { color: '#475569' },
  v: { color: '#0F172A', fontWeight: '600' },
});

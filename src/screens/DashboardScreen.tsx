import React from 'react';
import { View, StyleSheet, FlatList, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import PanelListItem from '../components/PanelListItem';
import { useNavigation } from '@react-navigation/native';

const SAMPLE_PANELS = [
  { id: 'p1', name: 'Roof Array A', power: '5.4 kW', status: 'Good', today: '28.3 kWh' },
  { id: 'p2', name: 'Carport B', power: '3.2 kW', status: 'Good', today: '17.2 kWh' },
  { id: 'p3', name: 'Field C', power: '12.0 kW', status: 'Check', today: '45.0 kWh' },
];

export default function DashboardScreen() {
  const nav = useNavigation();

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="Kondaas — Dashboard" />
      <View style={styles.container}>
        <View style={styles.statsRow}>
          <StatCard title="Today" value="90.5 kWh" subtitle="Total generation" accent="#10B981" />
          <StatCard title="Power" value="20.6 kW" subtitle="Current output" accent="#F59E0B" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Arrays</Text>
          <FlatList
            data={SAMPLE_PANELS}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => nav.navigate('Detail' as any, { id: item.id })}>
                <PanelListItem {...item} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { paddingHorizontal: 16, paddingTop: 8, flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PanelListItem({ id, name, power, status, today }: { id: string; name: string; power: string; status: string; today: string; }) {
  const statusColor = status === 'Good' ? '#10B981' : status === 'Check' ? '#F59E0B' : '#EF4444';
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.thumb} />
      </View>
      <View style={styles.center}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>{power} • {today}</Text>
      </View>
      <View style={styles.right}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.status}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, elevation: 1 },
  left: { marginRight: 12 },
  thumb: { width: 56, height: 42, borderRadius: 8, backgroundColor: '#E6EEF8' },
  center: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  meta: { fontSize: 12, color: '#64748B' },
  right: { alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 12, marginBottom: 6 },
  status: { fontSize: 12, color: '#475569' },
});

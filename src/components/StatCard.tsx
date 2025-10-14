import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function StatCard({ title, value, subtitle, accent, small = false }: { title: string; value: string; subtitle?: string; accent?: string; small?: boolean; }) {
  return (
    <View style={[styles.card, small ? styles.small : null]}>
      <View style={[styles.accent, { backgroundColor: accent ?? '#06B6D4' }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOpacity: 0.03, elevation: 1, width: '48%' },
  small: { paddingVertical: 10 },
  accent: { width: 8, height: '100%', borderRadius: 8, marginRight: 12 },
  content: { flex: 1 },
  title: { fontSize: 12, color: '#475569' },
  value: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#94A3B8' },
});

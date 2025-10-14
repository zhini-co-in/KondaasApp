import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import Header from '../components/Header';
import { useState } from 'react';

export default function SettingsScreen() {
  const [dark, setDark] = useState(false);
  return (
    <View style={styles.safe}>
      <Header title="Settings" back />
      <View style={styles.container}>
        <View style={styles.row}>
          <Text style={styles.label}>Dark mode</Text>
          <Switch value={dark} onValueChange={setDark} />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Notifications</Text>
          <Switch value={true} onValueChange={() => {}} />
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={{ color: '#64748B' }}>Account & app settings go here.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  label: { fontSize: 16, color: '#0F172A' },
});

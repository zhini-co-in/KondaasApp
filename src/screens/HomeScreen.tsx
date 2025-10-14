import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store/useStore';

export default function HomeScreen() {
  const nav = useNavigation();
  const setToken = useStore((s) => s.setToken);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kondaas — Home</Text>
      <Button title="Go detail" onPress={() => nav.navigate('Detail' as any, { id: '123' })} />
      <Button title="Set demo token" onPress={() => setToken('demo-token')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  title: { fontSize: 20, marginBottom: 12 },
});

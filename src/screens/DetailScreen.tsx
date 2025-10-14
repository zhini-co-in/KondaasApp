import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';

type R = RouteProp<RootStackParamList, 'Detail'>;

export default function DetailScreen() {
  const route = useRoute<R>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Detail: {route.params?.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20 },
});

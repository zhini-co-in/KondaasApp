import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from 'react-native-vector-icons';

export default function Header({ title = '', back = false }: { title?: string; back?: boolean }) {
  const nav = useNavigation();
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {back ? (
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.back}>{'‹'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#fff' },
  left: { position: 'absolute', left: 12 },
  right: { position: 'absolute', right: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  back: { fontSize: 28, color: '#0F172A' },
});

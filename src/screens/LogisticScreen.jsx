import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, FlatList } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';

const DUMMY_ORDERS = [
  { id: '001', customer: 'Ravi Kumar', location: 'Chennai', status: 'Pending', date: '2025-05-20' },
  { id: '002', customer: 'Meena S', location: 'Coimbatore', status: 'In Transit', date: '2025-05-21' },
  { id: '003', customer: 'Arjun P', location: 'Madurai', status: 'Delivered', date: '2025-05-22' },
  { id: '004', customer: 'Priya R', location: 'Salem', status: 'Pending', date: '2025-05-23' },
];

const STATUS_COLOR = {
  'Pending':    '#f59e0b',
  'In Transit': '#3b82f6',
  'Delivered':  '#10b981',
};

const LogisticScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('All');

  const handleLogout = async () => {
    await AsyncStorage.removeItem(USER_DATA);
    navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN}] });
  };

  const filtered = filter === 'All'
    ? DUMMY_ORDERS
    : DUMMY_ORDERS.filter(o => o.status === filter);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={['#F00001', '#B00100']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <Text style={styles.headerTitle}>Logistics</Text>
          <Text style={styles.headerSub}>Track & manage deliveries</Text>
        </SafeAreaView>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['All', 'Pending', 'In Transit', 'Delivered'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderTop}>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
                  {item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.customerName}>👤 {item.customer}</Text>
            <Text style={styles.orderInfo}>📍 {item.location}   📅 {item.date}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No orders found</Text>}
      />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

export default LogisticScreen;

const styles = StyleSheet.create({
  header:          { paddingHorizontal: 20, paddingBottom: 25, paddingTop: 10 },
  headerTitle:     { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 10 },
  headerSub:       { fontSize: 13, color: '#ffcccc', marginTop: 4 },
  filterRow:       { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, elevation: 2 },
  filterTab:       { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, marginHorizontal: 3 },
  filterTabActive: { backgroundColor: '#F00001' },
  filterText:      { fontSize: 11, color: '#555', fontWeight: '500' },
  filterTextActive:{ color: '#fff' },
  orderCard:       { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  orderTop:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderId:         { fontWeight: '700', fontSize: 14, color: '#1A1A1A' },
  statusBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText:      { fontSize: 11, fontWeight: '600' },
  customerName:    { fontSize: 14, color: '#333', marginBottom: 4 },
  orderInfo:       { fontSize: 12, color: '#888' },
  emptyText:       { textAlign: 'center', color: '#aaa', marginTop: 40 },
  logoutBtn:       { backgroundColor: '#F00001', margin: 16, borderRadius: 10, padding: 14, alignItems: 'center' },
  logoutText:      { color: '#fff', fontWeight: '600', fontSize: 15 },
});
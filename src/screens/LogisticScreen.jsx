import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  StatusBar, 
  FlatList,
  Modal,
  Animated,
  Dimensions
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';

const { width, height } = Dimensions.get('window');

const DUMMY_ORDERS = [
  { id: '001', customer: 'Ravi Kumar', location: 'Chennai', status: 'Pending', date: '2025-05-20', items: 5 },
  { id: '002', customer: 'Meena S', location: 'Coimbatore', status: 'In Transit', date: '2025-05-21', items: 3 },
  { id: '003', customer: 'Arjun P', location: 'Madurai', status: 'Delivered', date: '2025-05-22', items: 8 },
  { id: '004', customer: 'Priya R', location: 'Salem', status: 'Pending', date: '2025-05-23', items: 2 },
];

const STATUS_CONFIG = {
  'Pending': { color: '#f59e0b', icon: 'clock-outline', bgColor: '#fff3cd' },
  'In Transit': { color: '#3b82f6', icon: 'truck-fast', bgColor: '#cfe2ff' },
  'Delivered': { color: '#10b981', icon: 'check-circle-outline', bgColor: '#d1e7dd' },
};

const LogisticScreen = ({ navigation }) => {
  const [filter, setFilter] = useState('All');
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const scaleAnim = new Animated.Value(0);

  // Animation for modal
  React.useEffect(() => {
    if (showLogoutPopup) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 12,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [showLogoutPopup]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(USER_DATA);
      setShowLogoutPopup(false);
      navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
    } catch (error) {
      console.log("❌ Logout error:", error);
    }
  };

  const handleCancelLogout = () => {
    setShowLogoutPopup(false);
  };

  const filtered = filter === 'All'
    ? DUMMY_ORDERS
    : DUMMY_ORDERS.filter(o => o.status === filter);

  const STATS = [
    { label: 'Total Orders', value: DUMMY_ORDERS.length, icon: 'package-variant', color: '#3b82f6' },
    { label: 'Pending', value: DUMMY_ORDERS.filter(o => o.status === 'Pending').length, icon: 'alert-circle-outline', color: '#f59e0b' },
    { label: 'Delivered', value: DUMMY_ORDERS.filter(o => o.status === 'Delivered').length, icon: 'check-all', color: '#10b981' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      {/* Premium Header */}
      <LinearGradient
        colors={['#F00001', '#B00100', '#8B0000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Logistics Hub</Text>
              <Text style={styles.headerSub}>🚚 Track & Manage Deliveries</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.badgeText}>{DUMMY_ORDERS.length}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        {STATS.map((stat, index) => (
          <LinearGradient
            key={index}
            colors={[stat.color + '15', stat.color + '05']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
              <MaterialCommunityIcons name={stat.icon} size={24} color={stat.color} />
            </View>
            <View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          </LinearGradient>
        ))}
      </View>

      {/* Premium Filter Tabs */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Status</Text>
        <View style={styles.filterRow}>
          {['All', 'Pending', 'In Transit', 'Delivered'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, filter === tab && styles.filterTabActive]}
              onPress={() => setFilter(tab)}
            >
              <View style={[styles.filterDot, filter === tab && styles.filterDotActive]} />
              <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        scrollIndicatorInsets={{ right: 1 }}
        renderItem={({ item }) => {
          const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG['Pending'];
          return (
            <View style={styles.orderCardWrapper}>
              <LinearGradient
                colors={['#ffffff', '#f9fafb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.orderCard}
              >
                {/* Top Section */}
                <View style={styles.orderTop}>
                  <View>
                    <Text style={styles.orderId}>Order #{item.id}</Text>
                    <Text style={styles.orderItems}>{item.items} items</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <MaterialCommunityIcons name={statusConfig.icon} size={16} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.infoRow}>
                  <Ionicons name="person-circle-outline" size={20} color="#64748b" />
                  <Text style={styles.customerName}>{item.customer}</Text>
                </View>

                {/* Location & Date */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color="#f59e0b" />
                    <Text style={styles.detailText}>{item.location}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={16} color="#3b82f6" />
                    <Text style={styles.detailText}>{item.date}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: item.status === 'Delivered' ? '100%' : item.status === 'In Transit' ? '66%' : '33%', backgroundColor: statusConfig.color }]} />
                </View>
              </LinearGradient>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant-closed" size={60} color="#cbd5e1" />
            <Text style={styles.emptyText}>No orders found</Text>
            <Text style={styles.emptySubText}>Try changing the filter</Text>
          </View>
        }
      />

      {/* Premium Logout Button */}
      <View style={styles.logoutButtonContainer}>
        <LinearGradient
          colors={['#F00001', '#d42f2f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoutButtonGradient}
        >
          <TouchableOpacity 
            style={styles.logoutBtn} 
            onPress={() => setShowLogoutPopup(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Premium Logout Modal */}
      <Modal
        transparent
        visible={showLogoutPopup}
        animationType="fade"
        onRequestClose={handleCancelLogout}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [{ scale: scaleAnim }],
                opacity: scaleAnim,
              }
            ]}
          >
            {/* Icon with glow effect */}
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#F00001', '#d42f2f']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="log-out-outline" size={50} color="#fff" />
              </LinearGradient>
            </View>

            {/* Content */}
            <View style={styles.modalTextContainer}>
              <Text style={styles.modalTitle}>Logout Confirmation</Text>
              <Text style={styles.modalSubtitle}>Are you sure you want to logout?</Text>
              <Text style={styles.modalMessage}>
                You will need to login again to access your logistics dashboard.
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              {/* Cancel Button */}
              <LinearGradient
                colors={['#f3f4f6', '#e5e7eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cancelBtnGradient}
              >
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancelLogout}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-outline" size={20} color="#374151" />
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </LinearGradient>

              {/* OK Button */}
              <LinearGradient
                colors={['#F00001', '#d42f2f']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.okBtnGradient}
              >
                <TouchableOpacity 
                  style={styles.okButton}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-outline" size={20} color="#fff" />
                  <Text style={styles.okText}>Logout</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

export default LogisticScreen;

const styles = StyleSheet.create({
  // Header
  header: { paddingTop: 10, paddingBottom: 30 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#ffcccc', marginTop: 4, fontWeight: '500' },
  headerBadge: { width: 50, height: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  badgeText: { fontSize: 18, fontWeight: '700', color: '#fff' },

  // Stats
  statsContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 16, gap: 10 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#000' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Filter
  filterContainer: { paddingHorizontal: 16, paddingVertical: 12 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  filterTabActive: { backgroundColor: '#F00001', borderColor: '#d42f2f' },
  filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1', marginRight: 6 },
  filterDotActive: { backgroundColor: '#fff' },
  filterText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },

  // Order Card
  orderCardWrapper: { marginHorizontal: 4, marginVertical: 8 },
  orderCard: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontWeight: '700', fontSize: 16, color: '#1a1a1a' },
  orderItems: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Info
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  customerName: { fontSize: 14, color: '#374151', fontWeight: '500' },

  // Details
  detailsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  detailText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  // Progress
  progressContainer: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 2 },

  // Empty
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },

  // Logout Button
  logoutButtonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  logoutButtonGradient: { borderRadius: 12, overflow: 'hidden' },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 10 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: width * 0.85, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 },

  // Modal Icon
  iconContainer: { marginBottom: 20 },
  iconGradient: { width: 70, height: 70, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Modal Text
  modalTextContainer: { alignItems: 'center', marginBottom: 28 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  modalSubtitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginBottom: 12 },
  modalMessage: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },

  // Modal Buttons
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtnGradient: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  cancelButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 8 },
  cancelText: { color: '#374151', fontWeight: '600', fontSize: 15 },

  okBtnGradient: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  okButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 8 },
  okText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
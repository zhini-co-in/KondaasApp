import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Alert,
  Platform,
  RefreshControl,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { NativeModules } from 'react-native';

import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';
import {
  useInstallerTracking,
  requestLocationPermissions,
  requestIOSLocationPermission,
  isGPSEnabled,
  startHighFrequencyTracking,
  stopHighFrequencyTracking,
} from '../service/InstallerService';

const { width } = Dimensions.get('window');
const STORAGE_KEY = 'installer_is_on';

const InstallerScreen = ({ navigation }) => {
  const isMounted = useRef(true);
  const { currentLocation, startTracking, stopTracking } = useInstallerTracking(isMounted);
  const locationRef = useRef(null);

  const [isAvailable, setIsAvailable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('received');

  const [warehouseReceived, setWarehouseReceived] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [installedProducts, setInstalledProducts] = useState([]);

  const [showReceivedModal, setShowReceivedModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  // Scanner states (LogisticScreen style)
  const [currentView, setCurrentView] = useState('scanner');
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState(null);

  const device = useCameraDevice('back');
  const lastScanTime = useRef(0);

  // Sync locationRef
  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  // Load initial toggle state
  useEffect(() => {
    const loadToggleState = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'true') {
          setIsAvailable(true);
          startTracking();
        }
      } catch (e) {}
    };
    loadToggleState();
  }, []);

  // Load saved products
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await AsyncStorage.getItem('DELIVERED_TO_WAREHOUSE');
        if (data) {
          const parsed = JSON.parse(data);
          setWarehouseReceived(parsed.products || []);
        }
      } catch (e) {}
    };
    loadData();
  }, []);

  const saveToStorage = async (data) => {
    try {
      await AsyncStorage.setItem('DELIVERED_TO_WAREHOUSE', JSON.stringify({ products: data }));
    } catch (e) {}
  };

  const handleToggle = async () => {
    if (!isAvailable) {
      // TURN ON
      if (Platform.OS === 'android') {
        try {
          const gpsOn = await isGPSEnabled();
          if (!gpsOn) {
            Alert.alert('GPS Off', 'Please turn on GPS to continue.', [
              { text: 'Open Settings', onPress: () => Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS') },
              { text: 'Cancel', style: 'cancel' },
            ]);
            return;
          }
          const granted = await requestLocationPermissions();
          if (!granted) return;
          NativeModules.StartStopService?.startService();
        } catch (e) {
          console.error(e);
          return;
        }
      } else if (Platform.OS === 'ios') {
        const granted = await requestIOSLocationPermission();
        if (!granted) return;
      }

      setIsAvailable(true);
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      startTracking();
      startHighFrequencyTracking?.();
    } else {
      // TURN OFF
      setIsAvailable(false);
      await AsyncStorage.setItem(STORAGE_KEY, 'false');
      stopTracking();
      stopHighFrequencyTracking?.();
      if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    }
  };

  // LogisticScreen-style inline scanner
  const handleLogout = async () => {
    stopTracking();
    stopHighFrequencyTracking?.();
    if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    await AsyncStorage.removeItem(USER_DATA);
    setShowLogoutPopup(false);
    navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'code-128', 'qr', 'upc-a', 'code-39', 'ean-8', 'data-matrix'],
    onCodeScanned: useCallback(
      (codes) => {
        if (codes.length === 0 || !isScanning) return;

        const now = Date.now();
        if (now - lastScanTime.current < 600) return;
        lastScanTime.current = now;

        const scannedCode = codes[0].value?.trim();
        if (!scannedCode) return;

        setIsScanning(false);

        const newItem = {
          orderId: scannedCode,
          product: 'Scanned Item',
          price: '₹0',
          mfgDate: new Date().toLocaleDateString('en-GB'),
          scannedAt: new Date().toISOString(),
        };

        setScannedData(newItem);
        setWarehouseReceived((prev) => {
          const updated = [newItem, ...prev];
          saveToStorage(updated);
          return updated;
        });
      },
      [isScanning],
    ),
  });

  const handleRescan = () => {
    setScannedData(null);
    setIsScanning(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshing(false);
  }, []);

  const openReceivedModal = (product) => {
    setSelectedProduct(product);
    setShowReceivedModal(true);
  };

  const startInstallation = () => {
    if (!selectedProduct) return;
    setInProgress((prev) => [...prev, selectedProduct]);
    const updated = warehouseReceived.filter((p) => p.orderId !== selectedProduct.orderId);
    setWarehouseReceived(updated);
    saveToStorage(updated);
    setShowReceivedModal(false);
    Alert.alert('Success', 'Moved to In Progress');
  };

  const markProductFinished = (product) => {
    setInstalledProducts((prev) => [...prev, product]);
    setInProgress((prev) => prev.filter((p) => p.orderId !== product.orderId));
    Alert.alert('Success', 'Installation Completed');
  };

  const filteredProducts = () => {
    switch (activeTab) {
      case 'received': return warehouseReceived;
      case 'inprogress': return inProgress;
      case 'completed': return installedProducts;
      default: return [...warehouseReceived, ...inProgress, ...installedProducts];
    }
  };

  const renderProductCard = (item) => {
    const isReceived = warehouseReceived.some((p) => p.orderId === item.orderId);
    const isProgress = inProgress.some((p) => p.orderId === item.orderId);
    const isCompleted = installedProducts.some((p) => p.orderId === item.orderId);

    return (
      <TouchableOpacity
        key={item.orderId}
        style={styles.productCard}
        onPress={() => isReceived && openReceivedModal(item)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{item.product}</Text>
          <Text style={styles.orderId}>Barcode: {item.orderId}</Text>
          <Text style={styles.mfgDate}>Scanned: {item.mfgDate}</Text>
        </View>

        {isReceived && <Ionicons name="chevron-forward" size={24} color="#999" />}
        {isProgress && (
          <TouchableOpacity style={styles.finishBtn} onPress={() => markProductFinished(item)}>
            <Text style={styles.finishText}>Mark Finished</Text>
          </TouchableOpacity>
        )}
        {isCompleted && <Ionicons name="checkmark-circle" size={28} color="#10b981" />}
      </TouchableOpacity>
    );
  };

  // ==================== OFF STATE ====================
  if (!isAvailable) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Text style={styles.pageTitle}>Installer Dashboard</Text>

          <View style={styles.profileRow}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={28} color="#888" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.profileName}>Installer</Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggle}
              trackColor={{ false: '#ccc', true: '#F00001' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome!</Text>
            <Text style={styles.welcomeSub}>Turn on availability to start tracking and installations</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ==================== ON STATE ====================
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#F00001" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerRow}>
            {/* Left: Logout */}
            <TouchableOpacity onPress={() => setShowLogoutPopup(true)} style={styles.logoutIconBtn}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.title}>Installer Dashboard</Text>

            <View style={styles.userSection}>
              <Text style={styles.userName}>User</Text>
              <View style={styles.avatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <Switch
                value={isAvailable}
                onValueChange={handleToggle}
                trackColor={{ false: '#666', true: '#4ade80' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Top Tabs: Scanner | Products */}
      <View style={styles.topTabRow}>
        {['scanner', 'products'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.topTabBtn, currentView === tab && styles.topTabBtnActive]}
            onPress={() => setCurrentView(tab)}
          >
            <Text style={[styles.topTabText, currentView === tab && styles.topTabTextActive]}>
              {tab === 'scanner' ? 'Scanner' : 'Products'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F00001']} />}
      >
        {/* ── SCANNER TAB ── */}
        {currentView === 'scanner' && (
          <>
            {/* Inline Camera Box */}
            <View style={styles.cameraBox}>
              {device && !cameraError ? (
                <Camera
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={isScanning}
                  codeScanner={codeScanner}
                  onError={(error) => setCameraError(error.message)}
                />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color="#aaa" />
                  <Text style={{ color: '#aaa', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
                    {cameraError || 'No camera device found'}
                  </Text>
                </View>
              )}

              {/* Scan frame corners */}
              <View style={styles.scanFrameContainer}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
              </View>

              <View style={styles.scanLabel}>
                <Text style={{ color: '#fff', fontSize: 12 }}>
                  {isScanning ? 'Align QR / Barcode within frame' : '✓ Scan successful'}
                </Text>
              </View>
            </View>

            {/* Location Badge */}
            {locationRef.current && (
              <View style={styles.locationBadge}>
                <Ionicons name="location" size={14} color="#22c55e" />
                <Text style={styles.locationBadgeText}>
                  {locationRef.current.latitude.toFixed(5)},{' '}
                  {locationRef.current.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            {/* Scanned result card */}
            {scannedData && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="barcode-scan" size={32} color="#3b82f6" />
                    <View>
                      <Text style={styles.productName}>{scannedData.product}</Text>
                      <Text style={styles.orderId}>{scannedData.orderId}</Text>
                    </View>
                  </View>
                  <View style={styles.scannedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                    <Text style={styles.scannedText}>Scanned</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Scan Again */}
            <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan}>
              <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.rescanGradient}>
                <Ionicons name="scan-outline" size={18} color="#fff" />
                <Text style={styles.rescanText}>Scan Again</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {/* ── PRODUCTS TAB ── */}
        {currentView === 'products' && (
          <>
            {/* Sub Tabs */}
            <View style={styles.tabBar}>
              {[
                { key: 'all', label: 'All' },
                { key: 'received', label: 'Received' },
                { key: 'inprogress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, activeTab === t.key && styles.activeTab]}
                  onPress={() => setActiveTab(t.key)}
                >
                  <Text style={[styles.tabText, activeTab === t.key && styles.activeTabText]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredProducts().length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={80} color="#ddd" />
                <Text style={styles.emptyText}>No items yet</Text>
              </View>
            ) : (
              filteredProducts().map(renderProductCard)
            )}
          </>
        )}
      </ScrollView>

      {/* Received Modal */}
      <Modal visible={showReceivedModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📦 Received at Warehouse</Text>
            {selectedProduct && (
              <View style={styles.modalProductInfo}>
                <Text style={styles.modalProductName}>{selectedProduct.product}</Text>
                <Text>Barcode: {selectedProduct.orderId}</Text>
                <Text>Scanned: {selectedProduct.mfgDate}</Text>
              </View>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReceivedModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={startInstallation}>
                <Text style={styles.acceptText}>Accept & Start Installation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        transparent
        visible={showLogoutPopup}
        animationType="fade"
        onRequestClose={() => setShowLogoutPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogoutPopup(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: '#F00001' }]} onPress={handleLogout}>
                <Text style={styles.acceptText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Header
  header: { backgroundColor: '#F00001' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  logoutIconBtn: { padding: 4 },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  userName: { color: '#fff', fontWeight: '600' },

  // Off screen
  pageTitle: { fontSize: 18, color: '#1a1a1a', fontWeight: '600', paddingHorizontal: 16, paddingVertical: 12 },
  profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  profileLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 16, fontWeight: '700' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  welcomeText: { fontSize: 24, fontWeight: '700', color: '#333', marginBottom: 8 },
  welcomeSub: { fontSize: 15, color: '#F00001', textAlign: 'center' },

  // Top view tabs (Scanner | Products)
  topTabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e8e8e8' },
  topTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  topTabBtnActive: { borderBottomWidth: 2, borderColor: '#F00001' },
  topTabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  topTabTextActive: { color: '#F00001', fontWeight: '700' },

  // Scroll
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Camera (LogisticScreen style)
  cameraBox: {
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 14,
    position: 'relative',
  },
  cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2a2a2a' },
  scanFrameContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -80 }],
  },
  scanFrame: { width: 160, height: 160 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLabel: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },

  // Location badge
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationBadgeText: { fontSize: 12, color: '#16a34a', fontWeight: '500' },

  // Scanned result card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scannedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scannedText: { fontSize: 11, color: '#22c55e', fontWeight: '600' },

  // Rescan button
  rescanBtn: { marginBottom: 14, borderRadius: 10, overflow: 'hidden' },
  rescanGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  rescanText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Sub tabs (All / Received / In Progress / Completed)
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 4, borderRadius: 12, elevation: 3, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#F00001' },
  tabText: { fontWeight: '600', color: '#666', fontSize: 12 },
  activeTabText: { color: '#fff' },

  // Product card
  productCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
  },
  productName: { fontSize: 16, fontWeight: '700' },
  orderId: { fontSize: 14, color: '#3b82f6', marginVertical: 2 },
  mfgDate: { fontSize: 13, color: '#64748b' },
  finishBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  finishText: { color: '#fff', fontWeight: '600' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 16 },

  // Received Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '90%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  modalProductInfo: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, marginBottom: 20 },
  modalProductName: { fontSize: 18, fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  acceptBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center' },
  cancelText: { color: '#64748b', fontWeight: '600' },
  acceptText: { color: '#fff', fontWeight: '600' },
});

export default InstallerScreen;
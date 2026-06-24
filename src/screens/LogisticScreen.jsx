import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Switch,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Modal,
  Dimensions,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  useCameraPermission,
} from 'react-native-vision-camera';
import { NativeModules } from 'react-native';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';
import {
  useLogisticTracking,
  requestLocationPermissions,
  requestIOSLocationPermission,
  isGPSEnabled,
  startHighFrequencyTracking,
  stopHighFrequencyTracking,
} from '../service/logisticService';
import { saveScannedProduct, confirmDeliveryToWarehouse, getScannedProducts } from '../service/logisticProductService';

const LogisticScreen = ({ navigation }) => {
  const isMounted = useRef(true);
  const { currentLocation, startTracking, stopTracking } = useLogisticTracking(isMounted);
  const locationRef = useRef(null);
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isAvailable, setIsAvailable] = useState(false);
  const [currentView, setCurrentView] = useState('scanner');
  const [cameraError, setCameraError] = useState(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [scannedProducts, setScannedProducts] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  const [trackingSteps, setTrackingSteps] = useState([
    { id: 1, label: 'Product Scanned', sub: '', time: '', done: false },
    { id: 2, label: 'Picked from Warehouse', sub: '', time: '', done: false },
    { id: 3, label: 'Delivered to Warehouse', sub: '', time: '', done: false },
  ]);

  const device = useCameraDevice('back');
  const lastScanTime = useRef(0);

  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    isMounted.current = true;
    restoreState();
    setTimeout(() => {
      checkCameraPermission();
    }, 800);
    return () => {
      isMounted.current = false;
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      if (hasPermission === true) {
        setCameraPermissionGranted(true);
        return;
      }
      const result = await requestPermission();
      setCameraPermissionGranted(result);
      if (!result) {
        Alert.alert(
          'Camera Permission Required',
          'This app needs camera permission to scan QR codes and barcodes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.log('[Camera Permission Error]:', error);
    }
  };

  const restoreState = async () => {
    try {
      const saved = await AsyncStorage.getItem('logistic_is_on');
      if (saved === 'true') {
        setIsAvailable(true);
        if (Platform.OS === 'android') NativeModules.StartStopService?.startService();
        startTracking();
      }
    } catch (e) {
      console.log('[LogisticScreen] restoreState error:', e);
    }
  };

  // ✅ புதுசா add பண்ணு
useEffect(() => {
  const loadExistingPickedProducts = async () => {
    try {
      const res = await getScannedProducts();
      const picked = res.filter((p) => p.status === 'picked');

      if (picked.length > 0) {
        const mapped = picked.map((item) => ({
          _id: item._id,
          rawCode: item.rawValue || '',
          displayText: item.rawValue?.split('\n')[0] || 'Unknown Product',
        }));

        setScannedProducts(mapped);
        console.log('📦 Restored picked products:', mapped.length);

        setTrackingSteps([
          {
            id: 1,
            label: 'Product Scanned',
            sub: `${mapped.length} Product${mapped.length > 1 ? 's' : ''} Scanned`,
            time: '',
            done: true,
          },
          {
            id: 2,
            label: 'Picked from Warehouse',
            sub: 'Restored from previous session',
            time: '',
            done: true,
          },
          {
            id: 3,
            label: 'Delivered to Drop Warehouse',
            sub: 'Waiting to reach drop location...',
            time: '',
            done: false,
          },
        ]);
      }
    } catch (e) {
      console.error('loadExistingPickedProducts error:', e);
    }
  };

  loadExistingPickedProducts();
}, []);

///////////////refresh//////////////////
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const handleToggle = async () => {
    if (!isAvailable) {
      if (Platform.OS === 'android') {
        try {
          const gpsOn = await isGPSEnabled();
          if (!gpsOn) {
            Alert.alert('Location is Off', 'Please turn on GPS.', [
              {
                text: 'Open Settings',
                onPress: () => Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS'),
              },
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
      await AsyncStorage.setItem('logistic_is_on', 'true');
      startTracking();
    } else {
      setIsAvailable(false);
      await AsyncStorage.setItem('logistic_is_on', 'false');
      stopTracking();
      stopHighFrequencyTracking();
      if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    }
  };

  // ==================== SCANNER LOGIC ====================
  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix', 'aztec'],
    onCodeScanned: useCallback(
      (codes) => {
        if (codes.length === 0 || !isScanning) return;
        const now = Date.now();
        if (now - lastScanTime.current < 600) return;
        lastScanTime.current = now;
        const value = codes[0].value?.trim();
        if (!value) return;
        setIsScanning(false);
        const scannedItem = { rawCode: value, displayText: value };
        setScannedProducts((prev) => [...prev, scannedItem]);
        setScannedData(scannedItem);

        // Save to backend and update _id
        saveScannedProduct(value, locationRef.current).then((saved) => {
          if (saved?._id || saved?.id) {
            const id = saved._id || saved.id;
            setScannedProducts((prev) =>
              prev.map((p) => p.rawCode === value && !p._id ? { ...p, _id: id } : p)
            );
          }
        });
        updateToPickedFromWarehouse();
      },
      [isScanning]
    ),
  });

  const updateToPickedFromWarehouse = () => {
    const total = scannedProducts.length + 1;
    setIsCompleted(false);
    setTrackingSteps([
      {
        id: 1,
        label: 'Product Scanned',
        sub: `${total} Product${total > 1 ? 's' : ''} Scanned`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        done: true,
      },
      {
        id: 2,
        label: 'Picked from Warehouse',
        sub: `Location: ${currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'Chennai Warehouse'}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        done: true,
      },
      {
        id: 3,
        label: 'Delivered to Drop Warehouse',
        sub: 'Waiting to reach drop location...',
        time: '',
        done: false,
      },
    ]);
  };

  // ✅ markAsDelivered — confirmDeliveryToWarehouse call pannudu
  const markAsDelivered = async () => {
    if (scannedProducts.length === 0) {
      Alert.alert('No Products', 'Please scan at least one product');
      return;
    }

    setIsCompleted(true);

    // UI Update
    setTrackingSteps((prev) =>
      prev.map((step) =>
        step.id === 3
          ? {
              ...step,
              sub: `Delivered at ${
                currentLocation
                  ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                  : 'Warehouse'
              }`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              done: true,
            }
          : step
      )
    );

    // ✅ DB status → "dropped"
    try {
      await confirmDeliveryToWarehouse(scannedProducts);
      console.log('✅ Delivery confirmed in DB');
    } catch (e) {
      console.error('❌ confirmDeliveryToWarehouse failed:', e);
    }

    Alert.alert('Success', 'Products Delivered to Warehouse');

    setTimeout(() => {
      setScannedProducts([]);
      setScannedData(null);
      setIsCompleted(false);
      setTrackingSteps([
        { id: 1, label: 'Product Scanned', sub: '', time: '', done: false },
        { id: 2, label: 'Picked from Warehouse', sub: '', time: '', done: false },
        { id: 3, label: 'Delivered to Warehouse', sub: '', time: '', done: false },
      ]);
    }, 1200);
  };

  const handleRescan = () => {
    setScannedData(null);
    setIsScanning(true);
  };

  const handleLogout = async () => {
    stopTracking();
    stopHighFrequencyTracking();
    if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    await AsyncStorage.removeItem(USER_DATA);
    setShowLogoutPopup(false);
    navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
  };

  if (!isAvailable) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Text style={styles.pageTitle}>Logistic Dashboard</Text>
          <View style={styles.profileRow}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={28} color="#888" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.profileName}>Logistic</Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggle}
              trackColor={{ false: '#ccc', true: '#F00001' }}
              thumbColor="#fff"
            />
          </View>
          <LinearGradient colors={['#F00001', '#B00100']} style={styles.logoBanner}>
            <Image
              source={require('../../assets/images/kondass.png')}
              style={{ width: 160, height: 70 }}
              resizeMode="contain"
            />
          </LinearGradient>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome!</Text>
            <Text style={styles.welcomeSub}>Let's get started! Turn on availability!</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Logistic Dashboard</Text>
          <View style={styles.profileRowSmall}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={20} color="#888" />
            </View>
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.profileNameSmall}>User</Text>
              <Text style={styles.profileRoleSmall}>Logistic</Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggle}
              trackColor={{ false: '#ccc', true: '#F00001' }}
              thumbColor="#fff"
              style={{ marginLeft: 12 }}
            />
          </View>
        </View>

        <View style={styles.tabRow}>
          {['scanner', 'tracking'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, currentView === tab && styles.tabBtnActive]}
              onPress={() => setCurrentView(tab)}
            >
              <Text style={[styles.tabText, currentView === tab && styles.tabTextActive]}>
                {tab === 'scanner' ? 'Scanner' : 'Tracking'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F00001']} />
          }
        >
          {currentView === 'scanner' && (
            <>
              <View style={styles.cameraBox}>
                {device && cameraPermissionGranted && !cameraError ? (
                  <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={isScanning}
                    codeScanner={codeScanner}
                    onError={(error) => setCameraError(error.message)}
                  />
                ) : (
                  <View style={styles.cameraPlaceholder}>
                    <Ionicons name="camera-off-outline" size={50} color="#aaa" />
                    <Text style={{ color: '#aaa', marginTop: 12, fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }}>
                      {cameraError || !cameraPermissionGranted
                        ? 'Camera permission is required to scan QR / Barcode'
                        : 'No camera device found'}
                    </Text>
                    {!cameraPermissionGranted && (
                      <TouchableOpacity
                        style={[styles.rescanBtn, { marginTop: 20, marginHorizontal: 40 }]}
                        onPress={checkCameraPermission}
                      >
                        <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.rescanGradient}>
                          <Text style={styles.rescanText}>Grant Camera Permission</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
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

              {locationRef.current && (
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={14} color="#22c55e" />
                  <Text style={styles.locationBadgeText}>
                    {locationRef.current.latitude.toFixed(5)},{' '}
                    {locationRef.current.longitude.toFixed(5)}
                  </Text>
                </View>
              )}

              {scannedData && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialCommunityIcons name="barcode-scan" size={32} color="#3b82f6" />
                      <View>
                        <Text style={styles.productName}>{scannedData.displayText}</Text>
                        <Text style={styles.productId}>{scannedData.rawCode}</Text>
                      </View>
                    </View>
                    <View style={styles.scannedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.scannedText}>Scanned</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan}>
                <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.rescanGradient}>
                  <Ionicons name="scan-outline" size={18} color="#fff" />
                  <Text style={styles.rescanText}>Scan Again</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {currentView === 'tracking' && (
            <>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="package-variant" size={32} color="#3b82f6" />
                    <View>
                      <Text style={styles.productName}>
                        {scannedProducts.length} Product{scannedProducts.length !== 1 ? 's' : ''} Scanned
                      </Text>
                      <Text style={styles.productId}>Total Items: {scannedProducts.length}</Text>
                    </View>
                  </View>
                  <View style={[styles.scannedBadge, isCompleted && { backgroundColor: '#d1fae5' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={isCompleted ? '#10b981' : '#22c55e'} />
                    <Text style={[styles.scannedText, isCompleted && { color: '#10b981' }]}>
                      {isCompleted ? 'Completed' : 'In Progress'}
                    </Text>
                  </View>
                </View>
              </View>

              {scannedProducts.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionLabel}>SCANNED PRODUCTS</Text>
                  {scannedProducts.map((item, index) => (
                    <View key={index} style={styles.scannedItem}>
                      <MaterialCommunityIcons name="barcode-scan" size={24} color="#3b82f6" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ fontWeight: '600' }}>{item.displayText}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>{item.rawCode}</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionLabel}>LIVE TRACKING UPDATES</Text>
              <View style={styles.card}>
                {trackingSteps.map((step, index) => (
                  <View key={step.id} style={styles.stepRow}>
                    <View style={styles.stepLeft}>
                      <View style={[styles.stepDot, step.done ? styles.stepDotDone : styles.stepDotPending]}>
                        {step.done && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      {index < trackingSteps.length - 1 && (
                        <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 20 }}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.stepLabel, step.done && { color: '#22c55e' }]}>{step.label}</Text>
                        {step.time && <Text style={styles.stepTime}>{step.time}</Text>}
                      </View>
                      {step.sub && <Text style={styles.stepSub}>{step.sub}</Text>}
                    </View>
                  </View>
                ))}

                {!isCompleted && (
                  <TouchableOpacity style={styles.deliverBtn} onPress={markAsDelivered}>
                    <Ionicons name="truck-check" size={18} color="#fff" />
                    <Text style={styles.deliverBtnText}>Yes, Delivered</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.sectionLabel}>Live Location</Text>
              {locationRef.current && (
                <View style={styles.liveLocationCard}>
                  <Ionicons name="location" size={18} color="#22c55e" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.liveLocLabel}>Current Location</Text>
                    <Text style={styles.liveLocValue}>
                      {locationRef.current.latitude.toFixed(6)},{' '}
                      {locationRef.current.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={styles.logoutButtonContainer}>
          <LinearGradient colors={['#F00001', '#d42f2f']} style={styles.logoutButtonGradient}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutPopup(true)}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>

      <Modal transparent visible={showLogoutPopup} animationType="fade" onRequestClose={() => setShowLogoutPopup(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Logout</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Are you sure you want to logout?</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowLogoutPopup(false)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', color: '#64748b' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLogout}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F00001', alignItems: 'center' }}
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default LogisticScreen;

const styles = StyleSheet.create({
  pageTitle: { fontSize: 14, color: '#888', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, fontWeight: '500' },
  profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e8e8e8' },
  profileLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  profileName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  logoBanner: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  welcomeText: { fontSize: 22, color: '#555', fontWeight: '400', marginBottom: 10 },
  welcomeSub: { fontSize: 14, color: '#F00001', textAlign: 'center', fontWeight: '500' },
  topBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#e8e8e8' },
  profileRowSmall: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  profileNameSmall: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  profileRoleSmall: { fontSize: 11, color: '#888' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e8e8e8' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderColor: '#F00001' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '500' },
  tabTextActive: { color: '#F00001', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  productId: { fontSize: 12, color: '#888' },
  scannedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  scannedText: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7', padding: 8, borderRadius: 8, marginBottom: 10 },
  locationBadgeText: { fontSize: 12, color: '#16a34a', fontWeight: '500' },
  cameraBox: { height: 280, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a', marginBottom: 14, position: 'relative' },
  cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2a2a2a' },
  scanFrameContainer: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -80 }, { translateY: -80 }] },
  scanFrame: { width: 160, height: 160 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLabel: { position: 'absolute', bottom: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  rescanBtn: { marginBottom: 14, borderRadius: 10, overflow: 'hidden' },
  rescanGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
  rescanText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginTop: 4 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stepLeft: { alignItems: 'center', width: 24 },
  stepDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0' },
  stepDotDone: { backgroundColor: '#22c55e' },
  stepDotPending: { backgroundColor: '#e2e8f0' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  stepLineDone: { backgroundColor: '#22c55e' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  stepTime: { fontSize: 11, color: '#94a3b8' },
  stepSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  deliverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 10, marginTop: 12 },
  deliverBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  liveLocationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0' },
  liveLocLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  liveLocValue: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 2 },
  logoutButtonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  logoutButtonGradient: { borderRadius: 12, overflow: 'hidden' },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 10 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scannedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
});
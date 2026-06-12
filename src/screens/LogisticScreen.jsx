 import React, { useState, useEffect, useRef, useCallback } from 'react';
  import {
    View, Text, StyleSheet, StatusBar, Switch,
    TouchableOpacity, ScrollView, Image, Linking,
    Modal, Animated, Dimensions, Alert, Platform,
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
  useLogisticTracking,           // ← useLocationTracking → useLogisticTracking
  requestLocationPermissions,
  requestIOSLocationPermission,
  isGPSEnabled,
  startHighFrequencyTracking,
  stopHighFrequencyTracking,
} from '../service/logisticService';   // ← locationService → logisticService
import { saveScannedProduct } from '../service/logisticProductService';
  
  const { width } = Dimensions.get('window');

// ── API ───────────────────────────────────────────────────────────────────────
// ── API ───────────────────────────────────────────────────────────────────────
  // ── Dummy Data ────────────────────────────────────────────────────────────────
  const DUMMY_QUEUE = [
    { id: '#9921', label: 'Order #9921', sub: 'Waiting for scan' },
    { id: '#9922', label: 'Order #9922', sub: 'Waiting for scan' },
  ];

  const TRACKING_STEPS = [
    { id: 1, label: 'Product Scanned',        sub: 'Verified at Receiving Stock',     time: '10:42 AM', done: true  },
    { id: 2, label: 'Picked from Warehouse',  sub: '',                                time: '',         done: true  },
    { id: 3, label: 'Confirm Pickup',         sub: '',                                time: '',         done: false, action: true },
    { id: 4, label: 'Delivered to Installer', sub: 'Complete delivery details below', time: '',         done: false },
    { id: 5, label: 'Proof of Delivery',      sub: 'Take photo or upload signature',  time: '',         done: false },
  ];

  const DUMMY_ORDERS = [
    { id: '001', customer: 'Ravi Kumar', location: 'Chennai',    status: 'Pending',    date: '2025-05-20', items: 5 },
    { id: '002', customer: 'Meena S',    location: 'Coimbatore', status: 'In Transit', date: '2025-05-21', items: 3 },
    { id: '003', customer: 'Arjun P',    location: 'Madurai',    status: 'Delivered',  date: '2025-05-22', items: 8 },
    { id: '004', customer: 'Priya R',    location: 'Salem',      status: 'Pending',    date: '2025-05-23', items: 2 },
  ];

  const PRODUCT_MAP = {
    'SOLAR-429': { product: 'Solar Panel',    orderId: '#429', truck: 'TR-45B', zone: 'Madurai',    status: 'Scanned' },
    'SOLAR-430': { product: 'Solar Inverter', orderId: '#430', truck: 'TR-46C', zone: 'Chennai',    status: 'Scanned' },
    'SOLAR-431': { product: 'Solar Battery',  orderId: '#431', truck: 'TR-47D', zone: 'Coimbatore', status: 'Scanned' },
  };

  const STATUS_CONFIG = {
    'Pending':    { color: '#f59e0b', icon: 'clock-outline',        bgColor: '#fff3cd' },
    'In Transit': { color: '#3b82f6', icon: 'truck-fast',           bgColor: '#cfe2ff' },
    'Delivered':  { color: '#10b981', icon: 'check-circle-outline', bgColor: '#d1e7dd' },
  };

  const STORAGE_KEY = 'logistic_is_on';

  // ── Main Screen ───────────────────────────────────────────────────────────────
  const LogisticScreen = ({ navigation }) => {
    console.log('🟡 LogisticScreen rendered');
    const isMounted = useRef(true);

    const { currentLocation, startTracking, stopTracking } = useLogisticTracking(isMounted);
    const locationRef = useRef(null);

    // ✅ isAvailable — useEffect-ku MELA declare pannirukom (important!)
    const [isAvailable,     setIsAvailable]     = useState(false);
    const [currentView,     setCurrentView]     = useState('scanner');
    const [confirmDone,     setConfirmDone]     = useState(false);
    const [cameraError,     setCameraError]     = useState(null);
    const [filter,          setFilter]          = useState('All');
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [scannedData,     setScannedData]     = useState(null);
    const [isScanning,      setIsScanning]      = useState(true);

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const device    = useCameraDevice('back');

    // ✅ LOCATION useEffect — isAvailable state mela irukku so no error
useEffect(() => {
  locationRef.current = currentLocation;

  if (currentLocation && isAvailable) {
    // Safe call
    if (typeof sendLocationToServer === 'function') {
      sendLocationToServer(
        currentLocation.latitude, 
        currentLocation.longitude
      ).catch(e => console.error('Send error:', e));
    }
  }
}, [currentLocation, isAvailable]);

    // ── Mount / Unmount ───────────────────────────────────────────────────────
    useEffect(() => {
      isMounted.current = true;

      const setup = async () => {
        if (Platform.OS === 'android') {
          try {
            await NativeModules.StartStopService?.requestBatteryOptimization?.();
          } catch (e) {}
          const granted = await requestLocationPermissions();
          if (!granted) {
            Alert.alert('Permission Required', 'Location permission is required.', [
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]);
          }
        }
      };
      setup();
      restoreState();

      return () => {
        isMounted.current = false;
        stopTracking();
        stopHighFrequencyTracking();
      };
    }, []);

    // ── Restore toggle state ──────────────────────────────────────────────────
    const restoreState = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'true') {
          setIsAvailable(true);
          if (Platform.OS === 'android') {
            NativeModules.StartStopService?.startService();
          }
          startTracking();
        }
      } catch (e) {
        console.log('[LogisticScreen] restoreState error:', e);
      }
    };

    // ── Toggle handler ────────────────────────────────────────────────────────
    const handleToggle = async () => {
      if (!isAvailable) {
        if (Platform.OS === 'android') {
          const gpsOn = await isGPSEnabled();
          if (!gpsOn) {
            Alert.alert('Location is Off', 'Please turn on GPS to continue.', [
              {
                text: 'Open Settings',
                onPress: () =>
                  Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
                    .catch(() => Linking.openSettings()),
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
            return;
          }
          NativeModules.StartStopService?.startService();
        } else if (Platform.OS === 'ios') {
          const granted = await requestIOSLocationPermission();
          if (!granted) {
            Alert.alert('Permission Required', 'Location permission is required.', [
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]);
            return;
          }
        }
        setIsAvailable(true);
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
        startTracking();
      } else {
        setIsAvailable(false);
        await AsyncStorage.setItem(STORAGE_KEY, 'false');
        stopTracking();
        stopHighFrequencyTracking();
        if (Platform.OS === 'android') {
          NativeModules.StartStopService?.stopService();
        }
      }
    };

    // ── QR / Barcode scanner ──────────────────────────────────────────────────
 const codeScanner = useCodeScanner({
  codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix'],
  onCodeScanned: useCallback((codes) => {
    if (codes.length > 0 && isScanning) {
      const value = codes[0].value;
      if (!value) return;
      setIsScanning(false);
      const found = PRODUCT_MAP[value] ?? {
        product: value, orderId: '#???',
        truck: 'Unknown', zone: 'Unknown', status: 'Scanned',
      };
      setScannedData(found);

      saveScannedProduct(value, locationRef.current);
    }
  }, [isScanning]),
});

    // ── Logout animation ──────────────────────────────────────────────────────
    React.useEffect(() => {
      if (showLogoutPopup) {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 12 }).start();
      } else {
        scaleAnim.setValue(0);
      }
    }, [showLogoutPopup]);

    const handleLogout = async () => {
      try {
        stopTracking();
        stopHighFrequencyTracking();
        if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
        await AsyncStorage.removeItem(USER_DATA);
        setShowLogoutPopup(false);
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
      } catch (e) {
        console.log('Logout error:', e);
      }
    };

    const handleRescan = () => {
      setScannedData(null);
      setIsScanning(true);
    };

    const filtered = filter === 'All'
      ? DUMMY_ORDERS
      : DUMMY_ORDERS.filter(o => o.status === filter);

    const STATS = [
      { label: 'Total Orders', value: DUMMY_ORDERS.length,                                       icon: 'package-variant',      color: '#3b82f6' },
      { label: 'Pending',      value: DUMMY_ORDERS.filter(o => o.status === 'Pending').length,   icon: 'alert-circle-outline', color: '#f59e0b' },
      { label: 'Delivered',    value: DUMMY_ORDERS.filter(o => o.status === 'Delivered').length, icon: 'check-all',            color: '#10b981' },
    ];

    // ── OFF STATE ─────────────────────────────────────────────────────────────
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

    // ── ON STATE ──────────────────────────────────────────────────────────────
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
            {['scanner', 'tracking', 'orders'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, currentView === tab && styles.tabBtnActive]}
                onPress={() => setCurrentView(tab)}
              >
                <Text style={[styles.tabText, currentView === tab && styles.tabTextActive]}>
                  {tab === 'scanner' ? 'Scanner' : tab === 'tracking' ? 'Tracking' : 'Orders'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

           currentView === 'scanner' && (
  <>
    <View style={styles.cameraBox}>
      {device && !cameraError ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={currentView === 'scanner' && isScanning}
          codeScanner={codeScanner}
          onError={(error) => {
            console.log("Camera Error:", error);
            setCameraError(error.message);
          }}
        />
      ) : (
        <View style={styles.cameraPlaceholder}>
          <Ionicons name="camera-outline" size={40} color="#aaa" />
          <Text style={{ color: '#aaa', marginTop: 8, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
            {cameraError ? cameraError : 'No camera device found'}
          </Text>
        </View>
                  )}
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
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
                      {locationRef.current.latitude.toFixed(5)}, {locationRef.current.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}

                {scannedData ? (
                  <>
                    <View style={styles.card}>
                      <View style={styles.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <MaterialCommunityIcons name="solar-panel" size={32} color="#3b82f6" />
                          <View>
                            <Text style={styles.productName}>{scannedData.product}</Text>
                            <Text style={styles.productId}>{scannedData.orderId}</Text>
                          </View>
                        </View>
                        <View style={styles.scannedBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                          <Text style={styles.scannedText}>Scanned</Text>
                        </View>
                      </View>
                      <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>LOAD TO TRUCK('optional')</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <MaterialCommunityIcons name="truck-outline" size={14} color="#3b82f6" />
                            <Text style={styles.infoValue}>{scannedData.truck}</Text>
                          </View>
                        </View>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>ZONE LOCATION('optional')</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="location" size={14} color="#f59e0b" />
                            <Text style={styles.infoValue}>{scannedData.zone}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity style={styles.rescanBtn} onPress={handleRescan}>
                      <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.rescanGradient}>
                        <Ionicons name="scan-outline" size={18} color="#fff" />
                        <Text style={styles.rescanText}>Scan Again</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
                    <Ionicons name="scan-outline" size={36} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', marginTop: 10, fontSize: 14, fontWeight: '500' }}>
                      QR அல்லது Barcode scan பண்ணுங்க
                    </Text>
                    <Text style={{ color: '#cbd5e1', marginTop: 4, fontSize: 12 }}>
                      Product details இங்கே தெரியும்
                    </Text>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Route to Storage</Text>
                <TouchableOpacity
                  style={styles.mapBox}
                  onPress={() => {
                    const loc  = locationRef.current;
                    const dest = scannedData?.zone ?? 'Madurai';
                    const url  = loc
                      ? `https://www.google.com/maps/dir/?api=1&origin=${loc.latitude},${loc.longitude}&destination=${encodeURIComponent(dest)}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
                    Linking.openURL(url);
                  }}
                >
                  <LinearGradient colors={['#e8f0fe', '#dbeafe']} style={styles.mapPlaceholder}>
                    <LinearGradient colors={['#F00001', '#d42f2f']} style={styles.navBtn}>
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={styles.navBtnText}>Start Navigation</Text>
                    </LinearGradient>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>NEXT IN QUEUE</Text>
                {DUMMY_QUEUE.map((q) => (
                  <TouchableOpacity key={q.id} style={styles.queueItem}>
                    <MaterialCommunityIcons name="package-variant" size={28} color="#94a3b8" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.queueLabel}>{q.label}</Text>
                      <Text style={styles.queueSub}>{q.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </>
            )

            {currentView === 'tracking' && (
              <>
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialCommunityIcons name="solar-panel" size={32} color="#3b82f6" />
                      <View>
                        <Text style={styles.productName}>
                          {scannedData ? scannedData.product : 'Solar Panel'}
                        </Text>
                        <Text style={styles.productId}>
                          {scannedData ? scannedData.orderId : '#429'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.scannedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.scannedText}>Scanned</Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>LOAD TO TRUCK('optional')</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="truck-outline" size={14} color="#3b82f6" />
                        <Text style={styles.infoValue}>{scannedData ? scannedData.truck : 'TR-45B'}</Text>
                      </View>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>ZONE LOCATION('optional')</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="location" size={14} color="#f59e0b" />
                        <Text style={styles.infoValue}>{scannedData ? scannedData.zone : 'Madurai'}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <Text style={styles.sectionLabel}>LIVE TRACKING UPDATES</Text>
                <View style={styles.card}>
                  {TRACKING_STEPS.map((step, index) => (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={styles.stepLeft}>
                        <View style={[
                          styles.stepDot,
                          step.done ? styles.stepDotDone : styles.stepDotPending,
                          step.action && !confirmDone && styles.stepDotAction,
                        ]}>
                          {step.done && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        {index < TRACKING_STEPS.length - 1 && (
                          <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                        )}
                      </View>
                      <View style={{ flex: 1, paddingBottom: 20 }}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.stepLabel, step.done && { color: '#22c55e' }]}>
                            {step.label}
                          </Text>
                          {step.time ? <Text style={styles.stepTime}>{step.time}</Text> : null}
                        </View>
                        {step.sub ? <Text style={styles.stepSub}>{step.sub}</Text> : null}
                        {step.action && !confirmDone && (
                          <TouchableOpacity style={styles.confirmBtn} onPress={() => setConfirmDone(true)}>
                            <Ionicons name="time-outline" size={16} color="#fff" />
                            <Text style={styles.confirmBtnText}>Confirm Pickup</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.deliverBtn}>
                    <Ionicons name="ellipse-outline" size={16} color="#fff" />
                    <Text style={styles.deliverBtnText}>Mark as Delivered</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>Live location checking</Text>
                {locationRef.current ? (
                  <View style={styles.liveLocationCard}>
                    <Ionicons name="location" size={18} color="#22c55e" />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.liveLocLabel}>Current Location</Text>
                      <Text style={styles.liveLocValue}>
                        {locationRef.current.latitude.toFixed(6)}, {locationRef.current.longitude.toFixed(6)}
                      </Text>
                      {locationRef.current.speed != null && (
                        <Text style={styles.liveLocSpeed}>
                          Speed: {(locationRef.current.speed * 3.6).toFixed(1)} km/h
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.mapPlaceholder2}>
                    <Ionicons name="map-outline" size={40} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', marginTop: 8 }}>Waiting for location...</Text>
                  </View>
                )}
              </>
            )}

            {currentView === 'orders' && (
              <>
                <View style={styles.statsContainer}>
                  {STATS.map((stat, index) => (
                    <LinearGradient
                      key={index}
                      colors={[stat.color + '15', stat.color + '05']}
                      style={styles.statCard}
                    >
                      <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                        <MaterialCommunityIcons name={stat.icon} size={22} color={stat.color} />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{stat.value}</Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                      </View>
                    </LinearGradient>
                  ))}
                </View>

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

                {filtered.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="package-variant-closed" size={60} color="#cbd5e1" />
                    <Text style={styles.emptyText}>No orders found</Text>
                    <Text style={styles.emptySubText}>Try changing the filter</Text>
                  </View>
                ) : (
                  filtered.map((item) => {
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG['Pending'];
                    return (
                      <View key={item.id} style={styles.orderCardWrapper}>
                        <LinearGradient colors={['#ffffff', '#f9fafb']} style={styles.orderCard}>
                          <View style={styles.orderTop}>
                            <View>
                              <Text style={styles.orderId}>Order #{item.id}</Text>
                              <Text style={styles.orderItems}>{item.items} items</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: sc.bgColor }]}>
                              <MaterialCommunityIcons name={sc.icon} size={16} color={sc.color} />
                              <Text style={[styles.statusText, { color: sc.color }]}>{item.status}</Text>
                            </View>
                          </View>
                          <View style={styles.customerRow}>
                            <Ionicons name="person-circle-outline" size={20} color="#64748b" />
                            <Text style={styles.customerName}>{item.customer}</Text>
                          </View>
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
                          <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, {
                              width: item.status === 'Delivered' ? '100%' : item.status === 'In Transit' ? '66%' : '33%',
                              backgroundColor: sc.color,
                            }]} />
                          </View>
                        </LinearGradient>
                      </View>
                    );
                  })
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

        <Modal
          transparent
          visible={showLogoutPopup}
          animationType="fade"
          onRequestClose={() => setShowLogoutPopup(false)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[
              styles.modalContent,
              { transform: [{ scale: scaleAnim }], opacity: scaleAnim },
            ]}>
              <View style={styles.iconContainer}>
                <LinearGradient colors={['#F00001', '#d42f2f']} style={styles.iconGradient}>
                  <Ionicons name="log-out-outline" size={50} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.modalTextContainer}>
                <Text style={styles.modalTitle}>Logout Confirmation</Text>
                <Text style={styles.modalSubtitle}>Are you sure you want to logout?</Text>
                <Text style={styles.modalMessage}>
                  You will need to login again to access your logistics dashboard.
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <LinearGradient colors={['#f3f4f6', '#e5e7eb']} style={styles.cancelBtnGradient}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setShowLogoutPopup(false)}>
                    <Ionicons name="close-outline" size={20} color="#374151" />
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </LinearGradient>
                <LinearGradient colors={['#F00001', '#d42f2f']} style={styles.okBtnGradient}>
                  <TouchableOpacity style={styles.okButton} onPress={handleLogout}>
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
    infoRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
    infoItem: { flex: 1 },
    infoLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginBottom: 4 },
    infoValue: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
    locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dcfce7', padding: 8, borderRadius: 8, marginBottom: 10 },
    locationBadgeText: { fontSize: 12, color: '#16a34a', fontWeight: '500' },
    liveLocationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0' },
    liveLocLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    liveLocValue: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 2 },
    liveLocSpeed: { fontSize: 11, color: '#64748b', marginTop: 2 },
    cameraBox: { height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a1a1a', marginBottom: 14, justifyContent: 'center', alignItems: 'center' },
    cameraPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2a2a2a' },
    scanFrame: { position: 'absolute', width: 160, height: 160 },
    corner: { position: 'absolute', width: 22, height: 22, borderColor: '#fff', borderWidth: 3 },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    scanLabel: { position: 'absolute', bottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    rescanBtn: { marginBottom: 14, borderRadius: 10, overflow: 'hidden' },
    rescanGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 },
    rescanText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    mapBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
    mapPlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    mapPlaceholder2: { height: 140, backgroundColor: '#f1f5f9', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 },
    navBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    sectionLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8, marginTop: 4 },
    queueItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1 },
    queueLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    queueSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    stepRow: { flexDirection: 'row', gap: 12 },
    stepLeft: { alignItems: 'center', width: 24 },
    stepDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    stepDotDone: { backgroundColor: '#22c55e' },
    stepDotPending: { backgroundColor: '#e2e8f0' },
    stepDotAction: { backgroundColor: '#f59e0b' },
    stepLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 2 },
    stepLineDone: { backgroundColor: '#22c55e' },
    stepLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
    stepTime: { fontSize: 11, color: '#94a3b8' },
    stepSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F00001', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 10, alignSelf: 'flex-start' },
    confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    deliverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a1a1a', paddingVertical: 14, borderRadius: 10, marginTop: 8 },
    deliverBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    statsContainer: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    statIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 15, fontWeight: '700', color: '#000' },
    statLabel: { fontSize: 10, color: '#64748b', marginTop: 1 },
    filterLabel: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
    filterRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    filterTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
    filterTabActive: { backgroundColor: '#F00001', borderColor: '#d42f2f' },
    filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#cbd5e1', marginRight: 4 },
    filterDotActive: { backgroundColor: '#fff' },
    filterText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
    filterTextActive: { color: '#fff', fontWeight: '600' },
    orderCardWrapper: { marginVertical: 6 },
    orderCard: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
    orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    orderId: { fontWeight: '700', fontSize: 15, color: '#1a1a1a' },
    orderItems: { fontSize: 12, color: '#64748b', marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
    statusText: { fontSize: 11, fontWeight: '600' },
    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    customerName: { fontSize: 13, color: '#374151', fontWeight: '500' },
    detailsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    detailItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
    detailText: { fontSize: 11, color: '#475569', fontWeight: '500' },
    progressContainer: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 2 },
    emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#64748b', marginTop: 12 },
    emptySubText: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    logoutButtonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    logoutButtonGradient: { borderRadius: 12, overflow: 'hidden' },
    logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 10 },
    logoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: width * 0.85, backgroundColor: '#fff', borderRadius: 24, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', elevation: 15 },
    iconContainer: { marginBottom: 20 },
    iconGradient: { width: 70, height: 70, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    modalTextContainer: { alignItems: 'center', marginBottom: 28 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    modalSubtitle: { fontSize: 16, fontWeight: '600', color: '#475569', marginBottom: 12 },
    modalMessage: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
    modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
    cancelBtnGradient: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    cancelButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 8 },
    cancelText: { color: '#374151', fontWeight: '600', fontSize: 15 },
    okBtnGradient: { flex: 1, borderRadius: 12, overflow: 'hidden' },
    okButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, gap: 8 },
    okText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  });
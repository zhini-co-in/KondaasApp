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
import LogisticDealCard from '../components/LogisticDealCard';
import LogisticCardTrackingModal from '../components/LogisticCardTrackingModal';
import { saveScannedProduct, confirmDeliveryToWarehouse, getNewAssignedCards, updateLogisticsStatus } from '../service/logisticProductService';

const LogisticScreen = ({ navigation }) => {
  const isMounted = useRef(true);
  const { currentLocation, startTracking, stopTracking } = useLogisticTracking(isMounted);
  const locationRef = useRef(null);
  const { hasPermission, requestPermission } = useCameraPermission();

  const [isAvailable, setIsAvailable] = useState(false);
  const [currentView, setCurrentView] = useState('scanner');
  const [cameraError, setCameraError] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showDealModal, setShowDealModal] = useState(false);

  const [scannedProducts, setScannedProducts] = useState([]);
  const [newAssignedCards, setNewAssignedCards] = useState([]);
  const [scanningForProduct, setScanningForProduct] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  const [cardScanModalVisible, setCardScanModalVisible] = useState(false);
  const [scanningCardIndex, setScanningCardIndex] = useState(null);

  // 🆕 Hard boolean lock (was timestamp-based). Set synchronously the
  // instant a code is detected, BEFORE any async work starts, so every
  // extra camera frame that fires while we're still processing the first
  // one is dropped instantly. This is what was letting the same QR code
  // fire the save/update calls 20-30 times in a row.
  const cardScanLock = useRef(false);

  // 3-column tab state: 'new' | 'inprogress' | 'completed'
  const [cardTab, setCardTab] = useState('new');

  // Per-card tracking modal (kept for "View full details" / completed cards)
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingModalCard, setTrackingModalCard] = useState(null);

  const device = useCameraDevice('back');
  const lastScanTime = useRef(0);

  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    isMounted.current = true;
    restoreState();
    loadNewAssignedCards();
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

  const loadNewAssignedCards = async () => {
    try {
      const cards = await getNewAssignedCards();
      setNewAssignedCards(cards);
    } catch (e) {
      console.error('loadNewAssignedCards error:', e);
    }
  };

  ///////////////refresh//////////////////
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNewAssignedCards();
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

  // 🆕 Hardened per-card scanner. Fires once per scan session, closes the
  // camera modal immediately (before async work), and only releases its
  // lock once the whole save/update cycle has finished.
  const cardCodeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'code-128', 'code-39', 'data-matrix', 'aztec'],
    onCodeScanned: (codes) => {
      if (codes.length === 0 || scanningCardIndex === null) return;

      if (cardScanLock.current) return; // already processing a scan — drop this frame
      cardScanLock.current = true; // lock synchronously, before anything async

      const value = codes[0].value?.trim();
      if (!value) {
        cardScanLock.current = false;
        return;
      }

      const index = scanningCardIndex;
      const card = newAssignedCards[index];

      if (!card) {
        // stale index (list changed / card removed) — bail safely
        cardScanLock.current = false;
        setCardScanModalVisible(false);
        setScanningCardIndex(null);
        return;
      }

      // Close the scanner UI immediately so isActive={false} stops the
      // camera from feeding any more frames, before we even start the
      // async DB calls.
      setCardScanModalVisible(false);
      setScanningCardIndex(null);

      (async () => {
        try {
          setNewAssignedCards((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, scannedCode: value, scannedAt: new Date().toISOString() } : item
            )
          );

          await saveScannedProduct(value, locationRef.current);

          const success = await updateLogisticsStatus(card.deal_id, 'inprogress');
          if (success) {
            setNewAssignedCards((prev) =>
              prev.map((item, i) => (i === index ? { ...item, status: 'inprogress' } : item))
            );
            // 🆕 Auto-switch to "In Progress" tab so the card — and its new
            // "Picked" button — is immediately visible after scanning.
            // This is why it looked like "nothing happened": the card had
            // actually moved out of the "New" tab.
            setCardTab('inprogress');
          } else {
            Alert.alert('Error', 'Failed to update status after scan');
          }
        } catch (e) {
          console.error('[cardCodeScanner] scan handling failed:', e);
          Alert.alert('Error', 'Something went wrong while saving the scan');
        } finally {
          cardScanLock.current = false; // ready for the next scan session
        }
      })();
    },
  });

  const handleRescan = () => {
    setScannedData(null);
    setIsScanning(true);
  };

  const showFullDealDetails = (card) => {
    setSelectedDeal(card);
    setShowDealModal(true);
  };

  // Accept → Status change + Start Scan button show
  const acceptAssignedCard = async (card, index) => {
    const success = await updateLogisticsStatus(card.deal_id, 'accepted');

    if (success) {
      setNewAssignedCards((prev) =>
        prev.map((item, i) => (i === index ? { ...item, status: 'accepted' } : item))
      );
      Alert.alert('Accepted', 'Status updated. Click "Start Scan"');
    } else {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Reject Card
  const rejectAssignedCard = async (card, index) => {
    const success = await updateLogisticsStatus(card.deal_id, 'rejected');

    if (success) {
      setNewAssignedCards((prev) => prev.filter((_, i) => i !== index));
      Alert.alert('Rejected', 'Card removed from assignments');
    } else {
      Alert.alert('Error', 'Failed to reject');
    }
  };

  const openScannerForCard = (index) => {
    cardScanLock.current = false; // 🆕 fresh lock for this new scan session
    setScanningCardIndex(index);
    setCardScanModalVisible(true);
  };

  const closeCardScanner = () => {
    setCardScanModalVisible(false);
    setScanningCardIndex(null);
  };

  // 🆕 "Picked" button on an in-progress card → status 'picked'
  const markProductPicked = async (card, index) => {
    const success = await updateLogisticsStatus(card.deal_id, 'picked');
    if (success) {
      setNewAssignedCards((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: 'picked', pickedAt: new Date().toISOString() } : item
        )
      );
    } else {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // 🆕 "Delivered" button on a picked card → status 'completed'
  const markAsDropped = async (card, index) => {
    const success = await updateLogisticsStatus(card.deal_id, 'completed');
    if (success) {
      setNewAssignedCards((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: 'completed', deliveredAt: new Date().toISOString() } : item
        )
      );
      setCardTab('completed'); // 🆕 jump to Completed tab so the result is visible right away
    } else {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  // Per-card tracking sheet (used for "View full details" / completed cards)
  const openCardTracking = (card) => {
    setTrackingModalCard(card);
    setTrackingModalVisible(true);
  };

  const closeCardTracking = () => {
    setTrackingModalVisible(false);
    setTrackingModalCard(null);
  };

  const handleConfirmPickupFromModal = async (card) => {
    const index = newAssignedCards.findIndex((c) => c.deal_id === card.deal_id);
    if (index === -1) return;
    await markProductPicked(card, index);
    closeCardTracking();
  };

  const handleMarkDeliveredFromModal = async (card) => {
    const index = newAssignedCards.findIndex((c) => c.deal_id === card.deal_id);
    if (index === -1) return;
    await markAsDropped(card, index);
    closeCardTracking();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            stopTracking();
            stopHighFrequencyTracking();
            if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
            await AsyncStorage.removeItem(USER_DATA);
            navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
          } catch (e) {
            Alert.alert('Error', 'Failed to logout.');
          }
        },
      },
    ]);
  };

  // Map a card's raw status to one of the 3 tab columns
  const getCardColumn = (status) => {
    if (status === 'completed') return 'completed';
    if (status === 'accepted' || status === 'inprogress' || status === 'picked') return 'inprogress';
    return 'new'; // pending / undefined / rejected-filtered-out-already
  };

  const filteredCards = newAssignedCards.filter(
    (card) => getCardColumn(card.status) === cardTab
  );

  const cardCounts = {
    new: newAssignedCards.filter((c) => getCardColumn(c.status) === 'new').length,
    inprogress: newAssignedCards.filter((c) => getCardColumn(c.status) === 'inprogress').length,
    completed: newAssignedCards.filter((c) => getCardColumn(c.status) === 'completed').length,
  };

  if (!isAvailable) {
    return (
      <LinearGradient colors={['#F00001', '#B00100']} style={{ flex: 1 }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

        <TouchableOpacity style={styles.offLogoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={{ position: 'absolute', top: 50, right: 20, alignItems: 'center', zIndex: 10 }}>
          <View style={styles.offToggleBtn}>
            <Switch
              trackColor={{ false: '#ffffff88', true: '#fff' }}
              thumbColor="#F00001"
              value={isAvailable}
              onValueChange={handleToggle}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingTop: 60, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 20 }}>
            <Image
              source={require('../../assets/images/kondass.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.offTextContainer}>
            <Text style={styles.welcome}>Welcome!</Text>
            <Text style={styles.message}>Let's get started! Turn on availability!</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.fixedTopBar}>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#F00001" />
          </TouchableOpacity>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1a1a1a' }}>
            Logistic Dashboard
          </Text>
          <Switch
            trackColor={{ false: '#ccc', true: '#F00001' }}
            thumbColor="#fff"
            value={isAvailable}
            onValueChange={handleToggle}
          />
        </View>
        <View style={{ flex: 1, paddingTop: 90 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F00001']} />
            }
          >
            {/* ASSIGNED DEALS — 3 COLUMN TABS: New / In Progress / Completed */}
            {newAssignedCards.length > 0 && (
              <View style={styles.card}>
                <Text style={[styles.sectionLabel, { color: '#8b5cf6' }]}>
                  🆕 ASSIGNED DEALS
                </Text>

                {/* Tab Switcher */}
                <View style={styles.cardTabRow}>
                  {[
                    { key: 'new', label: 'New' },
                    { key: 'inprogress', label: 'In Progress' },
                    { key: 'completed', label: 'Completed' },
                  ].map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.cardTabBtn, cardTab === tab.key && styles.cardTabBtnActive]}
                      onPress={() => setCardTab(tab.key)}
                    >
                      <Text style={[styles.cardTabText, cardTab === tab.key && styles.cardTabTextActive]}>
                        {tab.label} ({cardCounts[tab.key]})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filteredCards.length === 0 ? (
                  <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>
                    No {cardTab === 'inprogress' ? 'in progress' : cardTab} deals
                  </Text>
                ) : (
                  filteredCards.map((card) => {
                    const index = newAssignedCards.indexOf(card); // original array index, for handlers
                    return (
                      <LogisticDealCard
                        key={card.deal_id || index}
                        card={card}
                        index={index}
                        onAccept={acceptAssignedCard}
                        onReject={rejectAssignedCard}
                        onStartScan={openScannerForCard}
                        onMarkPicked={markProductPicked}
                        onMarkDropped={markAsDropped}
                        onSeeMore={showFullDealDetails}
                        onCardPress={openCardTracking}
                      />
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* FULL DEAL DETAILS MODAL */}
      <Modal visible={showDealModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Deal Details</Text>

            {selectedDeal && (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>
                  {selectedDeal.products_info?.[1] || selectedDeal.deal_id || 'New Assigned Deal'}
                </Text>
                <Text>Address: {selectedDeal.address || 'Chennai'}</Text>
                <Text>Assigned: {new Date(selectedDeal.assignedAt).toLocaleString()}</Text>
                <Text>Status: {selectedDeal.status || 'pending'}</Text>

                <Text style={{ marginTop: 20, fontWeight: '700', marginBottom: 8 }}>All Products:</Text>
                {selectedDeal.products_info?.map((prod, i) => (
                  <Text key={i} style={{ marginVertical: 4, fontSize: 14, paddingLeft: 8 }}>
                    • {prod}
                  </Text>
                ))}

                {selectedDeal.products_info?.length === 0 && (
                  <Text style={{ color: '#666', fontStyle: 'italic' }}>No products listed</Text>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => setShowDealModal(false)}
            >
              <Text style={styles.acceptText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PER-CARD TRACKING MODAL */}
      <LogisticCardTrackingModal
        visible={trackingModalVisible}
        card={trackingModalCard}
        onClose={closeCardTracking}
        onConfirmPickup={handleConfirmPickupFromModal}
        onMarkDelivered={handleMarkDeliveredFromModal}
      />

      {/* PRODUCT SCAN MODAL - per card */}
      <Modal visible={cardScanModalVisible} transparent={false} animationType="slide" onRequestClose={closeCardScanner}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Scan Product</Text>
              <TouchableOpacity onPress={closeCardScanner}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {device && cameraPermissionGranted ? (
                <Camera
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={cardScanModalVisible}
                  codeScanner={cardCodeScanner}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff' }}>Camera not available</Text>
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
                <Text style={{ color: '#fff', fontSize: 12 }}>Align QR / Barcode within frame</Text>
              </View>
            </View>
          </SafeAreaView>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedPill: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  logo: { width: 200, height: 100 },
  modalContent: {
    backgroundColor: '#fff',
    width: '90%',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  offLogoutBtn: { position: 'absolute', top: 55, left: 20, zIndex: 10 },
  offToggleBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
    elevation: 4,
  },
  avatarCircleWhite: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  offTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 30 },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message: { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 30 },
  fixedTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', elevation: 6,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 15 },
  acceptBtn: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  acceptText: { color: '#fff', fontWeight: '600' },

  // 3-COLUMN TAB STYLES
  cardTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  cardTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  cardTabBtnActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardTabText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  cardTabTextActive: {
    color: '#8b5cf6',
  },
});
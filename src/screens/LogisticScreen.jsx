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
  TextInput,
  KeyboardAvoidingView,
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
import PackageScanVerifyModal from '../components/PackageScanVerifyModal';
import { saveScannedProduct, confirmDeliveryToWarehouse, getNewAssignedCards, updateLogisticsStatus } from '../service/logisticProductService';
import {
  mergeCardsWithLocalProgress,
  setLocalDispatchStatus,
  acceptDealLocalFirst,
  updateDispatchStatusRemote, // FIX: needed to actually push 'inprogress' to the backend
} from '../service/dispatchProgressService';

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

  // Hard boolean lock (was timestamp-based). Set synchronously the
  // instant a code is detected, BEFORE any async work starts, so every
  // extra camera frame that fires while we're still processing the first
  // one is dropped instantly. This is what was letting the same QR code
  // fire the save/update calls 20-30 times in a row.
  const cardScanLock = useRef(false);


  // Per-card tracking modal (kept for "View full details" / completed cards)
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingModalCard, setTrackingModalCard] = useState(null);

  // Picked/Delivered no longer flip a card's status directly. Both go
  // through this scan+verify gate first — driver has to scan/OCR/manual-enter
  // the package and confirm every item's quantity before the status actually
  // changes. verifyTarget remembers WHICH card+index+action (pickup/delivery)
  // triggered the modal so we know what to update once verified.
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null); // { card, index, action: 'pickup' | 'delivery', pkg?, key? }

  // Reject-reason popup — mirrors the Deal Details modal's design
  // (dark overlay + white rounded card). rejectTarget remembers WHICH
  // card+index triggered it so confirmRejectCard knows what to remove.
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null); // { card, index }
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Handle onto each rendered LogisticDealCard, keyed by deal_id, so the
  // package-level advancePackage() can be triggered only from
  // handleVerifyConfirmed below — never directly from the card's buttons.
  const cardRefs = useRef({});

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
      const merged = await mergeCardsWithLocalProgress(cards);
      setNewAssignedCards(merged);
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

  // Hardened per-card scanner. Fires once per scan session, closes the
  // camera modal immediately (before async work), and only releases its
  // lock once the whole save/update cycle has finished.
  const cardCodeScanner = useCodeScanner({
    // Covers both QR and every common barcode symbology (UPC/EAN retail
    // barcodes, Code 128/39/93, Codabar, ITF, PDF417, Data Matrix, Aztec)
    // so scanning works regardless of which code type is printed on the
    // product/package.
    codeTypes: [
      'qr',
      'ean-13',
      'ean-8',
      'upc-a',
      'upc-e',
      'code-128',
      'code-39',
      'code-93',
      'codabar',
      'itf',
      'itf-14',
      'pdf-417',
      'data-matrix',
      'aztec',
    ],
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

          await setLocalDispatchStatus(card.deal_id, 'inprogress');

          // FIX: setLocalDispatchStatus only ever wrote to AsyncStorage —
          // it never told the backend, which is why dispatch_status stayed
          // null on the server after scanning. Push it through the same
          // remote path the (already-working) delivered flow uses.
          updateDispatchStatusRemote(card.deal_id, 'inprogress').catch((e) => {
            console.warn('⚠️ inprogress dispatch_status push failed:', e?.message);
          });

          setNewAssignedCards((prev) =>
            prev.map((item, i) => (i === index ? { ...item, status: 'inprogress' } : item))
          );
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

  // Accept — local-first. Flips AsyncStorage + the UI to "accepted"
  // instantly; acceptDealLocalFirst() fires the backend call in the
  // background and never blocks/reverts this on failure (see
  // dispatchProgressService.js for details — it now also pushes the real
  // dispatch_status via updateDispatchStatusRemote).
  const acceptAssignedCard = async (card, index) => {
    const { localStatus } = await acceptDealLocalFirst(card.deal_id);
    setNewAssignedCards((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status: localStatus } : item))
    );
  };

  // Reject — opens the reason popup instead of removing the card
  // immediately. The actual removal + API/local status update only
  // happens once the driver types a reason and taps "Submit" in
  // confirmRejectCard below.
  const rejectAssignedCard = (card, index) => {
    setRejectTarget({ card, index });
    setRejectReason('');
    setRejectError('');
    setRejectModalVisible(true);
  };

  const closeRejectModal = () => {
    setRejectModalVisible(false);
    setRejectTarget(null);
    setRejectReason('');
    setRejectError('');
  };

  // Only place a card is actually removed + marked rejected — fires
  // once the driver has typed a reason and confirmed.
  const confirmRejectCard = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Reject reason podunga');
      return;
    }
    const target = rejectTarget;
    if (!target) return;

    try {
      await setLocalDispatchStatus(target.card.deal_id, 'rejected', {
        reason: rejectReason.trim(),
      });
      updateDispatchStatusRemote(target.card.deal_id, 'rejected').catch((e) => {
        console.warn('⚠️ rejected dispatch_status push failed:', e?.message);
      });
    } catch (e) {
      console.error('[confirmRejectCard] failed:', e);
    }

    setNewAssignedCards((prev) => prev.filter((_, i) => i !== target.index));
    closeRejectModal();
    Alert.alert('Rejected', 'Card removed from assignments');
  };

    const openScannerForCard = (card, index) => {
    cardScanLock.current = false; // fresh lock for this new scan session
    setScanningCardIndex(index);
    setCardScanModalVisible(true);
  };

  const closeCardScanner = () => {
    setCardScanModalVisible(false);
    setScanningCardIndex(null);
  };

  // "Picked" button on an in-progress card → status 'picked'
  const markProductPicked = async (card, index) => {
    await setLocalDispatchStatus(card.deal_id, 'picked');
    updateDispatchStatusRemote(card.deal_id, 'picked').catch((e) => {
      console.warn('⚠️ picked dispatch_status push failed:', e?.message);
    });
    setNewAssignedCards((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: 'picked', pickedAt: new Date().toISOString() } : item
      )
    );
  };

  const markAsDropped = async (card, index) => {
    await setLocalDispatchStatus(card.deal_id, 'completed');
    updateDispatchStatusRemote(card.deal_id, 'delivered').catch((e) => {
      console.warn('⚠️ delivered dispatch_status push failed:', e?.message);
    });
    setNewAssignedCards((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: 'completed', deliveredAt: new Date().toISOString() } : item
      )
    );
  };

  // Per-card tracking sheet (used for "View full details" / completed cards)
  // Opens the scan+verify modal instead of changing status directly.
  // `action` is 'pickup' (→ Picked) or 'delivery' (→ Dropped/Delivered).
  // Pass `pkg`/`key` for a PACKAGE-level action (from LogisticDealCard's
  // inline Mark Picked/Delivered buttons) — omit them for a deal-level action.
  const openScanVerify = (card, index, action, pkg, key) => {
    setVerifyTarget({ card, index, action, pkg, key });
    setVerifyModalVisible(true);
  };

  const closeScanVerify = () => {
    setVerifyModalVisible(false);
    setVerifyTarget(null);
  };

  // Only place a card/package's status is actually allowed to change to
  // Picked/Delivered — fires only after the driver explicitly confirms on
  // the PackageScanVerifyModal result screen (Continue / Override).
  const handleVerifyConfirmed = async (matched, rawText, meta) => {
    const target = verifyTarget;
    closeScanVerify();
    if (!target) return;

    // Package-level: delegate to the specific card's own local stage state,
    // reached through the ref — this is the ONLY path that ever calls
    // advancePackage on a card.
    if (target.pkg && target.key) {
      const nextStage = target.action === 'pickup' ? 'picked' : 'delivered';
      const remoteStatus = target.action === 'pickup' ? 'shipped' : 'delivered';
      cardRefs.current[target.card?.deal_id]?.advancePackage(target.pkg, target.key, nextStage, remoteStatus);
      return;
    }

    // Deal-level (legacy path, kept for the top-of-card actions).
    if (target.action === 'pickup') {
      await markProductPicked(target.card, target.index);
    } else if (target.action === 'delivery') {
      await markAsDropped(target.card, target.index);
    }
  };

  // PackageScanVerifyModal expects { package_number, package_items }.
  // If this is a package-level target, the real package object already has
  // that exact shape — use it directly.
  //
  // Otherwise (deal-level target — e.g. Confirm Pickup/Mark Delivered from
  // LogisticCardTrackingModal, no specific package chosen) build the items
  // list from card.packages[].package_items — that's where product data
  // actually lives on current records. card.products_info is a legacy
  // fallback field only populated on old pre-packages[] records, so relying
  // on it here left "Products Verified" empty for every normal dispatch.
  const buildDealLevelItems = (card) => {
    const fromPackages = (card?.packages || []).flatMap(
      (pkg) => pkg.package_items || []
    );
    if (fromPackages.length > 0) return fromPackages;

    // Old-record fallback: no packages[] at all, only a flat products_info list.
    return (card?.products_info || []).map((name) => ({ product_name: name }));
  };

  const verifyPkg = verifyTarget
    ? verifyTarget.pkg || {
        package_number: verifyTarget.card?.deal_id,
        package_items: buildDealLevelItems(verifyTarget.card),
      }
    : null;

  const openCardTracking = (card) => {
    setTrackingModalCard(card);
    setTrackingModalVisible(true);
  };

  const closeCardTracking = () => {
    setTrackingModalVisible(false);
    setTrackingModalCard(null);
  };

  const handleConfirmPickupFromModal = (card) => {
    const index = newAssignedCards.findIndex((c) => c.deal_id === card.deal_id);
    if (index === -1) return;
    closeCardTracking();
    openScanVerify(card, index, 'pickup');
  };

  const handleMarkDeliveredFromModal = (card) => {
    const index = newAssignedCards.findIndex((c) => c.deal_id === card.deal_id);
    if (index === -1) return;
    closeCardTracking();
    openScanVerify(card, index, 'delivery');
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

  const cardCounts = {
    new: newAssignedCards.filter((c) => getCardColumn(c.status) === 'new').length,
    inprogress: newAssignedCards.filter((c) => getCardColumn(c.status) === 'inprogress').length,
    completed: newAssignedCards.filter((c) => getCardColumn(c.status) === 'completed').length,
  };

  // Cards to show on the OFF (offline) screen — "New" status only
  const newOnlyCards = newAssignedCards.filter((card) => getCardColumn(card.status) === 'new');

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#fff']} />
          }
        >
          <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 16 }}>
            <Image
              source={require('../../assets/images/kondass.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.offTextContainer}>
            <Text style={styles.welcome}>Welcome!</Text>
            <Text style={styles.message}>
              {newOnlyCards.length > 0
                ? "You're offline — but here's what's waiting for you. Turn on availability to start."
                : "Let's get started! Turn on availability!"}
            </Text>
          </View>

          {/* New deals shown even while offline, inside a frosted panel so
              they read clearly on top of the red gradient background. */}
          {newOnlyCards.length > 0 && (
            <View style={styles.offCardsPanel}>
              <View style={styles.offCardsPanelHeader}>
                <View style={styles.offCardsPanelDot} />
                <Text style={styles.offCardsPanelTitle}>
                  New Deals ({newOnlyCards.length})
                </Text>
              </View>

              {newOnlyCards.map((card) => {
                const index = newAssignedCards.indexOf(card);
                return (
                                    <LogisticDealCard
                    ref={(r) => { cardRefs.current[card.deal_id] = r; }}
                    key={card.deal_id || index}
                    card={card}
                    index={index}
                    onAccept={acceptAssignedCard}
                    onReject={rejectAssignedCard}
                    onStartScan={openScannerForCard}
                    onMarkPicked={(c, pkg, key) => openScanVerify(c, index, 'pickup', pkg, key)}
                    onMarkDropped={(c, pkg, key) => openScanVerify(c, index, 'delivery', pkg, key)}
                    onSeeMore={showFullDealDetails}
                    onCardPress={openCardTracking}
                    onStartPickup={(card) => navigation.navigate('PackagePickupScreen', { card, onUpdate: loadNewAssignedCards })}
                  />
                );
              })}
            </View>
          )}
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
                        {/* Reusable per-status section renderer */}
            {[
              { key: 'new', label: 'Deals - New', dot: '#ED1C25' },
              { key: 'inprogress', label: 'In Progress', dot: '#f97316' },
              { key: 'completed', label: 'Completed', dot: '#22c55e' },
            ].map((section) => {
              const sectionCards = newAssignedCards.filter(
                (card) => getCardColumn(card.status) === section.key
              );

              return (
                <View key={section.key} style={{ marginBottom: 20 }}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionDot, { backgroundColor: section.dot }]} />
                    <Text style={styles.sectionTitle}>
                      {section.label} ({sectionCards.length})
                    </Text>
                  </View>

                  {sectionCards.length === 0 && (
                    <Text style={styles.emptyText}>No {section.label.toLowerCase()} deals.</Text>
                  )}

                  {sectionCards.map((card) => {
                    const index = newAssignedCards.indexOf(card); // original array index, for handlers
                    return (
                      <LogisticDealCard
                        ref={(r) => { cardRefs.current[card.deal_id] = r; }}
                        key={card.deal_id || index}
                        card={card}
                        index={index}
                        onAccept={acceptAssignedCard}
                        onReject={rejectAssignedCard}
                        onStartScan={openScannerForCard}
                        onMarkPicked={(c, pkg, key) => openScanVerify(c, index, 'pickup', pkg, key)}
                        onMarkDropped={(c, pkg, key) => openScanVerify(c, index, 'delivery', pkg, key)}
                        onSeeMore={showFullDealDetails}
                        onCardPress={openCardTracking}
                        onStartPickup={(card) => navigation.navigate('PackagePickupScreen', { card, onUpdate: loadNewAssignedCards })}
                      />
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* FULL DEAL DETAILS MODAL */}
      <Modal visible={showDealModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Deal Details</Text>

              {selectedDeal && (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 2 }}>
                    {selectedDeal.products_info?.[0] || selectedDeal.deal_id || 'New Assigned Deal'}
                  </Text>
                  {!!selectedDeal.deal_id && (
                    <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                      Deal ID: {selectedDeal.deal_id}
                    </Text>
                  )}
                  <Text>Assigned: {selectedDeal.assignedAt ? new Date(selectedDeal.assignedAt).toLocaleString() : '—'}</Text>
                  <Text>Status: {selectedDeal.status || 'pending'}</Text>

                  {/* Full address / delivery details block */}
                  <View style={styles.modalAddressBlock}>
                    <View style={styles.modalAddrHeaderRow}>
                      <Ionicons name="location" size={14} color="#3b82f6" />
                      <Text style={styles.modalAddrHeaderText}>Delivery Details</Text>
                    </View>

                    <View style={styles.modalAddrRow}>
                      <Text style={styles.modalAddrLabel}>Address</Text>
                      <Text style={styles.modalAddrValue}>{selectedDeal.address || 'Not provided'}</Text>
                    </View>

                    {!!selectedDeal.city && (
                      <View style={styles.modalAddrRow}>
                        <Text style={styles.modalAddrLabel}>City</Text>
                        <Text style={styles.modalAddrValue}>{selectedDeal.city}</Text>
                      </View>
                    )}

                    {!!selectedDeal.pincode && (
                      <View style={styles.modalAddrRow}>
                        <Text style={styles.modalAddrLabel}>Pincode</Text>
                        <Text style={styles.modalAddrValue}>{selectedDeal.pincode}</Text>
                      </View>
                    )}

                    {!!selectedDeal.landmark && (
                      <View style={styles.modalAddrRow}>
                        <Text style={styles.modalAddrLabel}>Landmark</Text>
                        <Text style={styles.modalAddrValue}>{selectedDeal.landmark}</Text>
                      </View>
                    )}

                    {!!selectedDeal.contact_name && (
                      <View style={styles.modalAddrRow}>
                        <Text style={styles.modalAddrLabel}>Contact</Text>
                        <Text style={styles.modalAddrValue}>{selectedDeal.contact_name}</Text>
                      </View>
                    )}

                    {!!selectedDeal.contact_number && (
                      <TouchableOpacity
                        style={styles.modalAddrRow}
                        onPress={() => Linking.openURL(`tel:${selectedDeal.contact_number}`)}
                      >
                        <Text style={styles.modalAddrLabel}>Phone</Text>
                        <Text style={[styles.modalAddrValue, { color: '#3b82f6' }]}>
                          {selectedDeal.contact_number}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={{ marginTop: 20, fontWeight: '700', marginBottom: 8 }}>All Products:</Text>
                  {selectedDeal.products_info?.map((prod, i) => (
                    <Text key={i} style={{ marginVertical: 4, fontSize: 14, paddingLeft: 8 }}>
                      • {prod}
                    </Text>
                  ))}

                  {(!selectedDeal.products_info || selectedDeal.products_info.length === 0) && (
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REJECT REASON MODAL — same visual language as the Deal Details
          modal above (dark overlay + white rounded card, icon header).
          Pressing "Submit" is the only path that actually removes the
          card + marks it rejected (see confirmRejectCard). */}
      <Modal visible={rejectModalVisible} transparent animationType="slide" onRequestClose={closeRejectModal}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.rejectHeaderRow}>
                <View style={styles.rejectHeaderIconWrap}>
                  <Ionicons name="close-circle-outline" size={22} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rejectHeaderTitle}>Reject Deal</Text>
                  {!!rejectTarget?.card?.deal_id && (
                    <Text style={styles.rejectHeaderSub}>
                      {rejectTarget.card.deal_id}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.rejectLabel}>Reason for rejection</Text>
              <TextInput
                style={styles.rejectInput}
                placeholder="Type the reason here..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={rejectReason}
                onChangeText={(v) => {
                  setRejectReason(v);
                  if (rejectError) setRejectError('');
                }}
              />
              {!!rejectError && <Text style={styles.rejectErrorText}>{rejectError}</Text>}

              <View style={styles.rejectBtnRow}>
                <TouchableOpacity
                  style={styles.rejectCancelBtn}
                  onPress={closeRejectModal}
                >
                  <Text style={styles.rejectCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectSubmitBtn}
                  onPress={confirmRejectCard}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                  <Text style={styles.rejectSubmitBtnText}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PER-CARD TRACKING MODAL */}
      <LogisticCardTrackingModal
        visible={trackingModalVisible}
        card={trackingModalCard}
        onClose={closeCardTracking}
        onConfirmPickup={handleConfirmPickupFromModal}
        onMarkDelivered={handleMarkDeliveredFromModal}
      />

      {/* SCAN + VERIFY GATE — the only path that can flip a card to
          Picked/Delivered. Status changes only once the driver explicitly
          confirms here (see handleVerifyConfirmed). */}
      <PackageScanVerifyModal
        visible={verifyModalVisible}
        pkg={verifyPkg}
        mode={verifyTarget?.action === 'delivery' ? 'delivery' : 'pickup'}
        onVerified={handleVerifyConfirmed}
        onClose={closeScanVerify}
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
  // Delivery-details block inside the full deal modal
  modalAddressBlock: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    gap: 8,
  },
  modalAddrHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4,
  },
  modalAddrHeaderText: {
    fontSize: 12, fontWeight: '700', color: '#3b82f6',
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  modalAddrRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
  },
  modalAddrLabel: {
    fontSize: 11, color: '#94a3b8', fontWeight: '700', width: 80,
    textTransform: 'uppercase', letterSpacing: 0.2,
  },
  modalAddrValue: {
    fontSize: 13, color: '#1e293b', fontWeight: '500', flex: 1, textAlign: 'right',
  },

  // Reject-reason popup — same modalOverlay/modalContent shell as the
  // Deal Details modal, plus its own header/input/button styling.
  rejectHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18,
  },
  rejectHeaderIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  rejectHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  rejectHeaderSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rejectLabel: {
    fontSize: 12, fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8,
  },
  rejectInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1e293b',
    textAlignVertical: 'top', minHeight: 90, backgroundColor: '#F8FAFC',
  },
  rejectErrorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: 8 },
  rejectBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  rejectCancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f5f9', paddingVertical: 13, borderRadius: 10,
  },
  rejectCancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },
  rejectSubmitBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#ef4444', paddingVertical: 13, borderRadius: 10,
  },
  rejectSubmitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
  offTextContainer: { alignItems: 'center', paddingHorizontal: 30 },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message: { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 10 },

  // Panel that hosts the "new" deal cards on the toggle-off screen
  offCardsPanel: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  offCardsPanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4, paddingBottom: 10,
  },
  offCardsPanelDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff',
  },
  offCardsPanelTitle: {
    fontSize: 12.5, fontWeight: '700', color: '#fff',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  fixedTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', elevation: 6,
  },
  // Section header — dot + title, matching SurveyerScreen's design language
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 2, paddingTop: 4, paddingBottom: 10,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyText: {
    textAlign: 'center', marginTop: 30,
    color: '#999', fontSize: 14, paddingHorizontal: 30,
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
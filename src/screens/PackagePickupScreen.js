import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import PackageScanVerifyModal from '../components/PackageScanVerifyModal';
import DispatchForm from '../components/DispatchForm';
import {
  getLocalProgress,
  setLocalDispatchStatus,
  setLocalPackageStage,
  setLocalPackageFormDone,
  updatePackageStatusRemote,
  updateDispatchStatusRemote,
} from '../service/dispatchProgressService';
import { useLogisticTracking } from '../service/logisticService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import API from '../api/api1';
import { enqueue } from '../service/syncQueue';

// Stage → { label, color, icon } for the per-package status pill
const STAGE_CONFIG = {
  pending:            { label: 'Not Scanned',   color: '#94a3b8', icon: 'ellipse-outline' },
  pickup_verified:    { label: 'Verified',      color: '#4f46e5', icon: 'checkmark-circle-outline' },
  picked:             { label: 'Picked Up',     color: '#0ea5e9', icon: 'cube-outline' },
  reached:            { label: 'Reached',       color: '#f97316', icon: 'location' },
  delivery_verified:  { label: 'Verified',      color: '#8b5cf6', icon: 'checkmark-circle-outline' },
  delivered:          { label: 'Delivered',     color: '#22c55e', icon: 'checkmark-done-circle' },
};
// Haversine — meters
const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (m) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const DISTANCE_SYNCED_KEY = 'distance_synced_package_ids';

const isDistanceAlreadySynced = async (packageKey) => {
  try {
    const raw = await AsyncStorage.getItem(DISTANCE_SYNCED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return ids.includes(packageKey);
  } catch (e) {
    return false;
  }
};

const markDistanceSynced = async (packageKey) => {
  try {
    const raw = await AsyncStorage.getItem(DISTANCE_SYNCED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(packageKey)) {
      ids.push(packageKey);
      await AsyncStorage.setItem(DISTANCE_SYNCED_KEY, JSON.stringify(ids));
    }
  } catch (e) {}
};

const getLoggedInUserName = async () => {
  try {
    const userData = await AsyncStorage.getItem(USER_DATA);
    const parsed = userData ? JSON.parse(userData) : null;
    return parsed?.UserInfo?.name || parsed?.UserInfo?.userName || '';
  } catch (e) {
    return '';
  }
};

const postDealDistanceToSite = async (card, pkg, toSiteKm) => {
  const packageKey = `${card.deal_id}_${pkg.package_number}`;
  if (await isDistanceAlreadySynced(packageKey)) return;

  const driverName = await getLoggedInUserName();
  const payload = {
    deal_id: card.deal_id,
    deal_name: card.deal_id,
    mobile: card.contact_number || card.mobile || '',
    to_site: Number(toSiteKm.toFixed(2)),
    surveyor_name: driverName,
  };

  try {
    await API.post('/location/distance', payload);
    await markDistanceSynced(packageKey);
  } catch (err) {
    if (err?.response?.status === 409) {
      await markDistanceSynced(packageKey);
      return;
    }
    await enqueue(`deal_distance_${packageKey}`, 'DEAL_DISTANCE', payload);
  }
};

const openDirections = (pkg, fallbackAddress) => {
  const destination =
    pkg.latitude && pkg.longitude
      ? `${pkg.latitude},${pkg.longitude}`
      : encodeURIComponent(pkg.shipping_street || pkg.billing_street || fallbackAddress || '');

  if (!destination) {
    Alert.alert('No address', 'This package has no address to navigate to.');
    return;
  }

  const url = Platform.select({
    ios: `maps://?daddr=${destination}&dirflg=d`,
    android: `google.navigation:q=${destination}`,
  });

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) return Linking.openURL(url);
      // fallback — plain Google Maps directions URL, opens in browser/app either way
      return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
    })
    .catch(() => Alert.alert('Error', 'Could not open maps app.'));
};

const PackagePickupScreen = ({ navigation, route }) => {
  const { card, onUpdate } = route.params || {};
  const [packages, setPackages] = useState(card?.packages || []);
  const [stages, setStages] = useState({}); // { [package_number]: stage }
  const [formDone, setFormDone] = useState({}); // { [package_number]: true }
const [formModal, setFormModal] = useState({ visible: false, pkg: null });

  // 🆕 initialMode: 'scan' | 'manual' — controls whether the modal opens on
  // the camera or jumps straight into the manual entry form.
  const [scanModal, setScanModal] = useState({ visible: false, pkg: null, mode: 'pickup', initialMode: 'scan' });
  // 👇 delivery order popup + per-package "started" tracking
const [startedPackages, setStartedPackages] = useState({}); // { [package_number]: true }
const [startPopupVisible, setStartPopupVisible] = useState(false);
const [hasShownStartPopup, setHasShownStartPopup] = useState(false);
const [activePackageKey, setActivePackageKey] = useState(null); // ippo edhu package active-a irukku
const [heldPackages, setHeldPackages] = useState({});
  const isMounted = useRef(true);
  const { currentLocation, startTracking } = useLogisticTracking(isMounted);
  useEffect(() => {
  console.log('📍 currentLocation:', currentLocation);
}, [currentLocation]);

  useEffect(() => {
    isMounted.current = true;
    startTracking();
    return () => { isMounted.current = false; };
  }, []);

  const getDistanceText = (pkg) => {
    const lat = parseFloat(pkg.latitude);
    const lng = parseFloat(pkg.longitude);
    console.log('📦 pkg coords:', pkg.package_number, pkg.latitude, pkg.longitude);
    if (isNaN(lat) || isNaN(lng)) return null;   // backend-la coords illa → box hide
    if (!currentLocation) return '...';          // GPS innum varala
    return formatDistance(
      getDistanceMeters(currentLocation.latitude, currentLocation.longitude, lat, lng)
    );
  };

useEffect(() => {
  (async () => {
    const progress = await getLocalProgress(card.deal_id);
    const merged = {};
    const forms = {};
    setStages(merged);
    setFormDone(forms);
    (card?.packages || []).forEach((pkg) => {
      const local = progress.packages?.[pkg.package_number];
      merged[pkg.package_number] = local?.stage || 'pending';
      if (local?.formDone) forms[pkg.package_number] = true;
    });
    setStages(merged);
    setFormDone(forms);

    // started packages-a AsyncStorage-la irundhu restore pannunga
    try {
      const raw = await AsyncStorage.getItem(`started_packages_${card.deal_id}`);
      const ids = raw ? JSON.parse(raw) : [];
      if (ids.length > 0) {
        const startedMap = {};
        ids.forEach((id) => { startedMap[id] = true; });
        setStartedPackages(startedMap);
        setHasShownStartPopup(true); // already start pannirundha, popup thirumbа vekaadhu
      }
    } catch (e) {}
    try {
  const activeRaw = await AsyncStorage.getItem(`active_package_${card.deal_id}`);
  if (activeRaw) setActivePackageKey(activeRaw);

  const heldRaw = await AsyncStorage.getItem(`held_packages_${card.deal_id}`);
  const heldIds = heldRaw ? JSON.parse(heldRaw) : [];
  if (heldIds.length > 0) {
    const heldMap = {};
    heldIds.forEach((id) => { heldMap[id] = true; });
    setHeldPackages(heldMap);
  }
} catch (e) {}
  })();
}, [card]);
// 👇 Ella packages-um 'picked' aanadhum, delivery order popup automatic-a varும்
useEffect(() => {
  if (hasShownStartPopup) return;
  if (packages.length === 0) return;

  const allPicked = packages.every((p) => stageOf(p) === 'picked');
  if (allPicked) {
    setStartPopupVisible(true);
    setHasShownStartPopup(true);
  }
}, [stages, packages, hasShownStartPopup]);

  const stageOf = (pkg) => stages[pkg.package_number] || 'pending';

  const advanceStage = useCallback(async (pkg, nextStage) => {
    setStages((prev) => ({ ...prev, [pkg.package_number]: nextStage }));
    await setLocalPackageStage(card.deal_id, pkg.package_number, nextStage);
  }, [card]);

  // ── Actions ────────────────────────────────────────────────────────────
  // mode: 'pickup' | 'delivery'  |  entryMode: 'scan' | 'manual'
  const openScan = (pkg, mode, entryMode = 'scan') =>
    setScanModal({ visible: true, pkg, mode, initialMode: entryMode });
  const closeScan = () => setScanModal({ visible: false, pkg: null, mode: 'pickup', initialMode: 'scan' });

const handleVerified = async (matched, pkg, mode, meta) => {
  if (mode === 'pickup') {
    await advanceStage(pkg, 'pickup_verified');
  } else {
    await advanceStage(pkg, 'delivery_verified');
  }
  if (meta?.manual) {
    console.log('📝 Package confirmed manually:', pkg.package_number, meta);
  }
};

const confirmPickup = async (pkg) => {
  await updatePackageStatusRemote(card.deal_id, pkg.package_number, 'shipped');
  await advanceStage(pkg, 'picked');
  await setLocalDispatchStatus(card.deal_id, 'In-Progress');

  // 👇 case 0 — "package ready" — dispatch ku ONE-TIME mattum
  if (!(await isCase0AlreadySent(card.deal_id))) {
    await sendDeliveryNotification(card.contact_number || card.mobile, 0);
    await markCase0Sent(card.deal_id);
  }
};

const markReached = async (pkg) => {
  await advanceStage(pkg, 'reached');

  const lat = parseFloat(pkg.latitude);
  const lng = parseFloat(pkg.longitude);
  if (!isNaN(lat) && !isNaN(lng) && currentLocation) {
    const meters = getDistanceMeters(
      currentLocation.latitude, currentLocation.longitude, lat, lng
    );
    postDealDistanceToSite(card, pkg, meters / 1000);
  }

  // 👇 case 2 — "arrived"
  sendDeliveryNotification(card.contact_number || card.mobile, 2);
};
// Backend triggerDeliveryNotification-ku POST pannும் helper
const sendDeliveryNotification = async (mobile, scenarioType, extra = {}) => {
  const cleanedMobile = String(mobile || '').replace(/\D/g, '');
  if (!cleanedMobile) {
    console.log('🚫 notification skip — no mobile number');
    return;
  }

  try {
    console.log('📤 sending notification:', cleanedMobile, scenarioType);
    const res = await API.post('/logistics/triggerdelivery-notification', {
      customerMobile: cleanedMobile,
      scenarioType,
      ...extra,
    });
    console.log('✅ notification sent:', res.data);
  } catch (err) {
    console.log('❌ notification FAILED:', err?.response?.status, err?.response?.data || err?.message);
    await enqueue(
      `delivery_notif_${cleanedMobile}_${scenarioType}_${Date.now()}`,
      'DELIVERY_NOTIFICATION',
      { customerMobile: cleanedMobile, scenarioType, ...extra }
    );
  }
};

// case 0 ("package ready") — DISPATCH ku ONE-TIME mattum, first package pick aanadhum
const CASE0_SENT_KEY = 'case0_notif_sent_deals';

const isCase0AlreadySent = async (dealId) => {
  try {
    const raw = await AsyncStorage.getItem(CASE0_SENT_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return ids.includes(dealId);
  } catch (e) {
    return false;
  }
};

const markCase0Sent = async (dealId) => {
  try {
    const raw = await AsyncStorage.getItem(CASE0_SENT_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(dealId)) {
      ids.push(dealId);
      await AsyncStorage.setItem(CASE0_SENT_KEY, JSON.stringify(ids));
    }
  } catch (e) {}
};
const startDelivery = async (pkg) => {
  const key = pkg.package_number;

  setStartedPackages((prev) => ({ ...prev, [key]: true }));
  setActivePackageKey(key);
  setHeldPackages((prev) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });

  try {
    const startedKey = `started_packages_${card.deal_id}`;
    const raw = await AsyncStorage.getItem(startedKey);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(key)) {
      ids.push(key);
      await AsyncStorage.setItem(startedKey, JSON.stringify(ids));
    }
    await AsyncStorage.setItem(`active_package_${card.deal_id}`, key);
  } catch (e) {}

  setStartPopupVisible(false);

  // case 1 — "dispatched"
  sendDeliveryNotification(card.contact_number || card.mobile, 1);
};
// 👇 Active package-a pause pannுறadhu — matha packages start aagும் padி
const holdDelivery = async (pkg) => {
  const key = pkg.package_number;

  setHeldPackages((prev) => ({ ...prev, [key]: true }));
  setActivePackageKey(null);

  try {
    const heldKey = `held_packages_${card.deal_id}`;
    const raw = await AsyncStorage.getItem(heldKey);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(key)) {
      ids.push(key);
      await AsyncStorage.setItem(heldKey, JSON.stringify(ids));
    }
    await AsyncStorage.removeItem(`active_package_${card.deal_id}`);
  } catch (e) {}
};

// 👇 Hold pannina package-a thirumbа active pannுறadhu
const resumeDelivery = async (pkg) => {
  const key = pkg.package_number;

  if (activePackageKey && activePackageKey !== key) {
    Alert.alert('Wait', 'Innoru package delivery ippo active-a irukku. Adha mudinjாmа illa Hold pannிட்டு, idha resume pannunga.');
    return;
  }

  setHeldPackages((prev) => {
    const updated = { ...prev };
    delete updated[key];
    return updated;
  });
  setActivePackageKey(key);

  try {
    const heldKey = `held_packages_${card.deal_id}`;
    const raw = await AsyncStorage.getItem(heldKey);
    const ids = raw ? JSON.parse(raw) : [];
    const filtered = ids.filter((id) => id !== key);
    await AsyncStorage.setItem(heldKey, JSON.stringify(filtered));
    await AsyncStorage.setItem(`active_package_${card.deal_id}`, key);
  } catch (e) {}
};
  const openDeliveryForm = (pkg) =>
  setFormModal({
    visible: true,
    pkg: {
      deal_id: card.deal_id,                       // dispatch no. (as before)
      package_number: pkg.package_number,
      dispatch_number: card.deal_id,
      crm_deal_id: pkg.crm_deal_id,                // upload endpoint-ku mattum
    },
  });

const closeDeliveryForm = () => setFormModal({ visible: false, pkg: null });

// Form submit aanadhum stage maaradhu, formDone mattum true
const handleFormSubmitted = async () => {
  const pkgNumber = formModal.pkg?.package_number;
  if (!pkgNumber) return;
  setFormDone((prev) => ({ ...prev, [pkgNumber]: true }));
  await setLocalPackageFormDone(card.deal_id, pkgNumber);
};

const markDelivered = async (pkg) => {
  await updatePackageStatusRemote(card.deal_id, pkg.package_number, 'delivered');
  await advanceStage(pkg, 'delivered');
  await setLocalDispatchStatus(card.deal_id, 'picked');

  if (activePackageKey === pkg.package_number) {
    setActivePackageKey(null);
    try {
      await AsyncStorage.removeItem(`active_package_${card.deal_id}`);
    } catch (e) {}
  }

  await sendDeliveryNotification(card.contact_number || card.mobile, 3);
  await sendDeliveryNotification(card.contact_number || card.mobile, 4);
};

  const allDelivered = packages.length > 0 && packages.every((p) => stageOf(p) === 'delivered');

  const Completedispatch = async () => {
    await updateDispatchStatusRemote(card.deal_id, 'delivered');
    await setLocalDispatchStatus(card.deal_id, 'Completed');
    onUpdate?.();
    Alert.alert('Completed', 'Dispatch marked as Completed.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const getPackageActions = (pkg) => {
    const stage = stageOf(pkg);
    switch (stage) {
      case 'pending':
        return [
          { key: 'scan', icon: 'scan-outline', label: 'Scan', bg: '#4f46e5', onPress: () => openScan(pkg, 'pickup', 'scan') },
          { key: 'manual', icon: 'create-outline', label: 'Manual', bg: '#fff', border: '#4f46e5', iconColor: '#4f46e5', textColor: '#4f46e5', onPress: () => openScan(pkg, 'pickup', 'manual') },
        ];
      case 'pickup_verified':
        return [
          { key: 'confirm', icon: 'checkmark-circle-outline', label: 'Confirm', bg: '#0ea5e9', onPress: () => confirmPickup(pkg) },
        ];
      case 'picked': {
  const key = pkg.package_number;
  const isHeld = heldPackages[key];
  const isStarted = startedPackages[key];

  // Hold pannina package — Resume button, matha package active-a irundha disable
  if (isHeld) {
    return [
      {
        key: 'resume', icon: 'play-circle-outline', label: 'Resume',
        bg: activePackageKey ? '#cbd5e1' : '#4f46e5',
        disabled: !!activePackageKey,
        onPress: () => resumeDelivery(pkg),
      },
    ];
  }

  // Innும் start pannாத package
  if (!isStarted) {
    const canStart = !activePackageKey; // vேறு onnும் active-a illaanaa mattum start pannலаம்
    return [
      {
        key: 'start', icon: 'play-circle-outline', label: 'Start',
        bg: canStart ? '#22c55e' : '#cbd5e1',
        disabled: !canStart,
        onPress: () => startDelivery(pkg),
      },
    ];
  }

  // Idhே active package — Navigate + Reached + Hold
  return [
    { key: 'navigate', icon: 'navigate-outline', label: 'Navigate', bg: '#f97316', onPress: () => openDirections(pkg, card.address) },
    { key: 'reached', icon: 'location', label: 'Reached', bg: '#334155', onPress: () => markReached(pkg) },
    { key: 'hold', icon: 'pause-circle-outline', label: 'Hold', bg: '#ef4444', onPress: () => holdDelivery(pkg) },
  ];
}
      case 'reached':
  return [
    { key: 'scan-delivery', icon: 'scan-outline', label: 'Scan', bg: '#8b5cf6', onPress: () => openScan(pkg, 'delivery', 'scan') },
    { key: 'manual-delivery', icon: 'create-outline', label: 'Manual', bg: '#fff', border: '#8b5cf6', iconColor: '#8b5cf6', textColor: '#8b5cf6', onPress: () => openScan(pkg, 'delivery', 'manual') },
  ];
case 'delivery_verified':
  if (!formDone[pkg.package_number]) {
    return [
      { key: 'form', icon: 'document-text-outline', label: 'Form', bg: '#8b5cf6', onPress: () => openDeliveryForm(pkg) },
    ];
  }
  return [
    { key: 'delivered', icon: 'checkmark-done', label: 'Delivered', bg: '#22c55e', onPress: () => markDelivered(pkg) },
  ];
      case 'delivered':
        return [
          { key: 'done', icon: 'checkmark-done-circle', label: 'Done', bg: '#EAF3DE', iconColor: '#3B6D11', textColor: '#3B6D11', disabled: true },
        ];
      default:
        return [];
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{card?.deal_id || 'Dispatch'}</Text>
            <Text style={styles.headerSub}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {packages.map((pkg, idx) => {
            const stage = stageOf(pkg);
            const cfg = STAGE_CONFIG[stage];
            const itemCount = (pkg.package_items || []).length;
            const actions = getPackageActions(pkg);

            return (
              <View key={pkg.package_number || idx} style={styles.pkgCard}>
                <View style={styles.pkgRow}>
                  {/* Left side — info */}
                  <View style={styles.pkgInfoCol}>
                    <View style={styles.pkgTopRow}>
                      <Text style={styles.pkgTitle} numberOfLines={1}>{pkg.package_number || `Package ${idx + 1}`}</Text>
                    </View>
                    <Text style={styles.pkgMeta}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>

                    {/* 🆕 Product details — name + quantity (+ serial numbers if present)
                        pulled straight from pkg.package_items, so the driver can see
                        exactly what's in this package right on this screen. */}
                    {itemCount > 0 && (
                      <View style={styles.productsList}>
                        {(pkg.package_items || []).map((item, i) => (
                          <View key={i} style={styles.productRow}>
                            <Ionicons name="cube-outline" size={12} color="#64748b" style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.productName} numberOfLines={2}>
                                {item.product_name || 'Unnamed product'}
                                {item.quantity ? `  ×${item.quantity}` : ''}
                              </Text>
                              {Array.isArray(item.serial_number) && item.serial_number.length > 0 && (
                                <Text style={styles.productSerial} numberOfLines={1}>
                                  SN: {item.serial_number.join(', ')}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={[styles.stagePill, { backgroundColor: cfg.color + '1A' }]}>
                      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                      <Text style={[styles.stagePillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {/* Right side — LeadCard-style rectangle action buttons, stacked vertically */}
                  <View style={styles.pkgActionCol}>
                      {actions.map((a) => (
                      <TouchableOpacity
                        key={a.key}
                        disabled={a.disabled}
                        activeOpacity={0.7}
                        onPress={a.onPress}
                        style={[
                          styles.commonBtn,
                          { backgroundColor: a.bg },
                          a.border && { borderWidth: 1.4, borderColor: a.border },
                        ]}
                      >
                        <Ionicons name={a.icon} size={13} color={a.iconColor || '#fff'} style={{ marginRight: 4 }} />
                        <Text style={[styles.commonBtnText, { color: a.textColor || '#fff' }]} numberOfLines={1}>
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {/* Reached button-ku keela distance */}
  {stage === 'picked' && getDistanceText(pkg) && (
    <View style={styles.distanceBox}>
      <Text style={styles.distanceLabel}>Distance</Text>
      <Text style={styles.reachDistance}>{getDistanceText(pkg)}</Text>
    </View>
  )}
                  </View>
                </View>
              </View>
            );
          })}

          {packages.length === 0 && (
            <Text style={styles.emptyText}>No packages found on this dispatch.</Text>
          )}
        </ScrollView>

        {allDelivered && (
          <View style={styles.completeBar}>
            <TouchableOpacity style={styles.completeBtn} onPress={Completedispatch}>
              <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
              <Text style={styles.completeBtnText}>Complete Dispatch</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <PackageScanVerifyModal
        visible={scanModal.visible}
        pkg={scanModal.pkg}
        mode={scanModal.mode}
        initialMode={scanModal.initialMode}
        onVerified={(matched, rawText, meta) => handleVerified(matched, scanModal.pkg, scanModal.mode, meta)}
        onClose={closeScan}
      />
      <DispatchForm
  visible={formModal.visible}
  pkg={formModal.pkg}
  onClose={closeDeliveryForm}
  onSubmitted={handleFormSubmitted}
/>
 {/* 👇 IDHA ADD PANNUNGA — Delivery order popup */}
      <Modal
        visible={startPopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStartPopupVisible(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>Which package first?</Text>
            <Text style={styles.popupSub}>
              Ella packages-um pickup aayiduchu. Delivery order select pannunga.
            </Text>

            <ScrollView style={{ maxHeight: 320, marginTop: 12 }}>
              {packages.map((pkg, idx) => (
                <TouchableOpacity
                  key={pkg.package_number || idx}
                  style={styles.popupRow}
                  onPress={() => startDelivery(pkg)}
                >
                  <View style={styles.popupRowIcon}>
                    <MaterialCommunityIcons name="cube-outline" size={18} color="#4f46e5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.popupRowTitle}>
                      {pkg.package_number || `Package ${idx + 1}`}
                    </Text>
                    <Text style={styles.popupRowMeta}>
                      {(pkg.package_items || []).length} items
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.popupSkipBtn}
              onPress={() => setStartPopupVisible(false)}
            >
              <Text style={styles.popupSkipText}>Later select pannuren</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PackagePickupScreen;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eef2f7',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },

  pkgCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#eef2f7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  pkgRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  pkgInfoCol: { flex: 1 },
  pkgTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pkgTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  pkgMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // 🆕 Product details block inside each package card
  productsList: { marginTop: 8, gap: 6 },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  productName: { fontSize: 12.5, fontWeight: '600', color: '#334155', lineHeight: 17 },
  productSerial: { fontSize: 10.5, color: '#94a3b8', marginTop: 1 },

  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginTop: 8,
  },
  stagePillText: { fontSize: 10.5, fontWeight: '700' },

  // 🆕 Right-side action column — LeadCard-style rectangle buttons, stacked
  pkgActionCol: { justifyContent: 'flex-start', gap: 6 },
  commonBtn: {
    width: 98, height: 34, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  commonBtnText: { fontSize: 11, fontWeight: 'bold' },

  // ⬇️ IDHA ADD PANNU
  distanceBox: {
    width: 98, backgroundColor: '#fff7ed', borderWidth: 1.5,
    borderColor: '#f97316', borderRadius: 8,
    paddingVertical: 4, alignItems: 'center',
  },
  distanceLabel: { fontSize: 10, color: '#f97316', fontWeight: '600' },
  reachDistance: { fontSize: 15, color: '#f97316', fontWeight: '800', lineHeight: 20 },
  // ⬆️

  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

  completeBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eef2f7',
  },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 12,
  },
  completeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  popupOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  popupBox: {
    backgroundColor: '#fff', width: '100%', borderRadius: 16, padding: 20,
  },
  popupTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  popupSub: { fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 4 },
  popupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  popupRowIcon: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  popupRowTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  popupRowMeta: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  popupSkipBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  popupSkipText: { fontSize: 12.5, color: '#94a3b8', fontWeight: '600' },
});
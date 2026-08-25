import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import PackageScanVerifyModal from '../components/PackageScanVerifyModal';
import {
  getLocalProgress,
  setLocalDispatchStatus,
  setLocalPackageStage,
  updatePackageStatusRemote,
  updateDispatchStatusRemote,
} from '../service/dispatchProgressService';

// Stage → { label, color, icon } for the per-package status pill
const STAGE_CONFIG = {
  pending:            { label: 'Not Scanned',   color: '#94a3b8', icon: 'ellipse-outline' },
  pickup_verified:    { label: 'Verified',      color: '#4f46e5', icon: 'checkmark-circle-outline' },
  picked:             { label: 'Picked Up',     color: '#0ea5e9', icon: 'cube-outline' },
  reached:            { label: 'Reached',       color: '#f97316', icon: 'location' },
  delivery_verified:  { label: 'Verified',      color: '#8b5cf6', icon: 'checkmark-circle-outline' },
  delivered:          { label: 'Delivered',     color: '#22c55e', icon: 'checkmark-done-circle' },
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

  // 🆕 initialMode: 'scan' | 'manual' — controls whether the modal opens on
  // the camera or jumps straight into the manual entry form.
  const [scanModal, setScanModal] = useState({ visible: false, pkg: null, mode: 'pickup', initialMode: 'scan' });

  useEffect(() => {
    (async () => {
      const progress = await getLocalProgress(card.deal_id);
      const merged = {};
      (card?.packages || []).forEach((pkg) => {
        merged[pkg.package_number] = progress.packages?.[pkg.package_number]?.stage || 'pending';
      });
      setStages(merged);
    })();
  }, [card]);

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
    if (!matched) return; // stay on the result screen so driver can rescan/override
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
    await setLocalDispatchStatus(card.deal_id, 'inprogress');
  };

  const markReached = async (pkg) => {
    await advanceStage(pkg, 'reached');
  };

  const markDelivered = async (pkg) => {
    await updatePackageStatusRemote(card.deal_id, pkg.package_number, 'delivered');
    await advanceStage(pkg, 'delivered');
    await setLocalDispatchStatus(card.deal_id, 'picked');
  };

  const allDelivered = packages.length > 0 && packages.every((p) => stageOf(p) === 'delivered');

  const completeDispatch = async () => {
    await updateDispatchStatusRemote(card.deal_id, 'delivered');
    await setLocalDispatchStatus(card.deal_id, 'completed');
    onUpdate?.();
    Alert.alert('Completed', 'Dispatch marked as completed.', [
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
      case 'picked':
        return [
          { key: 'navigate', icon: 'navigate-outline', label: 'Navigate', bg: '#f97316', onPress: () => openDirections(pkg, card.address) },
          { key: 'reached', icon: 'location', label: 'Reached', bg: '#334155', onPress: () => markReached(pkg) },
        ];
      case 'reached':
        return [
          { key: 'scan-delivery', icon: 'scan-outline', label: 'Scan', bg: '#8b5cf6', onPress: () => openScan(pkg, 'delivery', 'scan') },
          { key: 'manual-delivery', icon: 'create-outline', label: 'Manual', bg: '#fff', border: '#8b5cf6', iconColor: '#8b5cf6', textColor: '#8b5cf6', onPress: () => openScan(pkg, 'delivery', 'manual') },
        ];
      case 'delivery_verified':
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
            <TouchableOpacity style={styles.completeBtn} onPress={completeDispatch}>
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
});
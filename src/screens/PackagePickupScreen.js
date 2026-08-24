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

  const [scanModal, setScanModal] = useState({ visible: false, pkg: null, mode: 'pickup' });

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
  const openScan = (pkg, mode) => setScanModal({ visible: true, pkg, mode });
  const closeScan = () => setScanModal({ visible: false, pkg: null, mode: 'pickup' });

  const handleVerified = async (matched, pkg, mode) => {
    if (!matched) return; // stay on the result screen so driver can rescan/override
    if (mode === 'pickup') {
      await advanceStage(pkg, 'pickup_verified');
    } else {
      await advanceStage(pkg, 'delivery_verified');
    }
  };

    const confirmPickup = async (pkg) => {
    await updatePackageStatusRemote(card.deal_id, pkg.package_number, 'shipped');
    await advanceStage(pkg, 'picked');
    await setLocalDispatchStatus(card.deal_id, 'inprogress'); // 🆕 always advance — no dead condition
  };

  const markReached = async (pkg) => {
    await advanceStage(pkg, 'reached');
  };

  const markDelivered = async (pkg) => {
    await updatePackageStatusRemote(card.deal_id, pkg.package_number, 'delivered');
    await advanceStage(pkg, 'delivered');
    await setLocalDispatchStatus(card.deal_id, 'picked'); // still "picked" overall until ALL delivered
  };

  const allDelivered = packages.length > 0 && packages.every((p) => stageOf(p) === 'delivered');

  const completeDispatch = async () => {
    // Backend already auto-marks the dispatch Delivered once every package is
    // Delivered — this call just confirms/keeps it in sync.
    await updateDispatchStatusRemote(card.deal_id, 'delivered');
    await setLocalDispatchStatus(card.deal_id, 'completed');
    onUpdate?.();
    Alert.alert('Completed', 'Dispatch marked as completed.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  // ── Per-package action button, driven by current stage ───────────────────
  const renderPackageAction = (pkg) => {
    const stage = stageOf(pkg);
    switch (stage) {
      case 'pending':
        return (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]} onPress={() => openScan(pkg, 'pickup')}>
            <Ionicons name="scan-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Scan Package</Text>
          </TouchableOpacity>
        );
      case 'pickup_verified':
        return (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0ea5e9' }]} onPress={() => confirmPickup(pkg)}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Confirm Pickup</Text>
          </TouchableOpacity>
        );
      case 'picked':
        return (
          <View style={styles.dualBtnRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.flex1, { backgroundColor: '#f97316' }]} onPress={() => openDirections(pkg, card.address)}>
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.flex1, { backgroundColor: '#334155' }]} onPress={() => markReached(pkg)}>
              <Ionicons name="location" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Reached</Text>
            </TouchableOpacity>
          </View>
        );
      case 'reached':
        return (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]} onPress={() => openScan(pkg, 'delivery')}>
            <Ionicons name="scan-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Scan Delivery</Text>
          </TouchableOpacity>
        );
      case 'delivery_verified':
        return (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#22c55e' }]} onPress={() => markDelivered(pkg)}>
            <Ionicons name="checkmark-done" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Mark Delivered</Text>
          </TouchableOpacity>
        );
      case 'delivered':
        return (
          <View style={styles.deliveredPill}>
            <Ionicons name="checkmark-done-circle" size={14} color="#3B6D11" />
            <Text style={styles.deliveredPillText}>Delivered</Text>
          </View>
        );
      default:
        return null;
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

            return (
              <View key={pkg.package_number || idx} style={styles.pkgCard}>
                <View style={styles.pkgTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgTitle}>{pkg.package_number || `Package ${idx + 1}`}</Text>
                    <Text style={styles.pkgMeta}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={[styles.stagePill, { backgroundColor: cfg.color + '1A' }]}>
                    <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                    <Text style={[styles.stagePillText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                <Text style={styles.pkgAddress} numberOfLines={2}>
                  {pkg.shipping_street || pkg.billing_street || card.address || 'No address'}
                </Text>

                <View style={{ marginTop: 12 }}>{renderPackageAction(pkg)}</View>
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
        onVerified={(matched, rawText) => handleVerified(matched, scanModal.pkg, scanModal.mode)}
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
  pkgTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pkgTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  pkgMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  pkgAddress: { fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 17 },

  stagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  stagePillText: { fontSize: 10.5, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dualBtnRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },

  deliveredPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#EAF3DE', paddingVertical: 10, borderRadius: 10,
  },
  deliveredPillText: { color: '#3B6D11', fontWeight: '700', fontSize: 13 },

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
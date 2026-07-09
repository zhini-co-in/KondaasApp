import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ─────────────────────────────────────────────────────────────────────────────
// Builds the 3-step tracking list FOR THIS SPECIFIC CARD, based on its own
// status. No shared/global state — every card computes its own steps.
// ─────────────────────────────────────────────────────────────────────────────
const buildStepsForCard = (card) => {
  const status = card.status || 'pending';

  return [
    {
      id: 1,
      label: 'Product Scanned',
      sub: 'Verified at Receiving Stock',
      time: card.scannedAt
        ? new Date(card.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      // Card only reaches accepted/inprogress/picked/completed AFTER the
      // initial scan, so this step is done for anything past 'pending'.
      done: status !== 'pending',
    },
    {
      id: 2,
      label: 'Picked from Warehouse',
      sub: status === 'inprogress' ? 'Waiting for pickup confirmation' : '',
      time:
        status === 'picked' || status === 'completed'
          ? card.pickedAt
            ? new Date(card.pickedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''
          : '',
      done: status === 'picked' || status === 'completed',
    },
    {
      id: 3,
      label: 'Delivered to Installer',
      sub: status === 'picked' ? 'Complete delivery details below' : '',
      time:
        status === 'completed' && card.deliveredAt
          ? new Date(card.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
      done: status === 'completed',
    },
  ];
};

const LogisticCardTrackingModal = ({ visible, card, onClose, onConfirmPickup, onMarkDelivered }) => {
  if (!card) return null;

  const status = card.status || 'pending';
  const steps = buildStepsForCard(card);
  const products = card.products_info || [];
  const title = products[1] || card.deal_id || 'Assigned Deal';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Order Tracking</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Product info */}
            <View style={styles.productRow}>
              <View style={styles.productIconBox}>
                <MaterialCommunityIcons name="package-variant" size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={1}>{title}</Text>
                <Text style={styles.productSub}>#{card.deal_id || '—'}</Text>
              </View>
              {status !== 'pending' && (
                <View style={styles.scannedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                  <Text style={styles.scannedBadgeText}>Scanned</Text>
                </View>
              )}
            </View>

            {/* Load / Zone */}
            <View style={styles.metaRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>LOAD TO TRUCK</Text>
                <View style={styles.metaValueRow}>
                  <Ionicons name="cube-outline" size={14} color="#334155" />
                  <Text style={styles.metaValue}>{card.truckNo || 'TR-458'}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>ZONE LOCATION</Text>
                <View style={styles.metaValueRow}>
                  <Text style={styles.metaValue}>{card.address || 'Chennai'}</Text>
                  <Ionicons name="location-outline" size={14} color="#f97316" />
                </View>
              </View>
            </View>

            <Text style={styles.sectionLabel}>LIVE TRACKING & UPDATES</Text>

            {steps.map((step, index) => (
              <View key={step.id}>
                <View style={styles.stepRow}>
                  <View style={styles.stepLeft}>
                    <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
                      {step.done && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    {index < steps.length - 1 && (
                      <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 14 }}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.stepLabel, step.done && { color: '#22c55e' }]}>
                        {step.label}
                      </Text>
                      {!!step.time && <Text style={styles.stepTime}>{step.time}</Text>}
                    </View>
                    {!!step.sub && <Text style={styles.stepSub}>{step.sub}</Text>}
                  </View>
                </View>

                {/* Confirm Pickup — only for step 2, only when card is inprogress */}
                {step.id === 2 && status === 'inprogress' && (
                  <TouchableOpacity
                    style={styles.confirmPickupBtn}
                    onPress={() => onConfirmPickup?.(card)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.confirmPickupText}>Confirm Pickup</Text>
                  </TouchableOpacity>
                )}

                {/* Proof of delivery + Mark as Delivered — only once picked */}
                {step.id === 3 && status === 'picked' && (
                  <>
                    <TouchableOpacity style={styles.proofBox}>
                      <Ionicons name="camera-outline" size={20} color="#ef4444" />
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.proofTitle}>Proof of Delivery</Text>
                        <Text style={styles.proofSub}>Take photo or upload signature</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.markDeliveredBtn}
                      onPress={() => onMarkDelivered?.(card)}
                    >
                      <Ionicons name="checkmark-done" size={16} color="#fff" />
                      <Text style={styles.markDeliveredText}>Mark as Delivered</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}

            {status === 'completed' && (
              <View style={styles.completedPill}>
                <Ionicons name="checkmark-done-circle" size={16} color="#3B6D11" />
                <Text style={styles.completedPillText}>Delivered & Completed</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default LogisticCardTrackingModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '85%',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },

  productRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  productIconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  productName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  productSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  scannedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  scannedBadgeText: { fontSize: 11, color: '#22c55e', fontWeight: '600' },

  metaRow: {
    flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 10,
    padding: 12, marginBottom: 18,
  },
  metaLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginBottom: 4 },
  metaValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaValue: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },

  sectionLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 12 },

  stepRow: { flexDirection: 'row', gap: 12 },
  stepLeft: { alignItems: 'center', width: 24 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  stepDotDone: { backgroundColor: '#22c55e' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#e2e8f0', marginVertical: 4, minHeight: 20 },
  stepLineDone: { backgroundColor: '#22c55e' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  stepTime: { fontSize: 11, color: '#94a3b8' },
  stepSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

  confirmPickupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ED1C25', paddingVertical: 12, borderRadius: 10,
    marginLeft: 36, marginBottom: 16, marginTop: -6,
  },
  confirmPickupText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  proofBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12,
    marginLeft: 36, marginBottom: 12, marginTop: -6,
  },
  proofTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  proofSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  markDeliveredBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#111827', paddingVertical: 13, borderRadius: 10,
    marginLeft: 36, marginBottom: 16,
  },
  markDeliveredText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  completedPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#EAF3DE', paddingVertical: 12, borderRadius: 10, marginTop: 6,
  },
  completedPillText: { color: '#3B6D11', fontWeight: '700', fontSize: 13 },
});
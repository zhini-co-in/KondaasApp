import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

// ─────────────────────────────────────────────────────────────────────────────
// Status → visual config (color, label, icon) — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:    { color: '#ED1C25', label: 'New',         icon: 'ellipse-outline' },
  accepted:   { color: '#4f46e5', label: 'Accepted',     icon: 'checkmark-circle-outline' },
  inprogress: { color: '#f97316', label: 'In Progress',  icon: 'sync-outline' },
  picked:     { color: '#0ea5e9', label: 'Picked Up',    icon: 'cube-outline' },
  completed:  { color: '#22c55e', label: 'Completed',    icon: 'checkmark-done-circle' },
};

const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

const LogisticDealCard = ({
  card,
  index,
  onAccept,
  onReject,
  onStartScan,
  onMarkPicked,
  onMarkDropped,
  onSeeMore,
  onCardPress, // 🆕 opens the LogisticCardTrackingModal (Confirm Pickup / Mark as Delivered)
}) => {
  const products = card.products_info || [];
  const visibleProducts = products.slice(0, 2);
  const remaining = products.length - visibleProducts.length;
  const status = card.status || 'pending';
  const { color, label, icon } = getStatusConfig(status);

  const dealTitle = products[1] || card.deal_id || 'New Assigned Deal';
  const assignedDate = card.assignedAt
    ? new Date(card.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '—';

  // Any status other than these 4 known "in-flow" states counts as a fresh,
  // unactioned card — so accept/reject always show instead of silently
  // disappearing (e.g. status is 'notassigned', null, or missing entirely).
  const KNOWN_FLOW_STATUSES = ['accepted', 'inprogress', 'picked', 'completed'];
  const normalizedStatus = KNOWN_FLOW_STATUSES.includes(status) ? status : 'pending';

  // 🆕 Tapping the card body opens the tracking modal (Confirm Pickup /
  // Mark as Delivered) — it NEVER opens the camera scanner. Only the
  // explicit "Start Scan" button (accepted status) opens the camera; a
  // stray tap anywhere else on an accepted card does nothing, so the
  // camera never launches by accident.
  const handleCardBodyPress = () => {
    if (normalizedStatus === 'inprogress' || normalizedStatus === 'picked' || normalizedStatus === 'completed') {
      onCardPress?.(card, index);
    }
    // pending / accepted → no-op on body tap; use the dedicated buttons
  };
  const isTrackable = normalizedStatus === 'inprogress' || normalizedStatus === 'picked' || normalizedStatus === 'completed';

  // ── Action area — changes based on status ─────────────────────────────────
  const renderActions = () => {
    switch (normalizedStatus) {
      case 'pending':
        return (
          <View style={styles.iconRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onAccept?.(card, index)}>
              <Ionicons name="checkmark-circle-outline" size={34} color="#22c55e" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onReject?.(card, index)}>
              <Ionicons name="close-circle-outline" size={34} color="#ef4444" />
            </TouchableOpacity>
          </View>
        );

      case 'accepted':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]}
            onPress={() => onStartScan?.(card, index)}
          >
            <Ionicons name="scan-outline" size={15} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnText}>Start Scan</Text>
          </TouchableOpacity>
        );

      // 🆕 "In Progress" → opens the tracking modal, which shows the
      // "Confirm Pickup" button (matches the design). Confirming inside
      // the modal is what actually calls markProductPicked.
      case 'inprogress':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#0ea5e9' }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onCardPress?.(card, index);
            }}
          >
            <MaterialCommunityIcons name="package-up" size={16} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnText}>Track / Pickup</Text>
          </TouchableOpacity>
        );

      // 🆕 "Picked" → opens the tracking modal, which shows Proof of
      // Delivery + "Mark as Delivered". Confirming inside the modal is
      // what actually calls markAsDropped.
      case 'picked':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onCardPress?.(card, index);
            }}
          >
            <MaterialCommunityIcons name="truck-delivery-outline" size={16} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnText}>Deliver</Text>
          </TouchableOpacity>
        );

      case 'completed':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#EAF3DE' }]}>
            <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
            <Text style={[styles.statusPillText, { color: '#3B6D11' }]}>Delivered</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={isTrackable ? 0.7 : 1}
      onPress={handleCardBodyPress}
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
    >
      {/* Top row: status badge + date */}
      <View style={styles.rowBetween}>
        <View style={[styles.statusBadge, { backgroundColor: color + '1A' }]}>
          <Ionicons name={icon} size={12} color={color} />
          <Text style={[styles.statusBadgeText, { color }]}>{label}</Text>
        </View>
        <Text style={styles.date}>{assignedDate}</Text>
      </View>

      {/* Main row: icon + deal info + actions */}
      <View style={styles.mainRow}>
        <View style={[styles.avatar, { backgroundColor: color + '1A' }]}>
          <MaterialCommunityIcons name="card-account-details-outline" size={22} color={color} />
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.dealTitle} numberOfLines={1}>{dealTitle}</Text>
          <View style={styles.addrRow}>
            <Ionicons name="location-outline" size={12} color="#888" />
            <Text style={styles.subText} numberOfLines={1}>{card.address || 'Chennai'}</Text>
          </View>

          {/* Product chips */}
          {visibleProducts.length > 0 && (
            <View style={styles.chipRow}>
              {visibleProducts.map((prod, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{prod}</Text>
                </View>
              ))}
              {remaining > 0 && (
                <View style={[styles.chip, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={[styles.chipText, { color: '#4f46e5' }]}>+{remaining}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {renderActions()}
      </View>

      {/* See more footer — full raw details (kept as-is, separate from tracking modal) */}
      <TouchableOpacity
        style={styles.seeMoreRow}
        onPress={(e) => {
          e.stopPropagation?.();
          onSeeMore?.(card);
        }}
      >
        <Text style={styles.seeMoreText}>View full details</Text>
        <Ionicons name="chevron-forward" size={13} color="#3b82f6" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default LogisticDealCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 11, color: '#94a3b8' },

  mainRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  dealTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  subText: { fontSize: 12, color: '#666', flexShrink: 1 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, maxWidth: 110,
  },
  chipText: { fontSize: 11, color: '#475569' },

  iconRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  iconBtn: { padding: 2 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    minWidth: 108,
  },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  seeMoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 2, marginTop: 10, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: '#eee',
  },
  seeMoreText: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
});
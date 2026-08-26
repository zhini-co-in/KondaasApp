import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { setLocalPackageStage, updatePackageStatusRemote } from '../service/dispatchProgressService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// Package-level status → small accent color (independent of deal status)
const PACKAGE_STATUS_COLORS = {
  shipped:   '#0ea5e9',
  packed:    '#8b5cf6',
  delivered: '#22c55e',
  pending:   '#f59e0b',
};
const getPackageAccent = (pkgStatus) =>
  PACKAGE_STATUS_COLORS[(pkgStatus || '').toLowerCase()] || '#94a3b8';

// Local package "stage" pill (independent of the server's pkg.status text) —
// mirrors the stage machine used in PackagePickupScreen (pending → picked → delivered)
const LOCAL_STAGE_CONFIG = {
  pending:   { label: 'Not Picked', color: '#94a3b8' },
  picked:    { label: 'Picked Up',  color: '#0ea5e9' },
  delivered: { label: 'Delivered',  color: '#22c55e' },
};

// Best-effort mapping from the server's raw package status text (Packed /
// Shipped / Delivered) to our local pending/picked/delivered stage, used
// only the FIRST time (before any local action has been taken on it).
const mapServerStatusToStage = (serverStatus) => {
  const s = (serverStatus || '').toLowerCase();
  if (s === 'delivered') return 'delivered';
  if (s === 'shipped') return 'picked';
  return 'pending';
};

// forwardRef — the parent (LogisticScreen) needs a handle onto this card's
// advancePackage() so it can trigger the ACTUAL stage change only after a
// scan+verify confirmation has happened outside this component. The card
// itself never advances a package's stage off a bare button tap anymore.
const LogisticDealCard = forwardRef(({
  card,
  index,
  onAccept,
  onReject,
  onStartScan,
  onMarkPicked,
  onMarkDropped,
  onCardPress,
  onStartPickup, // navigates to PackagePickupScreen
}, ref) => {
  // Which single package row is expanded (accordion — only one open at a time
  // so tapping a package shows ONLY that package's address, nothing else).
  const [openPackageKey, setOpenPackageKey] = useState(null);

  // Per-package local stage, keyed by package_number. Seeded from
  // card.packages[i].stage/localStage (set by mergeCardsWithLocalProgress)
  // when local progress already exists, otherwise derived from the
  // server's raw pkg.status the first time we see it.
  const [packageStages, setPackageStages] = useState({});
  const [busyPackageKey, setBusyPackageKey] = useState(null); // disables buttons mid-request

  const packages = Array.isArray(card.packages) ? card.packages : [];

  useEffect(() => {
    const map = {};
    packages.forEach((pkg, i) => {
      const key = pkg.package_number || String(i);
      map[key] = pkg.stage || pkg.localStage || mapServerStatusToStage(pkg.status);
    });
    setPackageStages(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  // Clean product names: trim, collapse double-spaces, drop empty/falsy entries
  const products = (card.products_info || [])
    .map((p) => (typeof p === 'string' ? p.replace(/\s+/g, ' ').trim() : p))
    .filter(Boolean);

  const status = card.status || 'pending';
  const { color, label, icon } = getStatusConfig(status);

  const dealTitle = card.deal_id || 'New Assigned Deal';

  const assignedDate = card.assignedAt
    ? new Date(card.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '—';

  const KNOWN_FLOW_STATUSES = ['accepted', 'inprogress', 'picked', 'completed'];
  const normalizedStatus = KNOWN_FLOW_STATUSES.includes(status) ? status : 'pending';

  // REMOVED: tapping the card no longer opens the "Order Tracking" modal
  // at all — the top summary row below is now a plain, non-touchable View.
  // The "Start" button remains the only way to open a dispatch (it goes to
  // PackagePickupScreen), and each package row expands inline on the card.

  // Tap a single package row → toggle ONLY that package's details open/closed.
  // This TouchableOpacity is now structurally OUTSIDE the deal-level
  // tracking TouchableOpacity (see render below), so a tap here can never
  // reach handleCardBodyPress / open the Order Tracking modal.
  const togglePackage = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenPackageKey((prev) => (prev === key ? null : key));
  };

  // The ONLY function that actually mutates a package's stage. It is no
  // longer wired to a button's onPress directly — it only runs when the
  // parent calls it through the ref, which the parent does exclusively from
  // its scan+verify confirmation handler. Local-first: flips local stage +
  // UI instantly, fires the remote update in the background
  // (updatePackageStatusRemote already queues-and-retries on failure via the
  // sync queue, so this stays reliable offline too).
  const advancePackage = async (pkg, key, nextStage, remoteStatus) => {
    setBusyPackageKey(key);
    try {
      setPackageStages((prev) => ({ ...prev, [key]: nextStage }));
      await setLocalPackageStage(card.deal_id, pkg.package_number, nextStage);
      await updatePackageStatusRemote(card.deal_id, pkg.package_number, remoteStatus);
    } catch (e) {
      Alert.alert('Error', 'Could not update package status. It will retry automatically.');
    } finally {
      setBusyPackageKey(null);
    }
  };

  // Expose advancePackage to the parent so it can be invoked ONLY after
  // a successful scan+verify confirmation (see LogisticScreen).
  useImperativeHandle(ref, () => ({ advancePackage }), [card]);

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
      case 'inprogress':
      case 'picked':
        return (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#4f46e5' }]}
            onPress={() => onStartPickup?.(card, index)}
          >
            <MaterialCommunityIcons name="package-variant-closed" size={16} color="#fff" style={{ marginRight: 5 }} />
            <Text style={styles.actionBtnText}>Start</Text>
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
    // Plain View now — no longer a card-wide TouchableOpacity, so nothing
    // inside packagesWrap can ever trigger the deal-level tracking modal.
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      {/* Plain View now — no press behavior at all. Tracking modal removed
          entirely; "Start" button below is the only tap action here. */}
      <View>
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
            <Text style={styles.dispatchLabel}>Dispatch</Text>
            <Text style={styles.dispatchNumber} numberOfLines={1}>{dealTitle}</Text>
            {/* Address intentionally removed from the dashboard card view */}
          </View>

          {renderActions()}
        </View>
      </View>

      {/* ── PACKAGES — surfaced directly on the card. Each row is
          independently tappable; tapping one reveals that package's stage +
          quick actions. This whole block sits OUTSIDE the tracking
          TouchableOpacity above, so it can never open that modal. ───────── */}
      {packages.length > 0 ? (
        <View style={styles.packagesWrap}>
          <View style={styles.packagesTitleRow}>
            <View style={styles.packagesTitleDot} />
            <Text style={styles.packagesTitleText}>
              {packages.length} Package{packages.length > 1 ? 's' : ''} in this dispatch
            </Text>
          </View>

          {packages.map((pkg, pIdx) => {
            const key = pkg.package_number || String(pIdx);
            const isOpen = openPackageKey === key;
            const accent = getPackageAccent(pkg.status);
            const itemCount = (pkg.package_items || []).length;
            const stage = packageStages[key] || 'pending';
            // FIX: LOCAL_STAGE_CONFIG[stage] was undefined whenever `stage`
            // held anything outside pending/picked/delivered (e.g. before
            // packageStages finished populating, or a stray server status
            // value slipping through). That undefined then crashed on
            // stageCfg.color below — "Cannot read property 'color' of
            // undefined". Falling back to the 'pending' config keeps the
            // pill safe to render no matter what `stage` is.
            const stageCfg = LOCAL_STAGE_CONFIG[stage] || LOCAL_STAGE_CONFIG.pending;
            const isBusy = busyPackageKey === key;

            return (
              <View key={key} style={styles.pkgCard}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => togglePackage(key)}
                  style={styles.pkgHeaderTouchable}
                >
                  <View style={[styles.pkgAccentBar, { backgroundColor: accent }]} />

                  <View style={[styles.pkgIconWrap, { backgroundColor: accent + '1A' }]}>
                    <MaterialCommunityIcons name="cube-outline" size={16} color={accent} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.pkgNumberText} numberOfLines={1}>
                      {pkg.package_number || `Package ${pIdx + 1}`}
                    </Text>
                    <Text style={styles.pkgMetaText}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''}
                      {pkg.status ? `  •  ${pkg.status}` : ''}
                    </Text>
                  </View>

                  {/* Small stage pill on the collapsed package row */}
                  <View style={[styles.stagePillSmall, { backgroundColor: stageCfg.color + '1A' }]}>
                    <Text style={[styles.stagePillSmallText, { color: stageCfg.color }]}>{stageCfg.label}</Text>
                  </View>

                  <View style={[styles.pkgChevronWrap, isOpen && styles.pkgChevronWrapOpen]}>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={isOpen ? '#fff' : '#94a3b8'}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded block: items + inline stage actions — no address shown */}
                {isOpen && (
                  <View style={styles.pkgLabelBlock}>
                    <View style={styles.pkgDashedDivider} />
                     {(() => {
      // shipping_* fields empty-a irundha billing_* fallback ஆக use pannும்
      const addressParts = [
        pkg.shipping_street || pkg.billing_street,
        pkg.shipping_city || pkg.billing_city,
        pkg.shipping_state || pkg.billing_state,
        pkg.shipping_code || pkg.billing_code,
        pkg.shipping_country || pkg.billing_country,
      ].filter((part) => part && String(part).trim().length > 0);

      const addressText = addressParts.join(', ');

      if (!addressText) return null;

      return (
        <View style={styles.pkgAddressBlock}>
          <View style={styles.pkgAddressRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.pkgAddressText}>{addressText}</Text>
          </View>
        </View>
      );
    })()}

                    {itemCount > 0 && (
                      <View style={styles.pkgItemsList}>
                        {pkg.package_items.map((item, iIdx) => (
                          <View key={iIdx} style={styles.pkgItemLine}>
                            <View style={[styles.pkgItemDot, { backgroundColor: accent }]} />
                            <Text style={styles.pkgItemText} numberOfLines={1}>
                              {item.product_name}
                              {item.quantity ? ` × ${item.quantity}` : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Inline stage actions — these NO LONGER call
                        advancePackage directly. They notify the parent
                        (onMarkPicked/onMarkDropped), which opens the
                        scan+verify modal. The status only actually changes
                        once the parent calls this card's advancePackage via
                        ref, after the driver confirms the scan. */}
                    <View style={styles.pkgActionsRow}>
                      {stage === 'picked' && (
                        <TouchableOpacity
                          disabled={isBusy}
                          style={[styles.pkgActionBtn, { backgroundColor: '#22c55e', opacity: isBusy ? 0.6 : 1 }]}
                          onPress={() =>
                            onMarkDropped
                              ? onMarkDropped(card, pkg, key)
                              : advancePackage(pkg, key, 'delivered', 'delivered')
                          }
                        >
                          <Ionicons name="checkmark-done" size={14} color="#fff" />
                          <Text style={styles.pkgActionBtnText}>{isBusy ? 'Updating…' : 'Mark Delivered'}</Text>
                        </TouchableOpacity>
                      )}
                      {stage === 'delivered' && (
                        <View style={[styles.pkgActionBtn, { backgroundColor: '#EAF3DE' }]}>
                          <Ionicons name="checkmark-done-circle" size={14} color="#3B6D11" />
                          <Text style={[styles.pkgActionBtnText, { color: '#3B6D11' }]}>Delivered</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        // Fallback for older records without a packages[] array
        products.length > 0 && (
          <View style={styles.productsBlockFallback}>
            {products.map((prod, i) => (
              <View key={i} style={styles.productLine}>
                <View style={styles.productDot} />
                <Text style={styles.productLineText}>{prod}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
});

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
  // Label above + lighter-weight dispatch number below it
  dispatchLabel: { fontSize: 10.5, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  dispatchNumber: { fontSize: 15, fontWeight: '500', color: '#334155' },

  // ── Packages section wrapper ──────────────────────────────────────────────
  packagesWrap: {
    marginTop: 12,
    gap: 8,
  },
  packagesTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2,
  },
  packagesTitleDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#cbd5e1',
  },
  packagesTitleText: {
    fontSize: 10.5, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  // ── Individual package row (collapsed) ────────────────────────────────────
  pkgCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    overflow: 'hidden',
  },
  pkgHeaderTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pkgAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  pkgIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 10, marginVertical: 8,
  },
  pkgNumberText: {
    fontSize: 13, fontWeight: '700', color: '#1e293b', marginLeft: 10,
  },
  pkgMetaText: {
    fontSize: 11, color: '#94a3b8', marginLeft: 10, marginTop: 1, textTransform: 'capitalize',
  },
  // Small stage pill on the collapsed package row
  stagePillSmall: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginRight: 8,
  },
  stagePillSmallText: { fontSize: 10, fontWeight: '700' },
  pkgChevronWrap: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  pkgChevronWrapOpen: {
    backgroundColor: '#0f172a',
    transform: [{ rotate: '180deg' }],
  },

  // ── Expanded block for ONE package ─────────────────────────
  pkgLabelBlock: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  pkgDashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    marginBottom: 10,
  },
  pkgAddressBlock: {
  marginBottom: 10,
  backgroundColor: '#F1F5F9',
  borderRadius: 8,
  padding: 8,
},
pkgAddressRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 6,
},
pkgAddressText: {
  fontSize: 12,
  color: '#475569',
  flex: 1,
  lineHeight: 16,
},
  pkgItemsList: {
    gap: 4,
  },
  pkgItemLine: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  pkgItemDot: {
    width: 4, height: 4, borderRadius: 2,
  },
  pkgItemText: {
    fontSize: 12.5, color: '#334155', fontWeight: '500', flex: 1,
  },

  // Inline package action buttons
  pkgActionsRow: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  pkgActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  pkgActionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Fallback (no packages[] array on the record)
  productsBlockFallback: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    gap: 2,
  },
  productLine: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 2,
  },
  productDot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: '#94a3b8',
    marginTop: 6,
  },
  productLineText: {
    fontSize: 13, color: '#334155', flex: 1, fontWeight: '500', lineHeight: 18,
  },

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

});
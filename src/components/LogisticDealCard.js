import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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

const LogisticDealCard = ({
  card,
  index,
  onAccept,
  onReject,
  onStartScan,
  onMarkPicked,
  onMarkDropped,
  onCardPress,
  onStartPickup, // navigates to PackagePickupScreen
}) => {
  // Which single package row is expanded (accordion — only one open at a time
  // so tapping a package shows ONLY that package's address, nothing else).
  const [openPackageKey, setOpenPackageKey] = useState(null);

  // Clean product names: trim, collapse double-spaces, drop empty/falsy entries
  const products = (card.products_info || [])
    .map((p) => (typeof p === 'string' ? p.replace(/\s+/g, ' ').trim() : p))
    .filter(Boolean);

  // Packages array (each has its own address + items) — may be absent on older records
  const packages = Array.isArray(card.packages) ? card.packages : [];

  const status = card.status || 'pending';
  const { color, label, icon } = getStatusConfig(status);

  const dealTitle = card.deal_id || 'New Assigned Deal';

  const assignedDate = card.assignedAt
    ? new Date(card.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    : '—';

  const KNOWN_FLOW_STATUSES = ['accepted', 'inprogress', 'picked', 'completed'];
  const normalizedStatus = KNOWN_FLOW_STATUSES.includes(status) ? status : 'pending';

  const handleCardBodyPress = () => {
    if (normalizedStatus === 'inprogress' || normalizedStatus === 'picked' || normalizedStatus === 'completed') {
      onCardPress?.(card, index);
    }
  };
  const isTrackable = normalizedStatus === 'inprogress' || normalizedStatus === 'picked' || normalizedStatus === 'completed';

  // Tap a single package row → toggle ONLY that package's address open/closed
  const togglePackage = (e, key) => {
    e.stopPropagation?.();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenPackageKey((prev) => (prev === key ? null : key));
  };

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
            onPress={(e) => { e.stopPropagation?.(); onStartPickup?.(card, index); }}
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
        </View>

        {renderActions()}
      </View>

      {/* ── PACKAGES — surfaced directly on the card, not hidden behind a toggle.
          Each row is independently tappable; tapping one reveals ONLY that
          package's own shipping-label address, nothing else. ───────────────── */}
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

            return (
              <View key={key} style={styles.pkgCard}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={(e) => togglePackage(e, key)}
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

                  <View style={[styles.pkgChevronWrap, isOpen && styles.pkgChevronWrapOpen]}>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={isOpen ? '#fff' : '#94a3b8'}
                    />
                  </View>
                </TouchableOpacity>

                {/* Individual package address — shipping-label style, dashed divider */}
                {isOpen && (
                  <View style={styles.pkgLabelBlock}>
                    <View style={styles.pkgDashedDivider} />

                    <View style={styles.pkgLabelHeaderRow}>
                      <Ionicons name="location-sharp" size={14} color={accent} />
                      <Text style={[styles.pkgLabelHeaderText, { color: accent }]}>
                        Ship To — {pkg.package_number || `Package ${pIdx + 1}`}
                      </Text>
                    </View>

                    <Text style={styles.pkgLabelAddress}>
                      {pkg.billing_street || card.address || 'Not provided'}
                    </Text>

                    <View style={styles.pkgLabelChipsRow}>
                      {!!pkg.billing_city && (
                        <View style={styles.pkgLabelChip}>
                          <Text style={styles.pkgLabelChipText}>{pkg.billing_city}</Text>
                        </View>
                      )}
                      {!!pkg.billing_state && (
                        <View style={styles.pkgLabelChip}>
                          <Text style={styles.pkgLabelChipText}>{pkg.billing_state}</Text>
                        </View>
                      )}
                      {!!pkg.billing_code && (
                        <View style={styles.pkgLabelChip}>
                          <Text style={styles.pkgLabelChipText}>PIN {pkg.billing_code}</Text>
                        </View>
                      )}
                      {!!pkg.billing_country && (
                        <View style={styles.pkgLabelChip}>
                          <Text style={styles.pkgLabelChipText}>{pkg.billing_country}</Text>
                        </View>
                      )}
                    </View>

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
  pkgChevronWrap: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  pkgChevronWrapOpen: {
    backgroundColor: '#0f172a',
    transform: [{ rotate: '180deg' }],
  },

  // ── Expanded shipping-label block for ONE package ─────────────────────────
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
  pkgLabelHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6,
  },
  pkgLabelHeaderText: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  pkgLabelAddress: {
    fontSize: 14, color: '#0f172a', fontWeight: '600', lineHeight: 19,
  },
  pkgLabelChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
  },
  pkgLabelChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pkgLabelChipText: {
    fontSize: 11, color: '#475569', fontWeight: '600',
  },
  pkgItemsList: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#dbe3ec',
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
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, Modal, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getDistance, getRoadDistanceKm } from '../service/locationService';
import API from '../api/api1';
import { StyleSheet } from 'react-native'; // or inline styles

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateStr;
  }
};

const LeadCard = ({
  item,
  cardType, // 'unaccepted' | 'accepted' | 'inprogress' | 'completed'
  currentLocation,
  // SurveyerScreen handlers
  onAccept,
  onReject,
  onStart,
  // InProgressScreen handlers
  onSiteObservation,
  onManualEnable,
  onEdit,
  onMarkCompleted,
  navigation,
  formSubmitted,
}) => {
  const hasLatLong = item.latitude && item.longitude &&
    item.latitude !== '' && item.longitude !== '';

  // Straight-line (Haversine) distance in METERS — proximity check (300m
  // "Reached" auto-trigger) க்கு இதே use ஆகும். இது fast + offline-safe,
  // அதனால தொடாம வெச்சிருக்கோம்.
  const distToLead = currentLocation && hasLatLong
    ? Math.round(getDistance(
        currentLocation.latitude, currentLocation.longitude,
        parseFloat(item.latitude), parseFloat(item.longitude)
      ))
    : null;

  const withinRange = distToLead !== null && distToLead <= 300;
  const notifiedRef = useRef(false);

  // 👇 Road distance (OSRM) — "Distance" box la DISPLAY பண்ண மட்டும் use ஆகும்.
  const [roadDistanceKm, setRoadDistanceKm] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const lastFetchRef = useRef({ time: 0, straightKm: null });

  // 👇 புதுசா சேர்த்தது: Interested Product popup state
  const [productModalVisible, setProductModalVisible] = useState(false);

  useEffect(() => {
    if (cardType !== 'inprogress') return;
    if (!currentLocation || !hasLatLong || item.status === 'completed') return;
    if (distToLead === null) return;

    const straightKm = distToLead / 1000;
    const now = Date.now();
    const movedEnough =
      lastFetchRef.current.straightKm === null ||
      Math.abs(straightKm - lastFetchRef.current.straightKm) > 0.5; // 500m change
    const timeGapOk = now - lastFetchRef.current.time > 30000; // 30s throttle

    // முதல் தடவை (straightKm null) கண்டிப்பா fetch ஆகணும்.
    if (lastFetchRef.current.straightKm !== null && !movedEnough) return;

    lastFetchRef.current = { time: now, straightKm };
    setDistanceLoading(true);

    getRoadDistanceKm(
      currentLocation.latitude, currentLocation.longitude,
      parseFloat(item.latitude), parseFloat(item.longitude)
    ).then((km) => {
      setDistanceLoading(false);
      if (km !== null) setRoadDistanceKm(km);
      // km null ஆனா (network fail) — roadDistanceKm பழைய value/null ஆவே இருக்கும்,
      // display JSX தானா Haversine (distToLead) ku fallback ஆகும்.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distToLead, cardType, item.status]);

  // 300m auto-notify — only for inprogress
  useEffect(() => {
    if (cardType !== 'inprogress') return;
    if (withinRange && !item.manualSiteEnabled && !notifiedRef.current) {
      notifiedRef.current = true;
      API.post('/notification/trigger', {
        customerMobile: item.phone,
        scenarioType: 3,
      }).catch(() => {});
      onManualEnable?.(item);
    }
  }, [withinRange]);

  const openMap = () => {
    if (item.latitude || item.address || item.city) {
      navigation?.navigate('MapView', {
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
        city: item.city,
      });
    } else {
      Alert.alert('Location not available', 'No coordinates or address found.');
    }
  };

  // ── Interested Product — data prep ───────────────────────────────────────
  // 👇 புதுசா சேர்த்தது: backend-ல இருந்து வரும் product fields-ஐ ஒரு array-ஆ
  // தயார் பண்ணி, value இருக்கிற fields மட்டும் காட்டறோம்.
  const productFields = [
    { label: 'Product Type',        value: item.productType },
    { label: 'Order Type',          value: item.orderType },
    { label: 'Project Type',        value: item.projectType },
    { label: 'Project Model',       value: item.projectModel },
    { label: 'Inverter Connection', value: item.inverterConnectionType },
    { label: 'Inverter Capacity',   value: item.inverterCapacity },
    { label: 'Solar Panel Brand',   value: item.solarPanelBrand },
    { label: 'Solar Panel Model',   value: item.solarPanelModel },
    { label: 'No. of Panels',       value: item.noOfPanels },
    { label: 'Roof Type',           value: item.roofType },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

  const hasProductInfo = productFields.length > 0;

  // ── Action buttons — cardType-based ──────────────────────────────────────
  const renderActions = () => {
    switch (cardType) {

      case 'unaccepted':
        return (
          <View style={styles.iconContainer}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onAccept?.(item)}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#22c55e" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onReject?.(item.id)}>
              <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
            </TouchableOpacity>
          </View>
        );

      case 'accepted':
        if (item.status === 'completed') {
          return <CompletedPill />;
        }
        return (
          <TouchableOpacity
            style={[styles.startBtn, item.status === 'inprogress' && { backgroundColor: '#f97316' }]}
            onPress={() => onStart?.(item.id)}
          >
            <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.startBtnText}>
              {item.status === 'inprogress' ? 'Resume' : 'Start'}
            </Text>
          </TouchableOpacity>
        );

      case 'inprogress':
        if (item.status === 'completed') return <CompletedPill />;

        if (item.manualSiteEnabled || (hasLatLong && withinRange)) {
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      {/* 👇 formSubmitted ஆனா Site Observation button hide */}
      {!formSubmitted && (
        <TouchableOpacity style={styles.smallSiteBtn} onPress={() => onSiteObservation?.(item)}>
          <Text style={styles.smallSiteBtnText}>Site{'\n'}Observation</Text>
        </TouchableOpacity>
      )}
      {formSubmitted && (
        <TouchableOpacity
          style={[styles.commonBtn, { backgroundColor: '#3b82f6' }]}
          onPress={() => onEdit?.(item)}
        >
          <Ionicons name="create-outline" size={13} color="#fff" style={{ marginRight: 3 }} />
          <Text style={styles.commonBtnText}>Edit</Text>
        </TouchableOpacity>
      )}
      {formSubmitted && (
        <TouchableOpacity
          style={[styles.commonBtn, { backgroundColor: '#22c55e' }]}
          onPress={() => onMarkCompleted?.(item)}
        >
          <Ionicons name="checkmark-done-outline" size={13} color="#fff" style={{ marginRight: 3 }} />
          <Text style={styles.commonBtnText}>Completed</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

        return (
          <View style={styles.reachBtnWrapper}>
            <TouchableOpacity
              style={[styles.commonBtn, { backgroundColor: '#f97316' }]}
              onPress={() => onManualEnable?.(item)}
            >
              <Ionicons name="navigate-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.commonBtnText}>Reached</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.commonBtn, { backgroundColor: '#0ea5e9', marginTop: 6 }]}
              onPress={openMap}
            >
              <Ionicons name="map-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.commonBtnText}>Open Map</Text>
            </TouchableOpacity>
            {hasLatLong && distToLead !== null && (
              <View style={styles.distanceBox}>
                <Text style={styles.distanceLabel}>
                  Distance {distanceLoading ? '⏳' : ''}
                </Text>
                <Text style={styles.reachDistance}>
  {roadDistanceKm !== null
    ? roadDistanceKm.toFixed(1) + ' km'
    : (distToLead >= 1000
        ? '~' + (distToLead / 1000).toFixed(1) + ' km'
        : '~' + distToLead + ' m')}
</Text>
              </View>
            )}
          </View>
        );

      case 'completed':
        return <CompletedPill />;

      default:
        return null;
    }
  };

  return (
    <View style={[
      styles.card,
      cardType === 'unaccepted' && { borderLeftWidth: 4, borderLeftColor: '#ED1C25' },
      cardType === 'completed'  && { borderLeftWidth: 4, borderLeftColor: '#22c55e' },
    ]}>
      {/* Top row */}
      <View style={styles.rowBetween}>
        <View style={styles.referredBadge}>
          <Text style={styles.referredText}>
            Referred by — <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
          </Text>
        </View>
        {/* formatDate() helper-ஐ use பண்ணி readable-ஆ காட்டு. */}
        <Text style={styles.date}>{formatDate(item.date)}</Text>
      </View>

      {/* User row */}
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="call-outline" size={12} color="#25D366" />
            <Text style={styles.subText}>{item.phone}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location-outline" size={12} color="#555" />
            <Text style={styles.subText}>{item.city}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Ionicons name="notifications-outline" size={16} color="#aaa" />
            <Ionicons name="logo-whatsapp" size={16} color={item.whatsappNo ? '#25D366' : '#ccc'} />
            <Ionicons name="chatbubble-outline" size={16} color={item.phone ? '#555' : '#ccc'} />
            <Ionicons name="mail-outline" size={16} color={item.email ? '#555' : '#ccc'} />
          </View>

          {/* 👇 புதுசா சேர்த்தது: Interested Product chip — tap பண்ணா popup open */}
          {hasProductInfo && (
            <TouchableOpacity
              style={styles.productChip}
              onPress={() => setProductModalVisible(true)}
            >
              <Ionicons name="cube-outline" size={13} color="#185FA5" style={{ marginRight: 4 }} />
              <Text style={styles.productChipText}>Interested Product</Text>
              <Ionicons name="chevron-forward" size={12} color="#185FA5" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </View>

        {renderActions()}
      </View>

      {/* Comment */}
      <View style={[styles.commentRow, {
        borderTopWidth: 0.5, borderTopColor: '#eee', marginTop: 8, paddingTop: 8,
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 2 }}>Comment</Text>
          <Text numberOfLines={2} style={styles.comment}>{item.comment}</Text>
        </View>
        <TouchableOpacity disabled={!item.comment || item.comment.length <= 200}>
          <Text style={[styles.seeMore, {
            color: item.comment && item.comment.length > 200 ? '#1E88E5' : '#ccc',
          }]}>See more</Text>
        </TouchableOpacity>
      </View>

      {/* 👇 புதுசா சேர்த்தது: Interested Product Modal */}
      <Modal
        visible={productModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProductModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <View style={styles.productModalHeader}>
              <Ionicons name="cube" size={20} color="#185FA5" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Interested Product</Text>
            </View>

            <ScrollView style={{ marginTop: 10, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
              {productFields.length > 0 ? (
                productFields.map((f, idx) => (
                  <View key={idx} style={styles.productRow}>
                    <Text style={styles.productLabel}>{f.label}</Text>
                    <Text style={styles.productValue}>{String(f.value)}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ textAlign: 'center', color: '#999', paddingVertical: 20 }}>
                  No product details available.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => setProductModalVisible(false)}
            >
              <Text style={styles.modalSaveBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CompletedPill = () => (
  <View style={styles.completedPill}>
    <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
    <Text style={styles.completedPillText}>Completed</Text>
  </View>
);

export default LeadCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 12,
    borderRadius: 12, padding: 14, elevation: 3,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referredBadge: {
    backgroundColor: '#FCEBEB', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start',
  },
  referredText: { fontSize: 11, color: '#A32D2D' },
  date: { fontSize: 11, color: '#888' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E6F1FB', marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#185FA5' },
  name: { fontSize: 16, fontWeight: 'bold' },
  subText: { fontSize: 12, color: '#555' },
  iconContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { padding: 4 },
  commentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12 },
  completedPill: {
    backgroundColor: '#EAF3DE', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  completedPillText: { color: '#3B6D11', fontSize: 12, fontWeight: '600' },
  startBtn: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  reachBtnWrapper: { alignItems: 'center' },
  commonBtn: {
    width: 100, height: 36, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  commonBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  distanceBox: {
    backgroundColor: '#fff7ed', borderWidth: 1.5,
    borderColor: '#f97316', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 6, alignItems: 'center',
  },
  distanceLabel: { fontSize: 10, color: '#f97316', fontWeight: '600' },
  reachDistance: { fontSize: 17, color: '#f97316', fontWeight: '800', letterSpacing: 0.5, lineHeight: 22 },
  smallSiteBtn: {
    backgroundColor: '#ED1C25', paddingHorizontal: 10,
    paddingVertical: 8, borderRadius: 6, alignItems: 'center', width: 100,
  },
  smallSiteBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  // 👇 புதுசா சேர்த்தது: Interested Product chip + modal styles
  productChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6F1FB', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginTop: 8,
  },
  productChipText: { fontSize: 11, color: '#185FA5', fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 16, padding: 20, elevation: 10,
  },
  productModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#222', textAlign: 'center' },
  productRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  productLabel: { fontSize: 13, color: '#666', fontWeight: '600', flex: 1 },
  productValue: { fontSize: 13, color: '#222', flex: 1, textAlign: 'right' },
  modalSaveBtn: {
    backgroundColor: '#ED1C25', paddingVertical: 12,
    borderRadius: 8, alignItems: 'center',
  },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
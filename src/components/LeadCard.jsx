import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Linking, Alert, Modal, ScrollView,
  TextInput, ActivityIndicator, StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { getDistance, getRoadDistanceKm } from '../service/locationService';
import API from '../api/api1';
import { enqueue, processSyncQueue } from '../service/syncQueue';
import { getDistancePoints } from '../service/dealDistancePoints';

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

// Google Maps URL-la irundhu lat/lng extract
const parseLatLngFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    return null;
  } catch (e) {
    return null;
  }
};

const LeadCard = ({
  item,
  cardType, // 'unAccepted' | 'Accepted' | 'In-Progress' | 'Completed'
  currentLocation,
  // SurveyerScreen handlers
  onAccept,
  onReject,
  onStart,
  onHold, onUnhold,
  // In-ProgressScreen handlers
  onSiteObservation,
  onManualEnable,
  onEdit,
  onMarkCompleted,
  navigation,
  formSubmitted,
  onFinishAndReturn,
  isDue,
}) => {
  const hasLatLong = item.latitude && item.longitude &&
    item.latitude !== '' && item.longitude !== '';

  // Straight-line distance (meters) — 300m proximity check-ku
  const distToLead = currentLocation && hasLatLong
    ? Math.round(getDistance(
        currentLocation.latitude, currentLocation.longitude,
        parseFloat(item.latitude), parseFloat(item.longitude)
      ))
    : null;

  const withinRange = distToLead !== null && distToLead <= 300;
  const notifiedRef = useRef(false);

  // ── States (ellam inga top-la) ───────────────────────────────────────────
  const [roadDistanceKm, setRoadDistanceKm]     = useState(null);
  const [distanceLoading, setDistanceLoading]   = useState(false);
  const lastFetchRef = useRef({ time: 0, straightKm: null });

  const [productModalVisible, setProductModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText]                 = useState('');
  const [noteSaving, setNoteSaving]             = useState(false);

  const [homeDistanceKm, setHomeDistanceKm]     = useState(null);
  const [officeDistanceKm, setOfficeDistanceKm] = useState(null);
  const [homeLoading, setHomeLoading]           = useState(false);
  const [officeLoading, setOfficeLoading]       = useState(false);
  const [skipLoading, setSkipLoading]           = useState(false);

  // ── Road distance (display only) ─────────────────────────────────────────
  useEffect(() => {
    if (cardType !== 'In-Progress') return;
    if (!currentLocation || !hasLatLong || item.status === 'Completed') return;
    if (distToLead === null) return;

    const straightKm = distToLead / 1000;
    const now = Date.now();
    const movedEnough =
      lastFetchRef.current.straightKm === null ||
      Math.abs(straightKm - lastFetchRef.current.straightKm) > 0.5; // 500m change

    if (lastFetchRef.current.straightKm !== null && !movedEnough) return;

    lastFetchRef.current = { time: now, straightKm };
    setDistanceLoading(true);

    getRoadDistanceKm(
      currentLocation.latitude, currentLocation.longitude,
      parseFloat(item.latitude), parseFloat(item.longitude)
    ).then((km) => {
      setDistanceLoading(false);
      if (km !== null) setRoadDistanceKm(km);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distToLead, cardType, item.status]);

  // 300m auto-notify — In-Progress mattum
  useEffect(() => {
    if (cardType !== 'In-Progress') return;
    if (withinRange && !item.manualSiteEnabled && !notifiedRef.current) {
      notifiedRef.current = true;
      API.post('/notification/trigger', {
        customerMobile: item.whatsappNo || item.phone,
        scenarioType: 3,
      }).catch(() => {});
      onManualEnable?.(item);
    }
  }, [withinRange]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getSurveyorNumber = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed = userData ? JSON.parse(userData) : null;
      return parsed?.UserInfo?.phoneNo || '';
    } catch (e) {
      return '';
    }
  };

  const getSurveyorName = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed = userData ? JSON.parse(userData) : null;
      return parsed?.UserInfo?.name || parsed?.UserInfo?.Name || parsed?.UserInfo?.fullName || '';
    } catch (e) {
      return '';
    }
  };

  const sendDealDistance = async (extra = {}) => {
    const surveyorNumber = await getSurveyorNumber();
    const surveyorName   = await getSurveyorName();
    const { start, site } = await getDistancePoints(item.id);

    const payload = {
      leadId:        item.id,
      deal_id:       item.dealId,
      deal_name:     item.name,
      mobile:        surveyorNumber,
      surveyor_name: surveyorName,
      state:         item.state || undefined,
      start_latitude:  start?.latitude,
      start_longitude: start?.longitude,
      site_latitude:   site?.latitude,
      site_longitude:  site?.longitude,
      ...extra,
    };

    await enqueue(`deal_distance_${item.dealId}`, 'DEAL_DISTANCE', payload);
    processSyncQueue().catch(() => {});
  };

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

  // Home / Office click: distance calculate -> backend -> SurveyerScreen
  const handleGoTo = async (type) => {
    const url = type === 'home' ? item.home_location : item.office_location;

    if (!url) {
      Alert.alert('Not Available', `${type === 'home' ? 'Home' : 'Office'} location not set for this lead.`);
      return;
    }

    const coords = parseLatLngFromUrl(url);

    if (!coords || !currentLocation) {
      Alert.alert('Note', 'Could not read exact coordinates for distance calculation.');
      return;
    }

    type === 'home' ? setHomeLoading(true) : setOfficeLoading(true);

    let distanceKm;
    try {
      const road = await getRoadDistanceKm(
        currentLocation.latitude, currentLocation.longitude,
        coords.latitude, coords.longitude
      );
      distanceKm = road !== null
        ? road
        : getDistance(currentLocation.latitude, currentLocation.longitude, coords.latitude, coords.longitude) / 1000;
    } catch (e) {
      distanceKm = getDistance(currentLocation.latitude, currentLocation.longitude, coords.latitude, coords.longitude) / 1000;
    }

    if (type === 'home') {
      setHomeDistanceKm(distanceKm);
      setHomeLoading(false);
    } else {
      setOfficeDistanceKm(distanceKm);
      setOfficeLoading(false);
    }

    await sendDealDistance(
      type === 'home'
        ? { to_home: `${distanceKm.toFixed(1)} km` }
        : { to_office: `${distanceKm.toFixed(1)} km` }
    );

    onFinishAndReturn?.();
  };

  const handleSkip = async () => {
    setSkipLoading(true);
    await sendDealDistance();
    setSkipLoading(false);
    onFinishAndReturn?.();
  };

  // Note save -> addDealNote API
  const handleSaveNote = async () => {
    const content = noteText.trim();
    if (!content) {
      Alert.alert('Error', 'Please enter a note.');
      return;
    }
    if (!item.dealId) {
      Alert.alert('Error', 'Deal ID not found for this lead.');
      return;
    }

    setNoteSaving(true);
    try {
      await API.post('/order/note', {      // 👈 unga actual route-ku maathunga
        deal_id: item.dealId,
        content,
      }, { timeout: 30000 });

      setNoteText('');
      setNoteModalVisible(false);
      Alert.alert('Success', 'Note added successfully.');
    } catch (err) {
      Alert.alert(
        'Failed',
        err?.response?.data?.error || 'Could not add note. Check your internet connection.'
      );
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Data prep ────────────────────────────────────────────────────────────
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

  const addressFields = [
    { label: 'Country/Region', value: item.country },
    { label: 'State/Province', value: item.state },
    { label: 'District',       value: item.District },
    { label: 'Sub District',   value: item.subDistrict },
    { label: 'City',           value: item.city },
    { label: 'Street',         value: item.street },
    { label: 'Postal Code',    value: item.zipCode },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '');

  const hasAddressInfo = addressFields.length > 0;

  const addressSummaryParts = [item.street, item.city, item.District, item.state]
    .filter((part) => part && String(part).trim().length > 0);
  const addressSummary = addressSummaryParts.length > 0
    ? addressSummaryParts.join(', ')
    : (item.address || item.city || '—');

  // ── Action buttons — cardType-based ──────────────────────────────────────
  const renderActions = () => {
    switch (cardType) {

      case 'unAccepted':
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

      case 'Accepted':
        if (item.status === 'Completed') {
          return <CompletedPill />;
        }

        if (item.status === 'hold') {
          return (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: '#6b7280' }]}
              onPress={() => onUnhold?.(item.id)}
            >
              <Ionicons name="play-forward-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.startBtnText}>Unhold</Text>
            </TouchableOpacity>
          );
        }

        return (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={[styles.startBtn, item.status === 'In-Progress' && { backgroundColor: '#f97316' }]}
              onPress={() => onStart?.(item.id)}
            >
              <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.startBtnText}>
                {item.status === 'In-Progress' ? 'Resume' : 'Start'}
              </Text>
            </TouchableOpacity>

            {item.status === 'In-Progress' && (
              <TouchableOpacity
                style={styles.holdBtn}
                onPress={() => onHold?.(item.id)}
              >
                <Ionicons name="pause-circle-outline" size={13} color="#fff" style={{ marginRight: 3 }} />
                <Text style={styles.holdBtnText}>Hold</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'In-Progress':
        if (item.status === 'Completed') {
          return (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <CompletedPill />
              <GoToIcons
                homeLoading={homeLoading}
                officeLoading={officeLoading}
                skipLoading={skipLoading}
                homeDistanceKm={homeDistanceKm}
                officeDistanceKm={officeDistanceKm}
                onHome={() => handleGoTo('home')}
                onOffice={() => handleGoTo('office')}
                onSkip={handleSkip}
              />
            </View>
          );
        }

        if (item.manualSiteEnabled || (hasLatLong && withinRange)) {
          return (
            <View style={{ alignItems: 'center', gap: 5 }}>
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

      case 'Completed':
        return <CompletedPill />;

      default:
        return null;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[
      styles.card,
      cardType === 'unAccepted' && { borderLeftWidth: 4, borderLeftColor: '#ED1C25' },
      cardType === 'Completed'  && { borderLeftWidth: 4, borderLeftColor: '#22c55e' },
      cardType === 'Accepted' && item.status === 'hold' && { opacity: 0.5, borderLeftWidth: 4, borderLeftColor: '#6b7280' },
    ]}>
      {/* Top row */}
      <View style={styles.rowBetween}>
        <View style={styles.referredBadge}>
          <Text style={styles.referredText}>
            Referred by — <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
          </Text>
        </View>
        <Text style={styles.date}>{formatDate(item.date)}</Text>
      </View>

      {/* Lead Source */}
      {item.leadSource ? (
        <View style={styles.badgeRow}>
          <View style={styles.leadSourceBadge}>
            <Ionicons name="git-branch-outline" size={11} color="#7C3AED" style={{ marginRight: 4 }} />
            <Text style={styles.leadSourceText} numberOfLines={1} ellipsizeMode="tail">
              Lead Source — <Text style={{ fontWeight: 'bold' }}>{item.leadSource}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* Site Requested Date & Time */}
      {item.scheduledAt ? (
        <View style={styles.scheduleRow}>
          <View style={[styles.scheduleBadge, isDue && styles.scheduleBadgeDue]}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={isDue ? '#B91C1C' : '#B45309'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.scheduleText, isDue && { color: '#B91C1C' }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Site Requested — <Text style={{ fontWeight: 'bold' }}>{formatDate(item.scheduledAt)}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* User row */}
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => item.phone && Linking.openURL(`tel:${item.phone}`)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="call-outline" size={12} color="#25D366" />
            <Text style={styles.subText}>{item.phone}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingVertical: 3, flexShrink: 1 }}
            onPress={() => hasAddressInfo && setAddressModalVisible(true)}
            disabled={!hasAddressInfo}
          >
            <Ionicons name="location-outline" size={12} color="#555" />
            <Text style={[styles.subText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
              {addressSummary}
            </Text>
            {hasAddressInfo && (
              <Ionicons name="chevron-forward" size={12} color="#185FA5" />
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Ionicons name="notifications-outline" size={16} color="#aaa" />
            <Ionicons name="logo-whatsapp" size={16} color={item.whatsappNo ? '#25D366' : '#ccc'} />
            <Ionicons name="chatbubble-outline" size={16} color={item.phone ? '#555' : '#ccc'} />
            <Ionicons name="mail-outline" size={16} color={item.email ? '#555' : '#ccc'} />
          </View>

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

      {/* Site Survey Assigned By */}
      {item.siteSurveyAssignedBy ? (
        <View style={styles.assignedByRow}>
          <View style={styles.assignedByBadge}>
            <Ionicons name="person-outline" size={11} color="#0F766E" style={{ marginRight: 4 }} />
            <Text style={styles.assignedByText} numberOfLines={1} ellipsizeMode="tail">
              Site Survey Assigned By — <Text style={{ fontWeight: 'bold' }}>{item.siteSurveyAssignedBy}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      {/* Add Notes button */}
<View style={styles.notesBtnRow}>
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => setNoteModalVisible(true)}
    style={styles.addNotesBtn}
  >
    <Ionicons name="create-outline" size={14} color="#1E88E5" style={{ marginRight: 4 }} />
    <Text style={styles.addNotesBtnText}>Add Notes</Text>
  </TouchableOpacity>
</View>

      {/* Interested Product Modal */}
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

      {/* Full Address Modal */}
      <Modal
        visible={addressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '75%' }]}>
            <View style={styles.productModalHeader}>
              <Ionicons name="location" size={20} color="#185FA5" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Full Address</Text>
            </View>

            <ScrollView style={{ marginTop: 10, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
              {addressFields.length > 0 ? (
                addressFields.map((f, idx) => (
                  <View key={idx} style={styles.productRow}>
                    <Text style={styles.productLabel}>{f.label}</Text>
                    <Text style={styles.productValue}>{String(f.value)}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ textAlign: 'center', color: '#999', paddingVertical: 20 }}>
                  No address details available.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => setAddressModalVisible(false)}
            >
              <Text style={styles.modalSaveBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Note Modal */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !noteSaving && setNoteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.productModalHeader}>
              <Ionicons name="create" size={20} color="#185FA5" style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Add Note</Text>
            </View>

            <TextInput
              style={styles.noteInput}
              placeholder="Type your note here..."
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
              value={noteText}
              onChangeText={setNoteText}
              editable={!noteSaving}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1, backgroundColor: '#aaa' }]}
                onPress={() => { setNoteModalVisible(false); setNoteText(''); }}
                disabled={noteSaving}
              >
                <Text style={styles.modalSaveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1 }]}
                onPress={handleSaveNote}
                disabled={noteSaving}
              >
                {noteSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalSaveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const CompletedPill = () => (
  <View style={styles.CompletedPill}>
    <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
    <Text style={styles.CompletedPillText}>Completed</Text>
  </View>
);

// Complete aana piragu Home / Office / Skip round buttons
const GoToIcons = ({
  homeLoading, officeLoading, skipLoading, homeDistanceKm, officeDistanceKm, onHome, onOffice, onSkip,
}) => (
  <View style={{ flexDirection: 'row', gap: 14 }}>
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={[styles.goToRoundBtn, { backgroundColor: '#6366f1' }]}
        onPress={onHome}
        disabled={homeLoading}
      >
        {homeLoading
          ? <Ionicons name="hourglass-outline" size={16} color="#fff" />
          : <Ionicons name="home" size={16} color="#fff" />}
      </TouchableOpacity>
      {homeDistanceKm !== null && (
        <Text style={styles.goToRoundLabel}>{homeDistanceKm.toFixed(1)} km</Text>
      )}
    </View>

    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={[styles.goToRoundBtn, { backgroundColor: '#0ea5e9' }]}
        onPress={onOffice}
        disabled={officeLoading}
      >
        {officeLoading
          ? <Ionicons name="hourglass-outline" size={16} color="#fff" />
          : <Ionicons name="business" size={16} color="#fff" />}
      </TouchableOpacity>
      {officeDistanceKm !== null && (
        <Text style={styles.goToRoundLabel}>{officeDistanceKm.toFixed(1)} km</Text>
      )}
    </View>

    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity
        style={[styles.goToRoundBtn, { backgroundColor: '#9ca3af' }]}
        onPress={onSkip}
        disabled={skipLoading}
      >
        {skipLoading
          ? <Ionicons name="hourglass-outline" size={16} color="#fff" />
          : <Ionicons name="arrow-redo" size={16} color="#fff" />}
      </TouchableOpacity>
      <Text style={styles.goToRoundLabel}>Skip</Text>
    </View>
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

  badgeRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, marginTop: 8,
  },
  assignedByRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: 10,
  },
  assignedByBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E6FBF6', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
    maxWidth: '100%', flexShrink: 1,
  },
  assignedByText: { fontSize: 11, color: '#0F766E', flexShrink: 1 },
  leadSourceBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F1EBFE', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
    maxWidth: '100%', flexShrink: 1,
  },
  leadSourceText: { fontSize: 11, color: '#7C3AED', flexShrink: 1 },

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
  CompletedPill: {
    backgroundColor: '#EAF3DE', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  CompletedPillText: { color: '#3B6D11', fontSize: 12, fontWeight: '600' },
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

  goToRoundBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', elevation: 2,
  },
  goToRoundLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 3 },
  holdBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#eab308', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  holdBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  scheduleRow: { flexDirection: 'row', marginTop: 8 },
  scheduleBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF3C7', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
    maxWidth: '100%', flexShrink: 1,
  },
  scheduleBadgeDue: { backgroundColor: '#FEE2E2' },
  scheduleText: { fontSize: 11, color: '#B45309', flexShrink: 1 },

  // Note modal styles
  existingCommentBox: {
    backgroundColor: '#F5F5F5', borderRadius: 8,
    padding: 10, marginTop: 12,
  },
  existingCommentLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 2 },
  existingCommentText: { fontSize: 12, color: '#444' },
  noteInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#333',
    textAlignVertical: 'top', minHeight: 90, marginTop: 12, marginBottom: 16,
  },
  notesBtnRow: {
    borderTopWidth: 0.5, borderTopColor: '#eee',
    marginTop: 8, paddingTop: 8,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  addNotesBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E3F2FD', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
  },
  addNotesBtnText: { fontSize: 12, color: '#1E88E5', fontWeight: '600' },
});
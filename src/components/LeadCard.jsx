import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, Modal, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
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

// 👇 புதுசா சேர்த்தது: Google Maps URL string-ல இருந்து lat/lng extract பண்ற helper
// Zoho backend அனுப்ற home_location / office_location — பல format-ல வரலாம்,
// அதனால மூணு common pattern-ஐ try பண்றோம்.
// Supported:
//   https://www.google.com/maps/@13.05,80.25,15z
//   https://www.google.com/maps?q=13.05,80.25
//   https://www.google.com/maps?ll=13.05,80.25
const parseLatLngFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);        // .../@13.05,80.25,15z
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);        // ?q=13.05,80.25
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);       // ?ll=13.05,80.25
    if (m) return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };

    return null;
  } catch (e) {
    return null;
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
  // 👇 புதுசா சேர்த்தது: Complete ஆனப்புறம் Home/Office distance
  // click பண்ணதும் (அல்லது Skip பண்ணதும்) SurveyerScreen-க்கு
  // automatic-ஆ navigate பண்ண InProgressScreen கொடுக்கும் callback.
  onFinishAndReturn,
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

  // 👇 புதுசா சேர்த்தது: Home / Office distance state — click பண்ணதும் இதுல
  // result store ஆகி button-லயே காட்டப்படும்.
  const [homeDistanceKm, setHomeDistanceKm]     = useState(null);
  const [officeDistanceKm, setOfficeDistanceKm] = useState(null);
  const [homeLoading, setHomeLoading]           = useState(false);
  const [officeLoading, setOfficeLoading]       = useState(false);

const isFirstDistanceFetchRef = useRef(true);

useEffect(() => {
  if (cardType !== 'inprogress') return;
  if (!currentLocation || !hasLatLong || item.status === 'completed') return;
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
  ).then(async (km) => {
    setDistanceLoading(false);
    const finalKm = km !== null ? km : straightKm;
    if (km !== null) setRoadDistanceKm(km);

    if (isFirstDistanceFetchRef.current) {
      isFirstDistanceFetchRef.current = false;
      try {
        await AsyncStorage.setItem(`site_distance_${item.id}`, String(finalKm));
      } catch (e) {}
    }
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [distToLead, cardType, item.status]);

  // 300m auto-notify — only for inprogress
  useEffect(() => {
    if (cardType !== 'inprogress') return;
    if (withinRange && !item.manualSiteEnabled && !notifiedRef.current) {
      notifiedRef.current = true;
      API.post('/notification/trigger', {
  customerMobile: item.whatsappNo || item.phone,
  scenarioType: 3,
}).catch(() => {});
      onManualEnable?.(item);
    }
  }, [withinRange]);

  // 👇 புதுசா சேர்த்தது: backend saveDealDistance-க்கு "mobile" (surveyor
  // number) mandatory field. AsyncStorage-ல login பண்ணும்போது save ஆன
  // USER_DATA-ல இருந்து படிக்கிறோம்.
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

  // 👇 புதுசா சேர்த்தது: "Home" / "Office" icon click handler.
  // Flow: distance calculate பண்ணு → backend saveDealDistance API-க்கு
  // அனுப்பு → automatic-ஆ SurveyerScreen-க்கு navigate பண்ணு.
  // ✅ Map எதுவும் open ஆகாது — click பண்ண உடனே distance மட்டும் send ஆகும்.
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

    // Road distance (OSRM) முதல்ல try பண்ணு, fail ஆனா straight-line fallback
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

    // Backend-க்கு save பண்ணு (saveDealDistance controller — route:
    // locationRoutes.post('/distance', saveDealDistance) => /location/distance)
    //
    // 👇 "to_site" — Start பண்ணும்போது SurveyerScreen.js (handleStart)
    // AsyncStorage-ல store பண்ணி வெச்ச distance-ஐ படிக்கிறோம். அதுவே
    // சரியான "surveyor -> site" distance, இப்போ (Complete ஆன பிறகு)
    // இருக்கிற live location distance அல்ல. Stored value கிடைக்கலைன்னா
    // மட்டும் live roadDistanceKm/distToLead-க்கு fallback பண்றோம்.
    let toSiteKm = null;
    try {
      const raw = await AsyncStorage.getItem(`site_distance_${item.id}`);
      toSiteKm = raw !== null ? parseFloat(raw) : null;
    } catch (e) {
      toSiteKm = null;
    }
    if (toSiteKm === null || Number.isNaN(toSiteKm)) {
      toSiteKm = roadDistanceKm !== null
        ? roadDistanceKm
        : (distToLead !== null ? distToLead / 1000 : 0);
    }

    try {
      const surveyorNumber = await getSurveyorNumber();
      const surveyorName   = await getSurveyorName(); 
      await API.post('/location/distance', {
        deal_id:   item.dealId,
        deal_name: item.name,
        mobile:    surveyorNumber,
        surveyor_name: surveyorName,
        to_site:   toSiteKm,
        ...(type === 'home' ? { to_home: distanceKm } : { to_office: distanceKm }),
      });
    } catch (e) {
      // fail ஆனாலும் — offline queue வேணும்னா இங்க enqueue() import
      // பண்ணி சேர்க்கலாம். இப்போ silent fail.
    }

    // ✅ Distance அனுப்பியாச்சு — இனி map திறக்காம, நேரடியா
    // SurveyerScreen-க்கு திரும்பி போயிடுவோம்.
    onFinishAndReturn?.();
  };

  // 👇 புதுசா சேர்த்தது: Home/Office ரெண்டையும் click பண்ணாம "Skip"
  // பண்ணா — to_home / to_office அனுப்பாது, ஆனா "to_site" distance-ஐ
  // (Start பண்ணும்போது AsyncStorage-ல store பண்ண surveyor -> site
  // distance) இன்னும் backend-க்கு அனுப்பி save பண்ணிடும். இது இல்லாம
  // Skip பண்ணா to_site backend-ல ஏறவே ஏறாது.
  const [skipLoading, setSkipLoading] = useState(false);

  const handleSkip = async () => {
    setSkipLoading(true);

    let toSiteKm = null;
    try {
      const raw = await AsyncStorage.getItem(`site_distance_${item.id}`);
      toSiteKm = raw !== null ? parseFloat(raw) : null;
    } catch (e) {
      toSiteKm = null;
    }
    if (toSiteKm === null || Number.isNaN(toSiteKm)) {
      toSiteKm = roadDistanceKm !== null
        ? roadDistanceKm
        : (distToLead !== null ? distToLead / 1000 : 0);
    }

    try {
      const surveyorNumber = await getSurveyorNumber();
      const surveyorName   = await getSurveyorName();
      await API.post('/location/distance', {
        deal_id:   item.dealId,
        deal_name: item.name,
        mobile:    surveyorNumber,
        surveyor_name: surveyorName,
        to_site:   toSiteKm,
      });
    } catch (e) {
      // fail ஆனாலும் — silent, user-ஐ block பண்ணக்கூடாது
    }

    setSkipLoading(false);
    onFinishAndReturn?.();
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

  // ── Full Address — data prep ─────────────────────────────────────────────
  // 👇 புதுசா சேர்த்தது: Country/Region, State/Province, District, Sub
  // District, City, Street, Postal Code — same order as the Zoho schema's
  // "Address Information" group. Only fields that actually have a value
  // are shown — missing ones are skipped instead of showing blank rows.
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

  // Short one-line summary shown directly on the card (replaces the old
  // "city only" line). Falls back to item.address / item.city if none of
  // the structured fields are present.
  const addressSummaryParts = [item.street, item.city, item.District, item.state]
    .filter((part) => part && String(part).trim().length > 0);
  const addressSummary = addressSummaryParts.length > 0
    ? addressSummaryParts.join(', ')
    : (item.address || item.city || '—');

  const [addressModalVisible, setAddressModalVisible] = useState(false);

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
        // 👇 Complete button click பண்ணி status "completed" ஆனப்புறம் தான்
        // Home / Office icon buttons தெரியும் — முன்னாடி வேண்டாம்.
        if (item.status === 'completed') {
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

      {/* ✅ CHANGED — "Site Survey Assigned By" moved out of here (now shown
          below the user row, centered). Only "Lead Source" stays in this
          top pill row. */}
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

          {/* ✅ CHANGED — was just item.city; now a full address summary
              (Street, City, District, State) that opens the Full Address
              modal on tap so every field (Country/Region, State/Province,
              District, Sub District, City, Street, Postal Code) is visible. */}
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

      {/* ✅ ADDED — "Site Survey Assigned By" now lives here, below the
          user row, as its own centered badge/line. */}
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

      {/* 👇 புதுசா சேர்த்தது: Full Address Modal — Country/Region,
          State/Province, District, Sub District, City, Street, Postal Code */}
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
    </View>
  );
};

const CompletedPill = () => (
  <View style={styles.completedPill}>
    <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
    <Text style={styles.completedPillText}>Completed</Text>
  </View>
);

// 👇 புதுசா சேர்த்தது: Complete ஆன பிறகு தெரியற Home / Office / Skip
// round icon buttons. Home/Office tap பண்ணா distance calculate ஆகி backend-க்கு
// அனுப்பப்பட்டு auto SurveyerScreen-க்கு navigate ஆகும். Skip tap பண்ணா
// distance எதுவும் அனுப்பாம நேரடியா SurveyerScreen-க்கு navigate ஆகும்.
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

    {/* 👇 புதுசா சேர்த்தது: Skip button — Home/Office click பண்ணாம நேரடியா
        SurveyerScreen-க்கு போக */}
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

  // Top row — now only holds Lead Source (Site Survey Assigned By moved
  // below the user row, see assignedByRow).
  badgeRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, marginTop: 8,
  },
  // ✅ ADDED — centered row below the user row that holds the
  // "Site Survey Assigned By" badge on its own.
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
  // "Lead Source" pill, violet-coded.
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

  // 👇 புதுசா சேர்த்தது: Complete ஆன பிறகு தெரியற Home / Office / Skip round
  // icon-only button styles.
  goToRoundBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', elevation: 2,
  },
  goToRoundLabel: { fontSize: 10, color: '#555', fontWeight: '600', marginTop: 3 },
});
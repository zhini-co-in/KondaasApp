
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, Image, StatusBar,
  Alert, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, TextInput, Linking, Platform,
} from 'react-native';
import API from '../api/api1';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { USER_DATA } from '../service/localStorage';
import {
  saveAcceptedLead,
  getAcceptedLeads,
  updateAcceptedLeadStatus,
  mergeWithServerLeads,
} from '../service/LocalleadsStorage';
import { enqueue, processSyncQueue } from '../service/syncQueue';
import { NativeModules } from 'react-native';
import {
  getDistance, useLocationTracking,
  requestLocationPermissions, requestIOSLocationPermission, isGPSEnabled,
  startHighFrequencyTracking,
  stopHighFrequencyTracking,
} from '../service/locationService';

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard
// ─────────────────────────────────────────────────────────────────────────────
const LeadCard = ({
  item, currentLocation, onAccept, onReject, onStart, cardType,
}) => {
  const hasLatLong = item.latitude && item.longitude &&
    item.latitude !== '' && item.longitude !== '';

  const distToLead = currentLocation && hasLatLong
    ? Math.round(getDistance(
        currentLocation.latitude, currentLocation.longitude,
        parseFloat(item.latitude), parseFloat(item.longitude)
      ))
    : null;

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
        <Text style={styles.date}>{item.date}</Text>
      </View>

      <View style={styles.userRow}>

        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="call-outline" size={12} color="#25D366" />
            <Text style={styles.subText}>{item.phone}</Text>
          </View>
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
        </View>

        {/* Unaccepted — accept / reject icons */}
        {cardType === 'unaccepted' && (
          <View style={styles.iconContainer}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onAccept(item)}>
              <Ionicons name="checkmark-circle-outline" size={36} color="#22c55e" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onReject(item.id)}>
              <Ionicons name="close-circle-outline" size={36} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Accepted — start / resume / completed */}
        {cardType === 'accepted' && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            {item.status === 'completed' ? (
              <View style={styles.completedPill}>
                <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
                <Text style={styles.completedPillText}>Completed</Text>
              </View>
            ) : item.status === 'inprogress' ? (
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: '#f97316' }]}
                onPress={() => onStart(item.id)}
              >
                <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.startBtnText}>Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.startBtn} onPress={() => onStart(item.id)}>
                <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.startBtnText}>Start</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Completed card type */}
        {cardType === 'completed' && (
          <View style={styles.completedPill}>
            <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
            <Text style={styles.completedPillText}>Completed</Text>
          </View>
        )}
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
          }]}>
            See more
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SurveyerScreen
// ─────────────────────────────────────────────────────────────────────────────
const SurveyerScreen = () => {
  const navigation = useNavigation();
  const route      = useRoute();
  const isMounted  = useRef(true);

  const { currentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

  // ✅ FIX 2: locationRef — stale closure தடுக்க
  const locationRef = useRef(null);
  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  const [isOn, setIsOn]                     = useState(false);
  const [leads, setLeads]                   = useState([]);
  const [acceptedLeads, setAcceptedLeads]   = useState([]);
  const [completedLeads, setCompletedLeads] = useState([]);
  const [leadsLoading, setLeadsLoading]     = useState(false);
  const [activeFilter, setActiveFilter]     = useState('all');
  const [isOnline, setIsOnline]             = useState(true);
  const [pendingCount, setPendingCount]     = useState(0);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment]           = useState('');
  const [rejectLeadId, setRejectLeadId]             = useState(null);

  // ✅ FIX 1: acceptedLeadsRef — setState inside setState crash தடுக்க
  const acceptedLeadsRef = useRef([]);

  // ✅ acceptedLeads set பண்ணும்போது ref-ஐயும் sync பண்ணு
  const setAcceptedLeadsSafe = useCallback((updater) => {
    setAcceptedLeads((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      acceptedLeadsRef.current = next;
      return next;
    });
  }, []);

  // ── Net watcher ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        console.log('[SurveyerScreen] Net restored — running sync queue...');
        const result = await processSyncQueue();
        if (result.synced > 0) {
          console.log(`[SurveyerScreen] Synced ${result.synced} offline actions`);
          await fetchAndMergeLeads();
        }
        setPendingCount(0);
      }
    });
    return () => unsub();
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    restoreState();
    return () => {
      isMounted.current = false;
      stopTracking();
      stopHighFrequencyTracking();
    };
  }, []);

  // ── Android permissions ───────────────────────────────────────────────────
  useEffect(() => {
    const autoSetup = async () => {
      if (Platform.OS !== 'android') return;
      try { await NativeModules.StartStopService?.requestBatteryOptimization?.(); } catch (e) {}
      const granted = await requestLocationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Location permission is required.', [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
    };
    autoSetup();
  }, []);

  // ✅ FIX 1: useFocusEffect — setState inside setState CRASH FIX
  useFocusEffect(
    useCallback(() => {
      const completedIds = route.params?.completedIds;
      if (!completedIds || completedIds.length === 0) return;
      navigation.setParams({ completedIds: null });

      // Step 1: acceptedLeadsRef-ல் இருந்து toMove எடுக்கிறோம்
      // (setState callback-க்கு வெளியே — safe)
      const toMove = acceptedLeadsRef.current.filter((l) =>
        completedIds.includes(l.id)
      );

      // Step 2: acceptedLeads update — தனியா call பண்றோம்
      setAcceptedLeadsSafe((prev) => prev.filter((l) => !completedIds.includes(l.id)));

      // Step 3: completedLeads update — தனியா call பண்றோம் (setState inside setState இல்லை)
      if (toMove.length > 0) {
        setCompletedLeads((c) => [
          ...c.filter((cl) => !toMove.some((m) => m.id === cl.id)),
          ...toMove.map((l) => ({ ...l, status: 'completed' })),
        ]);
      }
    }, [route.params?.completedIds])
  );

  // ── Restore state ─────────────────────────────────────────────────────────
  const restoreState = async () => {
    const saved = await AsyncStorage.getItem('surveyer_is_on');
    if (saved === 'true') {
      setIsOn(true);
      if (Platform.OS === 'android') NativeModules.StartStopService?.startService();
      startTracking();
    }
    await loadLocalLeads();
    await fetchAndMergeLeads();
  };

  // ── Load local ────────────────────────────────────────────────────────────
  const loadLocalLeads = async () => {
    const local = await getAcceptedLeads();
    if (!isMounted.current) return;

    const accepted = local.filter((l) => l.status === 'accepted' || l.status === 'inprogress');
    const completed = local.filter((l) => l.status === 'completed');

    // ✅ ref sync
    acceptedLeadsRef.current = accepted;
    setAcceptedLeads(accepted);
    setCompletedLeads(completed);
  };

  // ── Fetch + merge ─────────────────────────────────────────────────────────
  const fetchAndMergeLeads = async () => {
    setLeadsLoading(true);
    try {
      const res = await API.get('/order/all');
      const rawData = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      const mapped = rawData.map((item) => ({
  id: item._id, 
  name: item.name, 
  phone: item.mobile,
  city: item.city, 
  comment: item.comment, 
  referredBy: item.referredBy,
  date: item.time || item.createdAt,  // ✅ `time` field use pannu (full timestamp)
  latitude: item.latitude, 
  longitude: item.longitude,
  whatsappNo: item.whatsappNo, 
  email: item.email, 
  address: item.address,
  status: item.status,
}));

      if (!isMounted.current) return;

      setLeads(mapped.filter((l) => l.status === 'unaccepted'));

      const serverNonNew = mapped.filter((l) => l.status !== 'unaccepted');
      const merged = await mergeWithServerLeads(serverNonNew);

      const accepted = merged.filter((l) => l.status === 'accepted' || l.status === 'inprogress');
      const completed = merged.filter((l) => l.status === 'completed');

      // ✅ ref sync
      acceptedLeadsRef.current = accepted;
      setAcceptedLeads(accepted);
      setCompletedLeads(completed);

    } catch (err) {
      console.log('[SurveyerScreen] Offline, using local data');
    } finally {
      if (isMounted.current) setLeadsLoading(false);
    }
  };

  // ── Try API ───────────────────────────────────────────────────────────────
  const tryApi = async (fn) => {
    try { await fn(); }
    catch (e) { console.log('[SurveyerScreen] API failed (offline):', e?.message); }
  };

  // ── Helper: get surveyor number ───────────────────────────────────────────
  const getSurveyorNumber = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed = userData ? JSON.parse(userData) : null;
      return parsed?.UserInfo?.phoneNo || '';
    } catch (e) {
      return '';
    }
  };

  // ── Accept ────────────────────────────────────────────────────────────────
  const handleAccept = async (item) => {
    await saveAcceptedLead(item);
    setLeads((prev) => prev.filter((l) => l.id !== item.id));

    // ✅ setAcceptedLeadsSafe use பண்றோம்
    setAcceptedLeadsSafe((prev) => {
      if (prev.some((l) => l.id === item.id)) return prev;
      return [...prev, { ...item, status: 'accepted' }];
    });

    const surveyorNumber = await getSurveyorNumber();
    const acceptedAt = Date.now();

    const payload = { mobile: item.phone, surveyorNumber };
    await enqueue(`accept_${item.id}`, 'ACCEPT_LEAD', payload);

    if (isOnline) {
      tryApi(() => API.post('/order/accept', payload));
      tryApi(() => API.put('/order/updatestatus', { mobile: item.phone, status: 'accepted' }));
      tryApi(() => API.post('/order/sync-status', {
        customerMobile: item.phone,
        surveyorNumber,
        status: 'accepted',
        receivedAt: acceptedAt,
      }));
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = (id) => {
    setRejectLeadId(id);
    setRejectComment('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectComment.trim()) {
      Alert.alert('Error', 'Please enter a reason for rejection.');
      return;
    }

    const lead = leads.find((l) => l.id === rejectLeadId);
    if (!lead) return;

    if (!isOnline) {
      Alert.alert('No Connection', 'Rejecting a lead requires internet connection.');
      return;
    }

    const surveyorNumber = await getSurveyorNumber();

    try {
      await API.post('/order/reject', {
        customerMobile: lead.phone,
        surveyorNumber,
        comment: rejectComment.trim(),
        receivedAt: Date.now(),
      });

      setLeads((prev) => prev.filter((l) => l.id !== rejectLeadId));
      setRejectModalVisible(false);
      setRejectLeadId(null);
      setRejectComment('');
      Alert.alert('Success', 'Lead rejected successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to reject.');
    }
  };

  // ── Start / Resume ────────────────────────────────────────────────────────
  const handleStart = async (id) => {
    const lead = acceptedLeadsRef.current.find((l) => l.id === id);
    if (!lead) return;

    let etaText = 'N/A';
    let totalMins = 0;
    const hasLatLong = lead.latitude && lead.longitude;

    if (locationRef.current && hasLatLong) {
      const distMeters = Math.round(getDistance(
        locationRef.current.latitude, locationRef.current.longitude,
        parseFloat(lead.latitude), parseFloat(lead.longitude)
      ));
      const speed = distMeters <= 300 ? 1.4 : 8.3;
      totalMins = Math.round(distMeters / speed / 60);
      if (totalMins < 1) {
        etaText = 'Less than a minute';
      } else if (totalMins < 60) {
        etaText = `${totalMins} min`;
      } else {
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        etaText = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
      }
    }

    let mapsUrl = '';
    if (locationRef.current && hasLatLong) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${locationRef.current.latitude},${locationRef.current.longitude}&destination=${lead.latitude},${lead.longitude}`;
    } else if (hasLatLong) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;
    } else if (lead.address || lead.city) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address || lead.city)}`;
    }

    await updateAcceptedLeadStatus(id, 'inprogress');

    // ✅ setAcceptedLeadsSafe use பண்றோம்
    setAcceptedLeadsSafe((prev) =>
      prev.map((l) => l.id === id ? { ...l, status: 'inprogress' } : l)
    );

    await enqueue(`status_inprogress_${id}`, 'STATUS_UPDATE', {
      mobile: lead.phone, status: 'inprogress',
    });

    if (isOnline) {
      const surveyorNumber = await getSurveyorNumber();
      const startAt = Date.now();
      const dueAt   = startAt + (totalMins * 60 * 1000);

      tryApi(() => API.put('/order/updatestatus', { mobile: lead.phone, status: 'inprogress' }));
      tryApi(() => API.post('/order/inprogress', { mobile: lead.phone, surveyorNumber }));
      tryApi(() => API.post('/order/sync-status', {
        customerMobile: lead.phone,
        surveyorNumber,
        status: 'inprogress',
        startAt,
        dueAt,
      }));

      try {
        await API.post('/notification/trigger', {
          surveyorNumber, customerMobile: lead.phone, scenarioType: 1, eta: totalMins, mapsUrl,
        });
      } catch (e) {
        console.log('[SurveyerScreen] Notification error:', e?.message);
      }
    } else {
      await enqueue(`notif_start_${id}`, 'NOTIFICATION', {
        customerMobile: lead.phone, scenarioType: 1, eta: totalMins, mapsUrl,
      });
    }

    // ✅ FIX 2: locationRef use பண்றோம் — stale closure இல்லை
    startHighFrequencyTracking(() => locationRef.current);

    navigation.navigate('InProgress', {
      lead: { ...lead, status: 'inprogress' },
      initialLocation: locationRef.current,
    });
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  const handleToggle = async () => {
    if (!isOn) {
      if (Platform.OS === 'android') {
        const gpsOn = await isGPSEnabled();
        if (!gpsOn) {
          Alert.alert('Location is Off', 'Please turn on GPS to continue.', [
            {
              text: 'Open Settings',
              onPress: () =>
                Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
                  .catch(() => Linking.openSettings()),
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        NativeModules.StartStopService?.startService();
      } else if (Platform.OS === 'ios') {
  const granted = await requestIOSLocationPermission();
  if (!granted) {
    Alert.alert('Permission Required', 'Location permission is required.', [
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return; // ← permission இல்லன்னா toggle ON ஆகாம return
  }
}
setIsOn(true);
await AsyncStorage.setItem('surveyer_is_on', 'true');
startTracking();
fetchAndMergeLeads();
    } else {
      setIsOn(false);
      await AsyncStorage.setItem('surveyer_is_on', 'false');
      stopTracking();
      stopHighFrequencyTracking();
      if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            stopTracking();
            stopHighFrequencyTracking();
            await AsyncStorage.removeItem(USER_DATA);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (e) {
            Alert.alert('Error', 'Failed to logout.');
          }
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── OFF STATE ─────────────────────────────────────────────────────── */}
      {!isOn && (
        <LinearGradient colors={['#F00001', '#B00100']} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.offLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.offToggleBtn}>
            <Switch
              trackColor={{ false: '#ffffff88', true: '#fff' }}
              thumbColor="#ED1C25" value={isOn} onValueChange={handleToggle}
            />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingTop: 60, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 20 }}>
              <Image
                source={require('../../assets/images/kondass.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.offTextContainer}>
              <Text style={styles.welcome}>Welcome!</Text>
              <Text style={styles.message}>Let's get started! Turn on availability!</Text>
            </View>

            {leads.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 10 }]}>
                  <View style={[styles.sectionDot, { backgroundColor: '#fff' }]} />
                  <Text style={[styles.sectionTitle, { color: '#fff' }]}>New Leads</Text>
                </View>
                {leadsLoading
                  ? <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
                  : leads.map((item) => (
                      <LeadCard
                        key={item.id}
                        item={item}
                        currentLocation={locationRef.current}
                        cardType="unaccepted"
                        onAccept={handleAccept}
                        onReject={handleReject}
                      />
                    ))
                }
              </>
            )}
          </ScrollView>
        </LinearGradient>
      )}

      {/* ── ON STATE ──────────────────────────────────────────────────────── */}
      {isOn && (
        <>
          <View style={styles.fixedTopBar}>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="#ED1C25" />
            </TouchableOpacity>
            <Switch
              trackColor={{ false: '#ccc', true: 'red' }}
              thumbColor="#fff" value={isOn} onValueChange={handleToggle}
            />
          </View>

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.offlineBannerText}>Offline</Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1, backgroundColor: '#F5F5F5' }}
            contentContainerStyle={{ paddingTop: !isOnline ? 120 : 90, paddingBottom: 30 }}
          >
            {/* New Leads */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#ED1C25' }]} />
              <Text style={styles.sectionTitle}>Leads - New</Text>
            </View>

            {leadsLoading && (
              <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />
            )}
            {!leadsLoading && leads.length === 0 && (
              <Text style={styles.emptyText}>No new leads available.</Text>
            )}
            {!leadsLoading && leads.map((item) => (
              <LeadCard
                key={item.id} item={item} currentLocation={locationRef.current}
                cardType="unaccepted" onAccept={handleAccept} onReject={handleReject}
              />
            ))}

            {/* Accepted / Completed */}
            {(acceptedLeads.length > 0 || completedLeads.length > 0) && (
              <>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.sectionDot, {
                      backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#fd9104',
                    }]} />
                    <Text style={styles.sectionTitle}>
                      {activeFilter === 'completed' ? 'Leads - Completed' : 'Leads - Accepted'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('all')}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                        backgroundColor: activeFilter === 'all' ? '#ED1C25' : '#e5e7eb',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: 'bold',
                        color: activeFilter === 'all' ? '#fff' : '#555',
                      }}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('completed')}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                        backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#e5e7eb',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: 'bold',
                        color: activeFilter === 'completed' ? '#fff' : '#555',
                      }}>Completed</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {activeFilter === 'all' && (
                  <>
                    {acceptedLeads.map((item) => (
                      <LeadCard
                        key={item.id} item={item} currentLocation={locationRef.current}
                        cardType="accepted" onStart={handleStart}
                      />
                    ))}
                    {completedLeads.length > 0 && (
                      <>
                        <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.sectionDot, { backgroundColor: '#22c55e' }]} />
                            <Text style={styles.sectionTitle}>Leads - Completed</Text>
                          </View>
                        </View>
                        {completedLeads.map((item) => (
                          <LeadCard
                            key={item.id} item={item}
                            currentLocation={locationRef.current} cardType="completed"
                          />
                        ))}
                      </>
                    )}
                    {acceptedLeads.length === 0 && completedLeads.length === 0 && (
                      <Text style={styles.emptyText}>No leads yet.</Text>
                    )}
                  </>
                )}

                {activeFilter === 'completed' && (
                  completedLeads.length > 0
                    ? completedLeads.map((item) => (
                        <LeadCard
                          key={item.id} item={item}
                          currentLocation={locationRef.current} cardType="completed"
                        />
                      ))
                    : <Text style={styles.emptyText}>No completed leads yet.</Text>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Reject Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={rejectModalVisible} transparent animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject Reason</Text>
            <Text style={styles.modalLabel}>Comment</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Type your comment here."
              placeholderTextColor="#aaa"
              multiline numberOfLines={4}
              value={rejectComment}
              onChangeText={setRejectComment}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1, backgroundColor: '#aaa' }]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectLeadId(null);
                  setRejectComment('');
                }}
              >
                <Text style={styles.modalSaveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1 }]}
                onPress={confirmReject}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SurveyerScreen;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  logo: { width: 200, height: 100 },
  offLogoutBtn: { position: 'absolute', top: 55, left: 20, zIndex: 10 },
  offToggleBtn: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 4, paddingVertical: 2, elevation: 4,
  },
  offTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message: { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 30 },
  fixedTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', elevation: 6,
  },
  offlineBanner: {
    position: 'absolute', top: 90, left: 0, right: 0, zIndex: 99,
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 16, paddingBottom: 6,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyText: {
    textAlign: 'center', marginTop: 40,
    color: '#999', fontSize: 14, paddingHorizontal: 30,
  },
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
  commentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8,
  },
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 12, padding: 20, elevation: 10,
  },
  modalTitle: {
    fontSize: 18, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 16, color: '#222',
  },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#333',
    textAlignVertical: 'top', minHeight: 90, marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#ED1C25', paddingVertical: 13,
    borderRadius: 8, alignItems: 'center',
  },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
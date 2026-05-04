// screens/SurveyerScreen.js — Full offline + auto-sync version

import React, { useState, useEffect, useRef } from 'react';
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
} from '../service/localLeadsStorage';
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
      <View style={styles.rowBetween}>
        <Text style={styles.referred}>
          Referred by — <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
        </Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>

      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={22} color="#aaa" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="call-outline" size={12} color="#555" />
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

        {cardType === 'accepted' && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            {item.status === 'completed' ? (
              <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓ Completed</Text>
              </View>
            ) : item.status === 'inprogress' ? (
              <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#f97316' }]} onPress={() => onStart(item.id)}>
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

        {cardType === 'completed' && (
          <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓ Completed</Text>
          </View>
        )}
      </View>

      <View style={[styles.commentRow, { borderTopWidth: 0.5, borderTopColor: '#eee', marginTop: 8, paddingTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 2 }}>Comment</Text>
          <Text numberOfLines={2} style={styles.comment}>{item.comment}</Text>
        </View>
        <TouchableOpacity disabled={!item.comment || item.comment.length <= 200}>
          <Text style={[styles.seeMore, { color: item.comment && item.comment.length > 200 ? '#1E88E5' : '#ccc' }]}>
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

  const [isOn, setIsOn]                   = useState(false);
  const [leads, setLeads]                 = useState([]);       // unaccepted
  const [acceptedLeads, setAcceptedLeads] = useState([]);       // accepted + inprogress
  const [completedLeads, setCompletedLeads] = useState([]);     // completed
  const [leadsLoading, setLeadsLoading]   = useState(false);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [isOnline, setIsOnline]           = useState(true);
  const [pendingCount, setPendingCount]   = useState(0);

  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment]           = useState('');
  const [rejectLeadId, setRejectLeadId]             = useState(null);

  // ── Net watcher — auto sync when net comes back ───────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      if (online) {
        console.log('[SurveyerScreen] Net restored — running sync queue...');
        const result = await processSyncQueue();
        if (result.synced > 0) {
          console.log(`[SurveyerScreen] Synced ${result.synced} offline actions`);
          // Refresh from server after sync
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

  // ── Focus — completed leads from InProgress ───────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      const completedIds = route.params?.completedIds;
      if (!completedIds || completedIds.length === 0) return;
      navigation.setParams({ completedIds: null });

      setAcceptedLeads((prev) => {
        const toMove = prev.filter((l) => completedIds.includes(l.id));
        if (toMove.length === 0) return prev;
        setCompletedLeads((c) => [...c, ...toMove.map((l) => ({ ...l, status: 'completed' }))]);
        return prev.filter((l) => !completedIds.includes(l.id));
      });
    }, [route.params?.completedIds])
  );

  // ── Restore state on app open ─────────────────────────────────────────────
  const restoreState = async () => {
    const saved = await AsyncStorage.getItem('surveyer_is_on');
    if (saved === 'true') {
      setIsOn(true);
      if (Platform.OS === 'android') NativeModules.StartStopService?.startService();
      startTracking();
    }

    // 1. Load local instantly
    await loadLocalLeads();

    // 2. Sync in background
    await fetchAndMergeLeads();
  };

  // ── Load from local storage ───────────────────────────────────────────────
  const loadLocalLeads = async () => {
    const local = await getAcceptedLeads();
    if (!isMounted.current) return;
    setAcceptedLeads(local.filter((l) => l.status === 'accepted' || l.status === 'inprogress'));
    setCompletedLeads(local.filter((l) => l.status === 'completed'));
  };

  // ── Fetch from API + merge ────────────────────────────────────────────────
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
        id: item._id, name: item.name, phone: item.mobile,
        city: item.city, comment: item.comment, referredBy: item.referredBy,
        date: item.createdAt, latitude: item.latitude, longitude: item.longitude,
        whatsappNo: item.whatsappNo, email: item.email, address: item.address,
        status: item.status,
      }));

      if (!isMounted.current) return;

      setLeads(mapped.filter((l) => l.status === 'unaccepted'));

      const serverNonNew = mapped.filter((l) => l.status !== 'unaccepted');
      const merged = await mergeWithServerLeads(serverNonNew);

      setAcceptedLeads(merged.filter((l) => l.status === 'accepted' || l.status === 'inprogress'));
      setCompletedLeads(merged.filter((l) => l.status === 'completed'));

    } catch (err) {
      // Offline — local already loaded
      console.log('[SurveyerScreen] Offline, using local data');
    } finally {
      if (isMounted.current) setLeadsLoading(false);
    }
  };

  // ── Try API (fire-and-forget) ─────────────────────────────────────────────
  const tryApi = async (fn) => {
    try { await fn(); }
    catch (e) { console.log('[SurveyerScreen] API failed (offline):', e?.message); }
  };

 // ── Accept ────────────────────────────────────────────────────────────────
const handleAccept = async (item) => {
  // Local first
  await saveAcceptedLead(item);
  setLeads((prev) => prev.filter((l) => l.id !== item.id));
  setAcceptedLeads((prev) => {
    if (prev.some((l) => l.id === item.id)) return prev;
    return [...prev, { ...item, status: 'accepted' }];
  });

  // ── Get surveyor number from stored user data ──
  let surveyorNumber = '';
  try {
    const userData = await AsyncStorage.getItem(USER_DATA);
    const parsed = userData ? JSON.parse(userData) : null;
    surveyorNumber = parsed?.UserInfo?.phoneNo || '';
  } catch (e) {
    console.log('[handleAccept] Failed to get surveyor number:', e?.message);
  }

  const payload = {
    mobile: item.phone,
    surveyorNumber,
  };

  // Queue for sync (offline support)
  await enqueue(`accept_${item.id}`, 'ACCEPT_LEAD', payload);

  // Try API immediately if online
  // Try API immediately if online
if (isOnline) {
  tryApi(() => API.post('/order/accept', payload));
  tryApi(() => API.put('/order/updatestatus', { mobile: item.phone, status: 'accepted' }));
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

    try {
      await API.post('/order/reject', { mobile: lead.phone, reason: rejectComment.trim() });
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
    const lead = acceptedLeads.find((l) => l.id === id);
    if (!lead) return;

    // Local first
    await updateAcceptedLeadStatus(id, 'inprogress');
    setAcceptedLeads((prev) =>
      prev.map((l) => l.id === id ? { ...l, status: 'inprogress' } : l)
    );

    // Queue
    await enqueue(`status_inprogress_${id}`, 'STATUS_UPDATE', {
      mobile: lead.phone, status: 'inprogress',
    });

    // Try API + notification if online
    if (isOnline) {
      // ── Get surveyor number ──
      let surveyorNumber = '';
      try {
        const userData = await AsyncStorage.getItem(USER_DATA);
        const parsed   = userData ? JSON.parse(userData) : null;
        surveyorNumber = parsed?.UserInfo?.phoneNo || '';
      } catch (e) {
        console.log('[handleStart] Failed to get surveyor number:', e?.message);
      }

      // ── இரண்டும் call பண்ணு ──
      tryApi(() => API.put('/order/updatestatus', { mobile: lead.phone, status: 'inprogress' }));
      tryApi(() => API.post('/order/inprogress', { mobile: lead.phone, surveyorNumber }));

      try {
        await API.post('/notification/trigger', {
          surveyorNumber, customerMobile: lead.phone, scenarioType: 1,
        });
      } catch (e) {
        console.log('[SurveyerScreen] Notification error:', e?.message);
      }
    } else {
      await enqueue(`notif_start_${id}`, 'NOTIFICATION', {
        customerMobile: lead.phone, scenarioType: 1,
      });
    }
startHighFrequencyTracking(() => currentLocation);

    navigation.navigate('InProgress', { lead: { ...lead, status: 'inprogress' } });
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
        await requestIOSLocationPermission();
      }
      setIsOn(true);
      await AsyncStorage.setItem('surveyer_is_on', 'true');
      startTracking();
      fetchAndMergeLeads();
    } else {
      setIsOn(false);
      await AsyncStorage.setItem('surveyer_is_on', 'false');
      stopTracking();
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

      {/* ── OFF STATE ────────────────────────────────────────────────────── */}
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
        <Image source={require('../../assets/images/kondass.png')} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.offTextContainer}>
        <Text style={styles.welcome}>Welcome!</Text>
        <Text style={styles.message}>Let's get started! Turn on availability!</Text>
      </View>

      {/* ── Unaccepted Leads (OFF state) ── */}
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
                  currentLocation={currentLocation}
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

      {/* ── ON STATE ─────────────────────────────────────────────────────── */}
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

          {/* Offline banner */}
          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.offlineBannerText}>Offline </Text>
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

            {leadsLoading && <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />}
            {!leadsLoading && leads.length === 0 && (
              <Text style={styles.emptyText}>No new leads available.</Text>
            )}
            {!leadsLoading && leads.map((item) => (
              <LeadCard key={item.id} item={item} currentLocation={currentLocation}
                cardType="unaccepted" onAccept={handleAccept} onReject={handleReject} />
            ))}

            {/* Accepted / Completed */}
            {(acceptedLeads.length > 0 || completedLeads.length > 0) && (
              <>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.sectionDot, { backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#fd9104' }]} />
                    <Text style={styles.sectionTitle}>
                      {activeFilter === 'completed' ? 'Leads - Completed' : 'Leads - Accepted'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('all')}
                      style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: activeFilter === 'all' ? '#ED1C25' : '#e5e7eb' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: activeFilter === 'all' ? '#fff' : '#555' }}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('completed')}
                      style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#e5e7eb' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: activeFilter === 'completed' ? '#fff' : '#555' }}>Completed</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {activeFilter === 'all' && (
                  <>
                    {acceptedLeads.map((item) => (
                      <LeadCard key={item.id} item={item} currentLocation={currentLocation}
                        cardType="accepted" onStart={handleStart} />
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
                          <LeadCard key={item.id} item={item} currentLocation={currentLocation} cardType="completed" />
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
                        <LeadCard key={item.id} item={item} currentLocation={currentLocation} cardType="completed" />
                      ))
                    : <Text style={styles.emptyText}>No completed leads yet.</Text>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Reject Modal ─────────────────────────────────────────────────── */}
      <Modal visible={rejectModalVisible} transparent animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}>
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
                onPress={() => { setRejectModalVisible(false); setRejectLeadId(null); setRejectComment(''); }}
              >
                <Text style={styles.modalSaveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, { flex: 1 }]} onPress={confirmReject}>
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
  offToggleBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 2, elevation: 4 },
  offTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message: { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 30 },
  fixedTopBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12, backgroundColor: '#fff', elevation: 6 },
  offlineBanner: { position: 'absolute', top: 90, left: 0, right: 0, zIndex: 99, backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 16, paddingBottom: 6 },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 14, paddingHorizontal: 30 },
  card: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 12, borderRadius: 10, padding: 12, elevation: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  referred: { fontSize: 12, color: '#E53935' },
  date: { fontSize: 12, color: '#888' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: 'bold' },
  subText: { fontSize: 12, color: '#555' },
  iconContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { padding: 4 },
  commentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12 },
  startBtn: { backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', width: '85%', borderRadius: 12, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#222' },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13, color: '#333', textAlignVertical: 'top', minHeight: 90, marginBottom: 16 },
  modalSaveBtn: { backgroundColor: '#ED1C25', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
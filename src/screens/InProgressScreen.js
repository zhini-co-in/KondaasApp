import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, Alert, Dimensions, Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SCREEN_NAMES } from '../constants/screenNames';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLocationTracking, getDistance, stopHighFrequencyTracking } from '../service/locationService';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';
import { updateAcceptedLeadStatus } from '../service/Localleadsstorage';
import { enqueue } from '../service/syncQueue';
import LeadCard from '../components/LeadCard';
import { BASE_URL } from '../api/api1';

const { width } = Dimensions.get('window');

// 👇 புதுசா சேர்த்தது: form submit ஆன lead id-களை permanent-ஆ track பண்ண
const FORM_SUBMITTED_KEY = 'form_submitted_lead_ids';

// ─────────────────────────────────────────────────────────────────────────────
// InProgressScreen
// ─────────────────────────────────────────────────────────────────────────────
const InProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isMounted = useRef(true);
  const { lead, completedLeadId } = route.params || {};
  const [startLocation] = useState(route.params?.initialLocation || null);

  const [inProgressLeads, setInProgressLeads] = useState(
    lead ? [{ ...lead, id: lead.id || lead._id }] : []
  );
  const [reachedModalVisible, setReachedModalVisible]   = useState(false);
  const [selectedLead, setSelectedLead]                 = useState(null);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [completedTargetLead, setCompletedTargetLead]   = useState(null);
  const [isOnline, setIsOnline]                         = useState(true);
  const [formSubmittedIds, setFormSubmittedIds] = useState(new Set());

  const { currentLocation, setCurrentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

  // ── Net watcher ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (completedLeadId) {
      setInProgressLeads((prev) =>
        prev.map((l) => l.id === completedLeadId ? { ...l, status: 'completed' } : l)
      );
      stopHighFrequencyTracking();
    }
  }, [completedLeadId]);

  useEffect(() => {
    AsyncStorage.getItem('last_known_location').then(val => {
      if (val && isMounted.current) setCurrentLocation(JSON.parse(val));
    });
    startTracking();
    return () => {
      isMounted.current = false;
      stopTracking();
      stopHighFrequencyTracking();
    };
  }, []);

  // 👇 புதுசா சேர்த்தது: mount ஆகும்போது persisted formSubmittedIds-ஐ load பண்ணு
  // இது இல்லாம, screen unmount/remount ஆகும்போது (அல்லது app restart) formSubmittedIds
  // Set காலியாகிடும், அதனால submit பண்ண lead-க்கும் "Site Observation" button
  // மறுபடியும் enable-ஆ தெரியும்.
  useEffect(() => {
    const loadPersistedFormSubmittedIds = async () => {
      try {
        const raw = await AsyncStorage.getItem(FORM_SUBMITTED_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        if (isMounted.current && ids.length > 0) {
          setFormSubmittedIds((prev) => new Set([...prev, ...ids]));
        }
      } catch (e) {}
    };
    loadPersistedFormSubmittedIds();
  }, []);

  // 👇 புதுசா சேர்த்தது: submit ஆன leadId-ஐ AsyncStorage-ல permanent-ஆ save பண்ணும் helper
  const persistFormSubmittedId = async (id) => {
    try {
      const raw = await AsyncStorage.getItem(FORM_SUBMITTED_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        await AsyncStorage.setItem(FORM_SUBMITTED_KEY, JSON.stringify(ids));
      }
    } catch (e) {}
  };

  // route.params.lead மாறும்போது state sync பண்ணு
  useEffect(() => {
    const updatedLead = route.params?.lead;
    if (!updatedLead) return;
    setInProgressLeads((prev) =>
      prev.map((l) =>
        l.id === (updatedLead.id || updatedLead._id)
          ? { ...l, manualSiteEnabled: updatedLead.manualSiteEnabled ?? l.manualSiteEnabled }
          : l
      )
    );
  }, [route.params?.lead]);

  useFocusEffect(
    React.useCallback(() => {
      const completedId = route.params?.completedLeadId;
      if (!completedId) return;
      navigation.setParams({ completedLeadId: null });
      setInProgressLeads((prev) =>
        prev.map((l) => l.id === completedId ? { ...l, status: 'completed' } : l)
      );
      stopHighFrequencyTracking();
    }, [route.params?.completedLeadId])
  );
  useEffect(() => {
  if (lead) console.log('🔍 LEAD OBJECT:', JSON.stringify(lead, null, 2));
}, []);
  useFocusEffect(
  React.useCallback(() => {
    const submittedId = route.params?.formSubmittedLeadId;
    if (!submittedId) return;
    navigation.setParams({ formSubmittedLeadId: null });
    setFormSubmittedIds((prev) => new Set([...prev, submittedId]));
    // 👇 புதுசா சேர்த்தது: permanent-ஆ persist பண்ணு, அப்போ தான் அடுத்த
    // தடவை screen வரும்போதும் button disable-ஆ இருக்கும்.
    persistFormSubmittedId(submittedId);
  }, [route.params?.formSubmittedLeadId])
);

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleManualEnable = async (item) => {
    setInProgressLeads((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, manualSiteEnabled: true } : l))
    );
    const surveyorNumber = await getSurveyorNumber();
    try {
      // handleManualEnable — scenarioType 3
await API.post('/notification/trigger', {
  surveyorNumber, customerMobile: item.phone, name: item.name, scenarioType: 3,
});
    } catch (e) {}
    // 👇 புதுசா சேர்த்தது: Start location + Reached location — exact lat/long
  // இரண்டையும் dealId-யோட backend-க்கு அனுப்பி km calc பண்ண save பண்ணும்
  try {
    if (startLocation && currentLocation && item.dealId) {
      await API.post('/location/distance', {
        dealId:   item.dealId,
        startLat: startLocation.latitude,
        startLng: startLocation.longitude,
        endLat:   currentLocation.latitude,
        endLng:   currentLocation.longitude,
      });
    }
  } catch (e) {
    // offline / API fail — queue-ல போட்டு பின்னாடி sync ஆகும்
    await enqueue(`job_coords_${item.id}`, 'JOB_COORDINATES', {
      dealId:   item.dealId,
      startLat: startLocation?.latitude,
      startLng: startLocation?.longitude,
      endLat:   currentLocation?.latitude,
      endLng:   currentLocation?.longitude,
    });
  }
    setSelectedLead({ ...item, id: item.id || item._id });
    setReachedModalVisible(true);
  };

  const handleSiteObservation = (item) => {
    navigation.navigate('Form', {
      category: 'site_observation',
      lead: { ...item, id: item.id || item._id },
    });
  };

  const handleEdit = (item) => {
    navigation.navigate('Form', {
      category: 'site_observation',
      lead: { ...item, id: item.id || item._id },
      mode: 'edit',
    });
  };

  const handleMarkCompleted = (item) => {
    setCompletedTargetLead(item);
    setCompletedModalVisible(true);
  };

  // ✅ FIX: confirmMarkCompleted — with /order/complete endpoint
  const confirmMarkCompleted = async () => {
    const item = completedTargetLead;
    const leadId = item.id || item._id;
    const dealId = item.dealId;
    const endAt  = Date.now();

    setCompletedModalVisible(false);

    // Step 1 — Local update
    await updateAcceptedLeadStatus(leadId, 'completed');

    setInProgressLeads((prev) => {
      const updated = prev.map((l) =>
        l.id === leadId ? { ...l, status: 'completed' } : l
      );
      stopHighFrequencyTracking();

      const completedIds = updated
        .filter((l) => l.status === 'completed')
        .map((l) => l.id);

      setTimeout(() => {
        navigation.navigate(SCREEN_NAMES.SURVEYER_SCREEN, { completedIds });
      }, 300);

      return updated;
    });

    // Step 2 — API / Queue
    if (isOnline) {
      const surveyorNumber = await getSurveyorNumber();

      // 2a. Update order status
      try {
  await API.put('/order/updatestatus', { id: dealId, status: 'completed' });
} catch (err) {
  await enqueue(`status_completed_${leadId}`, 'STATUS_UPDATE', {
    id: leadId, status: 'completed',
  });
}

      // 2b. Flowtrix sync
      try {
        await API.post('/order/sync-status', {
          customerMobile: item.phone,
          surveyorNumber,
          status: 'completed',
          endAt,
        });
      } catch (err) {
        await enqueue(`flowtrix_completed_${leadId}`, 'FLOWTRIX_SYNC', {
          customerMobile: item.phone,
          surveyorNumber,
          status: 'completed',
          endAt,
        });
      }

      // ✅ 2c. NEW: Order completion endpoint (admin_complete collection)
      try {
  await API.post('/order/complete', {
    customerMobile: item.phone,
    customerName: item.name,
    customerAddress: item.address,
    surveyorNumber,
    receivedAt: endAt,
  });
  console.log(`✅ Order completion tracked for ${item.phone}`);
} catch (err) {
  console.log(`⚠️ /order/complete failed, queuing:`, err.message);
  await enqueue(`order_complete_${leadId}`, 'ORDER_COMPLETE', {
    customerMobile: item.phone,
    customerName: item.name,
    customerAddress: item.address,
    surveyorNumber,
    receivedAt: endAt,
  });
}

      // 2d. Notification trigger
      // 2d. Notification trigger
      // 2d. Notification trigger
      try {
        await API.post('/notification/trigger', {
          customerMobile: item.phone, name: item.name, scenarioType: 4, deal_id: dealId,
          state: item.state || item.State || item.customerState || item.address?.state || undefined,
        });
      } catch (err) {
        await enqueue(`notif_completed_${leadId}`, 'NOTIFICATION', {
          customerMobile: item.phone, name: item.name, scenarioType: 4, deal_id: dealId,
          state: item.state || item.State || item.customerState || item.address?.state || undefined,
        });
      }
    } else {
      // Offline — queue all operations
      const surveyorNumber = await getSurveyorNumber();
      await enqueue(`status_completed_${leadId}`, 'STATUS_UPDATE', {
        mobile: item.phone, status: 'completed',
      });
      await enqueue(`flowtrix_completed_${leadId}`, 'FLOWTRIX_SYNC', {
        customerMobile: item.phone,
        surveyorNumber,
        status: 'completed',
        endAt,
      });
      await enqueue(`order_complete_${leadId}`, 'ORDER_COMPLETE', {
        customerMobile: item.phone,
        surveyorNumber,
        receivedAt: endAt,
      });
      // Offline branch — also add name
// AFTER
await enqueue(`notif_completed_${leadId}`, 'NOTIFICATION', {
        customerMobile: item.phone, name: item.name, scenarioType: 4, deal_id: dealId,
        state: item.state || item.State || item.customerState || item.address?.state || undefined,
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          const hasIncomplete = inProgressLeads.some(l => l.status !== 'completed');
          if (hasIncomplete) {
            Alert.alert('Hold on!', 'You have an unsubmitted form. Are you sure you want to leave?', [
              { text: 'Stay', style: 'cancel' },
              { text: 'Leave Anyway', onPress: () => navigation.goBack() },
            ]);
          } else {
            navigation.goBack();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#ED1C25" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead - Inprogress</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.offlineBannerText}>Offline — changes will sync when connected</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ padding: 15, paddingTop: 20 }}>
          {inProgressLeads.map((item) => (
            <LeadCard
              key={item.id}
              item={item}
              cardType="inprogress"
              currentLocation={currentLocation}
              onSiteObservation={handleSiteObservation}
              onManualEnable={handleManualEnable}
              onEdit={handleEdit}
              onMarkCompleted={handleMarkCompleted}
              navigation={navigation}
              formSubmitted={formSubmittedIds.has(item.id)} 
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Reached Modal ── */}
      <Modal visible={reachedModalVisible} transparent animationType="fade"
        onRequestClose={() => setReachedModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={{ backgroundColor: '#fef2f2', borderRadius: 50, padding: 14, marginBottom: 14 }}>
              <Ionicons name="location" size={32} color="#ED1C25" />
            </View>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#222', marginBottom: 4, textAlign: 'center' }}>
              You've Reached the Location!
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center' }}>
              Do you want to start Site Observation?
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#ED1C25', width: '100%', paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}
              onPress={() => { setReachedModalVisible(false); handleSiteObservation(selectedLead); }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}> Start Site Observation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: '#f1f1f1', width: '100%', paddingVertical: 13, borderRadius: 8, alignItems: 'center' }}
              onPress={() => setReachedModalVisible(false)}
            >
              <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Completed Confirmation Modal ── */}
      <Modal visible={completedModalVisible} transparent animationType="fade"
        onRequestClose={() => setCompletedModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 30 }]}>
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 50, padding: 16, marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 6, textAlign: 'center' }}>
              Wrap It Up?
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 6, textAlign: 'center', lineHeight: 20 }}>
              You're about to mark
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#22c55e', marginBottom: 6, textAlign: 'center' }}>
              {completedTargetLead?.name}
            </Text>
            <Text style={{ fontSize: 13, color: '#666', marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
              as completed. This means the job is done{'\n'}and the lead will be closed.
            </Text>

            {/* Offline warning inside modal */}
            {!isOnline && (
              <View style={{
                backgroundColor: '#fff7ed', borderRadius: 8,
                paddingHorizontal: 12, paddingVertical: 8,
                marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6,
              }}>
                <Ionicons name="cloud-offline-outline" size={14} color="#f97316" />
                <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '600', flex: 1 }}>
                  You're offline. This will sync when connected.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={{ backgroundColor: '#22c55e', width: '100%', paddingVertical: 13, borderRadius: 8, alignItems: 'center', marginBottom: 10 }}
              onPress={confirmMarkCompleted}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
  Yes, Mark as Completed
</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: '#f1f1f1', width: '100%', paddingVertical: 13, borderRadius: 8, alignItems: 'center' }}
              onPress={() => setCompletedModalVisible(false)}
            >
              <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>Not Yet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default InProgressScreen;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 55, paddingBottom: 14,
    backgroundColor: '#fff', elevation: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  offlineBanner: {
    backgroundColor: '#f97316', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', marginBottom: 12,
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
  commentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12, color: '#1E88E5' },
  completedPill: {
    backgroundColor: '#EAF3DE', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  completedPillText: { color: '#3B6D11', fontSize: 12, fontWeight: '600' },
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, elevation: 10 },
});
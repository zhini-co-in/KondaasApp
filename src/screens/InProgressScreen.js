import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, Alert, Dimensions, Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLocationTracking, getDistance, stopHighFrequencyTracking } from '../service/locationService';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';
import { updateAcceptedLeadStatus } from '../service/localLeadsStorage';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard
// ─────────────────────────────────────────────────────────────────────────────
const LeadCard = ({
  item, currentLocation,
  onSiteObservation, onManualEnable, onEdit,
  onMarkCompleted, navigation,
}) => {
  const hasLatLong = item.latitude && item.longitude &&
    item.latitude !== '' && item.longitude !== '';

  const distToLead = currentLocation && hasLatLong
    ? Math.round(getDistance(
        currentLocation.latitude, currentLocation.longitude,
        parseFloat(item.latitude), parseFloat(item.longitude)
      ))
    : null;

  const withinRange = distToLead !== null && distToLead <= 300;
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (withinRange && !item.manualSiteEnabled && !notifiedRef.current) {
      notifiedRef.current = true;
      API.post('https://kondaas-api.trisentrix-dev.workers.dev/notification/trigger', {
        customerMobile: item.phone,
        scenarioType: 3,
      }).catch(e => console.log('Auto 300m notify error:', e));
      onManualEnable(item);
    }
  }, [withinRange]);

  const openMap = () => {
    if (item.latitude || item.address || item.city) {
      navigation.navigate('MapView', {
        latitude: item.latitude,
        longitude: item.longitude,
        address: item.address,
        city: item.city,
      });
    } else {
      Alert.alert('Location not available', 'No coordinates or address found.');
    }
  };

  return (
    <View style={styles.card}>

      {/* Top row */}
      <View style={styles.rowBetween}>
        <View style={styles.referredBadge}>
          <Text style={styles.referredText}>
            Referred by — <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
          </Text>
        </View>
        <Text style={styles.date}>{item.date}</Text>
      </View>

      {/* User info row */}
      <View style={styles.userRow}>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <TouchableOpacity
            onPress={() => { if (item.phone) Linking.openURL(`tel:${item.phone}`); }}
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
        </View>

        {/* Right side — status buttons */}
        {item.status === 'completed' ? (
          <View style={styles.completedPill}>
            <Ionicons name="checkmark-circle" size={14} color="#3B6D11" />
            <Text style={styles.completedPillText}>Completed</Text>
          </View>

        ) : (item.manualSiteEnabled || (hasLatLong && withinRange)) ? (
          <View style={{ alignItems: 'center', gap: 5 }}>
            <TouchableOpacity
              style={styles.smallSiteBtn}
              onPress={() => onSiteObservation(item)}
            >
              <Text style={styles.smallSiteBtnText}>Site{'\n'}Observation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.commonBtn, { backgroundColor: '#3b82f6' }]}
              onPress={() => onEdit(item)}
            >
              <Ionicons name="create-outline" size={13} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.commonBtnText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.commonBtn, { backgroundColor: '#22c55e' }]}
              onPress={() => onMarkCompleted(item)}
            >
              <Ionicons name="checkmark-done-outline" size={13} color="#fff" style={{ marginRight: 3 }} />
              <Text style={styles.commonBtnText}>Completed</Text>
            </TouchableOpacity>
          </View>

        ) : (
          <View style={styles.reachBtnWrapper}>
            <TouchableOpacity
              style={[styles.commonBtn, { backgroundColor: '#f97316' }]}
              onPress={() => onManualEnable(item)}
            >
              <Ionicons name="navigate-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.commonBtnText}>Reached</Text>
            </TouchableOpacity>

            {!item.manualSiteEnabled && (
              <TouchableOpacity
                style={[styles.commonBtn, { backgroundColor: '#0ea5e9', marginTop: 6 }]}
                onPress={openMap}
              >
                <Ionicons name="map-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.commonBtnText}>Open Map</Text>
              </TouchableOpacity>
            )}

            {hasLatLong && distToLead !== null && (
              <View style={styles.distanceBox}>
                <Text style={styles.distanceLabel}>📍 Distance</Text>
                <Text style={styles.reachDistance}>
                  {distToLead >= 1000
                    ? (distToLead / 1000).toFixed(1) + ' km'
                    : distToLead + ' m'}
                </Text>
              </View>
            )}

            {!hasLatLong && item.address && (
              <Text numberOfLines={2} style={{
                fontSize: 9, color: '#888', marginTop: 4,
                textAlign: 'center', maxWidth: 100,
              }}>
                {item.address}
              </Text>
            )}
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
// InProgressScreen
// ─────────────────────────────────────────────────────────────────────────────
const InProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isMounted = useRef(true);
  const { lead, completedLeadId } = route.params || {};

  const [inProgressLeads, setInProgressLeads] = useState(
    lead ? [{ ...lead, id: lead.id || lead._id }] : []
  );

  useEffect(() => {
    if (completedLeadId) {
      setInProgressLeads((prev) =>
        prev.map((l) =>
          l.id === completedLeadId ? { ...l, status: 'completed' } : l
        )
      );
      stopHighFrequencyTracking();
    }
  }, [completedLeadId]);

  const { currentLocation, setCurrentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

  useEffect(() => {
    AsyncStorage.getItem('last_known_location').then(val => {
      if (val && isMounted.current) {
        setCurrentLocation(JSON.parse(val));
      }
    });
    startTracking();
    return () => {
      isMounted.current = false;
      stopTracking();
      stopHighFrequencyTracking();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const completedId = route.params?.completedLeadId;
      if (!completedId) return;
      navigation.setParams({ completedLeadId: null });
      setInProgressLeads((prev) =>
        prev.map((l) =>
          l.id === completedId ? { ...l, status: 'completed' } : l
        )
      );
      stopHighFrequencyTracking();
    }, [route.params?.completedLeadId])
  );

  const [reachedModalVisible, setReachedModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // ✅ Custom Completed Confirmation Modal state
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [completedTargetLead, setCompletedTargetLead] = useState(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleManualEnable = async (item) => {
    setInProgressLeads((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, manualSiteEnabled: true } : l))
    );

    let surveyorNumber = '';
    try {
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed = userData ? JSON.parse(userData) : null;
      surveyorNumber = parsed?.UserInfo?.phoneNo || '';
    } catch (e) {
      console.log('[handleManualEnable] Failed to get surveyor number:', e?.message);
    }

    try {
      await API.post('/notification/trigger', {
        surveyorNumber,
        customerMobile: item.phone,
        scenarioType: 3,
      });
      console.log('[handleManualEnable] Notification sent ✅');
    } catch (e) {
      console.log('[handleManualEnable] Notification error:', e?.message);
    }

    setSelectedLead({ ...item, id: item.id || item._id });
    setReachedModalVisible(true);
  };

  const handleSiteObservation = (item) => {
    const leadToPass = { ...item, id: item.id || item._id };
    navigation.navigate('Form', {
      category: 'site_observation',
      lead: leadToPass,
    });
  };

  const handleEdit = (item) => {
    navigation.navigate('Form', {
      category: 'site_observation',
      lead: { ...item, id: item.id || item._id },
      mode: 'edit',
    });
  };

  // ✅ Show custom completed modal
  const handleMarkCompleted = (item) => {
    setCompletedTargetLead(item);
    setCompletedModalVisible(true);
  };

const confirmMarkCompleted = async () => {
  const item = completedTargetLead;
  const leadId = item.id || item._id;

  setCompletedModalVisible(false);

  try {
    // ✅ Update order status
    await API.put('/order/updatestatus', {
      mobile: item.phone,
      status: 'completed',
    });

    // ✅ Trigger completion notification
    await API.post('https://board.trisentrix.com/notification/trigger', {
      customerMobile: item.phone,
      scenarioType: 4,
    });

    // ✅ Local storage update
    await updateAcceptedLeadStatus(leadId, 'completed');

    // ✅ UI update
    setInProgressLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, status: 'completed' }
          : l
      )
    );

    stopHighFrequencyTracking();

    console.log('Completed notification sent ✅');

  } catch (err) {
    console.log('Completed notification error:', err);

    Alert.alert(
      'Oops!',
      'Something went wrong. Please try again.'
    );
  }
};

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          const hasIncomplete = inProgressLeads.some(l => l.status !== 'completed');
          if (hasIncomplete) {
            Alert.alert(
              'Hold on!',
              'You have an unsubmitted form. Are you sure you want to leave?',
              [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave Anyway', onPress: () => navigation.goBack() },
              ]
            );
          } else {
            navigation.goBack();
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#ED1C25" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead - Inprogress</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ padding: 15, paddingTop: 20 }}>
          {inProgressLeads.map((item) => (
            <LeadCard
              key={item.id}
              item={item}
              currentLocation={currentLocation}
              onSiteObservation={handleSiteObservation}
              onManualEnable={handleManualEnable}
              onEdit={handleEdit}
              onMarkCompleted={handleMarkCompleted}
              navigation={navigation}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Reached Modal ── */}
      <Modal
        visible={reachedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReachedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 28 }]}>
            <View style={{
              backgroundColor: '#fef2f2', borderRadius: 50,
              padding: 14, marginBottom: 14,
            }}>
              <Ionicons name="location" size={32} color="#ED1C25" />
            </View>
            <Text style={{
              fontSize: 17, fontWeight: 'bold', color: '#222',
              marginBottom: 4, textAlign: 'center',
            }}>
              You've Reached the Location!
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 24, textAlign: 'center' }}>
              Do you want to start Site Observation?
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#ED1C25', width: '100%',
                paddingVertical: 13, borderRadius: 8,
                alignItems: 'center', marginBottom: 10,
              }}
              onPress={() => {
                setReachedModalVisible(false);
                handleSiteObservation(selectedLead);
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                🏗️  Start Site Observation
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: '#f1f1f1', width: '100%',
                paddingVertical: 13, borderRadius: 8, alignItems: 'center',
              }}
              onPress={() => setReachedModalVisible(false)}
            >
              <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── ✅ Custom Completed Confirmation Modal ── */}
      <Modal
        visible={completedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 30 }]}>

            {/* Green check icon */}
            <View style={{
              backgroundColor: '#f0fdf4', borderRadius: 50,
              padding: 16, marginBottom: 16,
            }}>
              <Ionicons name="checkmark-circle" size={40} color="#22c55e" />
            </View>

            <Text style={{
              fontSize: 18, fontWeight: 'bold', color: '#111',
              marginBottom: 6, textAlign: 'center',
            }}>
              Wrap It Up?
            </Text>

            <Text style={{
              fontSize: 13, color: '#666',
              marginBottom: 6, textAlign: 'center', lineHeight: 20,
            }}>
              You're about to mark
            </Text>

            <Text style={{
              fontSize: 14, fontWeight: '700', color: '#22c55e',
              marginBottom: 6, textAlign: 'center',
            }}>
              {completedTargetLead?.name}
            </Text>

            <Text style={{
              fontSize: 13, color: '#666',
              marginBottom: 26, textAlign: 'center', lineHeight: 20,
            }}>
              as completed. This means the job is done{'\n'}and the lead will be closed. ✅
            </Text>

            {/* Yes button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#22c55e', width: '100%',
                paddingVertical: 13, borderRadius: 8,
                alignItems: 'center', marginBottom: 10,
              }}
              onPress={confirmMarkCompleted}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                Yes, Mark as Completed 🎉
              </Text>
            </TouchableOpacity>

            {/* Not yet button */}
            <TouchableOpacity
              style={{
                backgroundColor: '#f1f1f1', width: '100%',
                paddingVertical: 13, borderRadius: 8, alignItems: 'center',
              }}
              onPress={() => setCompletedModalVisible(false)}
            >
              <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>
                Not Yet
              </Text>
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
  card: {
    backgroundColor: '#fff', marginBottom: 12,
    borderRadius: 12, padding: 14, elevation: 3,
  },
  rowBetween: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
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
  reachDistance: {
    fontSize: 17, color: '#f97316', fontWeight: '800',
    letterSpacing: 0.5, lineHeight: 22,
  },
  smallSiteBtn: {
    backgroundColor: '#ED1C25', paddingHorizontal: 10,
    paddingVertical: 8, borderRadius: 6, alignItems: 'center', width: 100,
  },
  smallSiteBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 16, padding: 20, elevation: 10,
  },
});
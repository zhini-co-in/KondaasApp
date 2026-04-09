import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Image,
  StatusBar,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import API from '../api/api1';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { USER_DATA } from '../service/localStorage';

// ── Location service imports ──────────────────────────────────────────────────
import {
  getDistance,
  useLocationTracking,
  requestLocationPermissions,
} from '../service/locationService';

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard
// ─────────────────────────────────────────────────────────────────────────────
const LeadCard = ({
  item,
  currentLocation,
  onAccept,
  onReject,
  onStart,
  onSiteObservation,
  onManualEnable,
  onEdit,
  cardType,
}) => {
  const hasLatLong =
    item.latitude &&
    item.longitude &&
    item.latitude !== '' &&
    item.longitude !== '';

  const distToLead =
    currentLocation && hasLatLong
      ? Math.round(
          getDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            parseFloat(item.latitude),
            parseFloat(item.longitude)
          )
        )
      : null;

  const withinRange = distToLead !== null && distToLead <= 300;
  return (
    <View style={[styles.card, cardType === 'unaccepted' && { borderLeftWidth: 4, borderLeftColor: '#ED1C25' }]}>
      <View style={styles.rowBetween}>
        <Text style={styles.referred}>
          Referred by —{' '}
          <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
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

        {/* ── Unaccepted ── */}
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
      <View style={{
        backgroundColor: '#22c55e', paddingHorizontal: 10,
        paddingVertical: 6, borderRadius: 8,
      }}>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
          ✓ Completed
        </Text>
      </View>
    ) : item.status === 'inprogress' ? (
      // ✅ InProgress-ல் இருக்கும்போது — Resume button காட்டு
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

                {cardType === 'inprogress' && (
  <View style={{ alignItems: 'center', gap: 6 }}>
    <View
      style={{
        backgroundColor: '#22c55e',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        minWidth: 120,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
        ✓ Completed
      </Text>
    </View>

    <TouchableOpacity style={styles.iconBtn} onPress={() => onEdit(item)}>
  <Ionicons name="create-outline" size={18} color="#fff" />
</TouchableOpacity>
  </View>
)}
      </View>

      <View style={[styles.commentRow, { borderTopWidth: 0.5, borderTopColor: '#eee', marginTop: 8, paddingTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 2 }}>Comment</Text>
          <Text numberOfLines={2} style={styles.comment}>{item.comment}</Text>
        </View>
        <TouchableOpacity
  disabled={!item.comment || item.comment.length <= 200}
>
  <Text
    style={[
      styles.seeMore,
      {
        color:
          item.comment && item.comment.length > 200
            ? '#1E88E5'
            : '#ccc',
      },
    ]}
  >
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
  const isMounted = useRef(true);

  // ── Location (from locationService) ────────────────────────────────────────
  const { currentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isOn, setIsOn] = useState(false);
  const [leads, setLeads] = useState([]);
  const [acceptedLeads, setAcceptedLeads] = useState([]);
  const [inProgressLeads, setInProgressLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [acceptedFilter, setAcceptedFilter] = useState('all'); // 'all' | 'completed'

  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectLeadId, setRejectLeadId] = useState(null);

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [reachedModalVisible, setReachedModalVisible] = useState(false);
const [selectedLead, setSelectedLead] = useState(null);

const [completedFromProgress, setCompletedFromProgress] = useState([]);

const route = useRoute();

useFocusEffect(
  React.useCallback(() => {
    const completedIds = route.params?.completedIds;
    if (!completedIds || completedIds.length === 0) return;

    navigation.setParams({ completedIds: null });

    // ✅ accepted card-ஐ completed mark பண்ணு
    setAcceptedLeads((prev) =>
      prev.map((l) =>
        completedIds.includes(l.id) ? { ...l, status: 'completed' } : l
      )
    );

    setAcceptedFilter('completed');

  }, [route.params?.completedIds])
);
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    const restoreToggle = async () => {
  const saved = await AsyncStorage.getItem('surveyer_is_on');
  if (saved === 'true') {
    setIsOn(true);
    startTracking();
  }

  // ✅ Leads fetch பண்ணி inprogress check பண்ணு
  await fetchLeadsAndCheckInProgress();
};
  restoreToggle();

  return () => {
      isMounted.current = false;
      stopTracking();
    };
  }, []);

  // ── API helpers ────────────────────────────────────────────────────────────
  const fetchLeadsAndCheckInProgress = async () => {
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
      date: item.createdAt,
      latitude: item.latitude,
      longitude: item.longitude,
      whatsappNo: item.whatsappNo,
      email: item.email,
      address: item.address,
      status: item.status,
    }));

    if (isMounted.current) {
  const newLeads = mapped.filter((l) => l.status === 'unaccepted');
  const accepted = mapped.filter(
    (l) => l.status === 'accepted' || l.status === 'completed'
  );
  const inprogress = mapped.filter((l) => l.status === 'inprogress');

  setLeads(newLeads);
  setAcceptedLeads(accepted);
  setInProgressLeads(inprogress);

  // ✅ Only first load la mattum navigate
  if (isInitialLoad && inprogress.length > 0) {
    navigation.navigate('InProgress', {
      lead: inprogress[0],
    });
  }

  setIsInitialLoad(false); // 👈 important
}
  } catch (err) {
    console.log('Error fetching leads:', err);
  } finally {
    if (isMounted.current) setLeadsLoading(false);
  }
};

  const updateOrderStatus = async (mobile, status) => {
  try {
    await API.put('/order/updatestatus', { mobile, status });

    // ✅ important
    await fetchLeadsAndCheckInProgress();

  } catch (err) {
    console.log(`Status update error (${status}):`, err?.response?.data || err.message);
  }
};

  // ── Lead handlers ──────────────────────────────────────────────────────────
  const handleAccept = async (item) => {
    await updateOrderStatus(item.phone, 'accepted');
    setLeads((prev) => prev.filter((l) => l.id !== item.id));
    setAcceptedLeads((prev) => {
      if (prev.some((l) => l.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const handleReject = (id) => {
    setRejectLeadId(id);
    setRejectComment('');
    setRejectModalVisible(true);
  };

  const confirmReject = () => {
    setLeads((prev) => prev.filter((l) => l.id !== rejectLeadId));
    setRejectModalVisible(false);
    setRejectLeadId(null);
    setRejectComment('');
  };

 const handleStart = async (id) => {
  const lead = acceptedLeads.find((l) => l.id === id);
  if (!lead) return;

  await updateOrderStatus(lead.phone, 'inprogress');

  // ✅ Remove பண்ணாதே — status மட்டும் update பண்ணு
  setAcceptedLeads(prev =>
    prev.map(l => l.id === id ? { ...l, status: 'inprogress' } : l)
  );

  navigation.navigate('InProgress', {
    lead: { ...lead, status: 'inprogress' },
  });
};

  const handleManualEnable = (item) => {
  setInProgressLeads((prev) =>
    prev.map((l) => (l.id === item.id ? { ...l, manualSiteEnabled: true } : l))
  );

  // 👉 Popup open
  setSelectedLead(item);
  setReachedModalVisible(true);
};

const handleSiteObservation = (item) => {
  navigation.navigate('Form', {
    category: 'site_observation',
    lead: item,
    onFormComplete: async () => {

      // ✅ DB update
      await updateOrderStatus(item.phone, 'completed');

      // ✅ remove from inprogress
      setInProgressLeads(prev => prev.filter(l => l.id !== item.id));

      // ✅ add to accepted as completed
      setAcceptedLeads(prev =>
  prev.map(l =>
    l.id === item.id ? { ...l, status: 'completed' } : l
  )
);
    },
  });
};

  const handleEdit = (item) => {
    setEditLead(item);
    setEditForm({
      name: item.name || '',
      phone: item.phone || '',
      whatsappNo: item.whatsappNo || '',
      city: item.city || '',
      comment: item.comment || '',
      address: item.address || '',
      email: item.email || '',
      referredBy: item.referredBy || '',
      latitude: item.latitude || '',
      longitude: item.longitude || '',
    });
    setEditModalVisible(true);
  };

  const confirmEdit = async () => {
    try {
      const payload = {
        mobile: editForm.phone,
        name: editForm.name,
        whatsappNo: editForm.whatsappNo || editForm.phone,
        city: editForm.city,
        comment: editForm.comment,
        address: editForm.address || null,
        email: editForm.email || null,
        referredBy: editForm.referredBy,
        latitude: editForm.latitude || null,
        longitude: editForm.longitude || null,
      };

      const res = await API.put('/order/update', payload);

      setInProgressLeads((prev) =>
        prev.map((l) =>
          l.id === editLead.id
            ? {
                ...l,
                name: editForm.name,
                phone: editForm.phone,
                whatsappNo: editForm.whatsappNo,
                city: editForm.city,
                comment: editForm.comment,
                address: editForm.address,
                email: editForm.email,
                referredBy: editForm.referredBy,
                latitude: editForm.latitude,
                longitude: editForm.longitude,
              }
            : l
        )
      );

      setEditModalVisible(false);
      Alert.alert('Success', 'Lead updated successfully!');
    } catch (err) {
      console.log('Edit error:', err?.response?.status, JSON.stringify(err?.response?.data));
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update.');
    }
  };

  // ── Toggle (ON / OFF) ──────────────────────────────────────────────────────
  const handleToggle = async () => {
  if (!isOn) {
    const granted = await requestLocationPermissions();
    if (!granted) return;

    setIsOn(true);
    await AsyncStorage.setItem('surveyer_is_on', 'true');

    startTracking();
    fetchLeadsAndCheckInProgress(); // ✅ மட்டும் போதும்
  } else {
    setIsOn(false);
    await AsyncStorage.setItem('surveyer_is_on', 'false');
    stopTracking();
  }
};

  // ── Logout ─────────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── OFF STATE ─────────────────────────────────────────────────────── */}
      {!isOn && (
        <LinearGradient colors={['#F00001', '#B00100']} style={{ flex: 1 }}>
          {/* Logout */}
          <TouchableOpacity style={styles.offLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Toggle */}
          <View style={styles.offToggleBtn}>
            <Switch
              trackColor={{ false: '#ffffff88', true: '#fff' }}
              thumbColor="#ED1C25"
              value={isOn}
              onValueChange={handleToggle}
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

            {leadsLoading ? (
              <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
            ) : leads.length === 0 ? (
              <View style={styles.offTextContainer}>
                <Text style={styles.welcome}>Welcome!</Text>
                <Text style={styles.message}>Let's get started! Turn on availability!</Text>
              </View>
            ) : (
              <>
                <View style={[styles.sectionHeader, { paddingHorizontal: 15 }]}>
                  <View style={[styles.sectionDot, { backgroundColor: '#fff' }]} />
                  <Text style={[styles.sectionTitle, { color: '#fff' }]}>Leads - New</Text>
                </View>
                {leads.map((item) => (
                  <LeadCard
                    key={item.id}
                    item={item}
                    currentLocation={currentLocation}
                    cardType="unaccepted"
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </LinearGradient>
      )}

      {/* ── ON STATE ──────────────────────────────────────────────────────── */}
      {isOn && (
        <>
          {/* Fixed top bar */}
          <View style={styles.fixedTopBar}>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="#ED1C25" />
            </TouchableOpacity>
            <Switch
              trackColor={{ false: '#ccc', true: 'red' }}
              thumbColor="#fff"
              value={isOn}
              onValueChange={handleToggle}
            />
          </View>

          <ScrollView
            style={{ flex: 1, width: '100%', backgroundColor: '#F5F5F5' }}
            contentContainerStyle={{ paddingTop: 90, paddingBottom: 30 }}
          >
            {/* Section 1 – Un Accepted */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#ED1C25' }]} />
              <Text style={styles.sectionTitle}>Leads - New</Text>
            </View>

            {leadsLoading && (
              <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />
            )}
            {!leadsLoading && leads.length === 0 && (
              <Text style={styles.emptyText}>No leads available right now.</Text>
            )}
            {!leadsLoading &&
              leads.map((item) => (
                <LeadCard
                  key={item.id}
                  item={item}
                  currentLocation={currentLocation}
                  cardType="unaccepted"
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}

            {/* Section 2 – Accepted */}
{acceptedLeads.length > 0 && (
  <>
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: '#fd9104' }]} />
      <Text style={styles.sectionTitle}>Leads - Accepted</Text>

      {/* Filter buttons */}
      <View style={{ flexDirection: 'row', marginLeft: 'auto', gap: 6 }}>
        <TouchableOpacity
          onPress={() => setAcceptedFilter('all')}
          style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
            backgroundColor: acceptedFilter === 'all' ? '#22c55e' : '#e5e7eb',
          }}
        >
          <Text style={{
            fontSize: 11, fontWeight: 'bold',
            color: acceptedFilter === 'all' ? '#fff' : '#555',
          }}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setAcceptedFilter('completed')}
          style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
            backgroundColor: acceptedFilter === 'completed' ? '#22c55e' : '#e5e7eb',
          }}
        >
          <Text style={{
            fontSize: 11, fontWeight: 'bold',
            color: acceptedFilter === 'completed' ? '#fff' : '#555',
          }}>Completed</Text>
        </TouchableOpacity>
      </View>
    </View>

    {acceptedLeads
      .filter(item =>
        acceptedFilter === 'all' ? true : item.status === 'completed'
      )
      .map((item) => (
        <LeadCard
          key={item.id}
          item={item}
          currentLocation={currentLocation}
          cardType="accepted"
          onStart={handleStart}
        />
    ))}

    {acceptedLeads.filter(item =>
  acceptedFilter === 'all' ? true : item.status === 'completed'
).length === 0 && (
      <Text style={[styles.emptyText, { marginTop: 10 }]}>
        No completed leads yet.
      </Text>
    )}
  </>
)}

            {/* Section 3 – Inprogress */}
            {inProgressLeads.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: '#1bd824' }]} />
                  <Text style={styles.sectionTitle}>Leads - Completed</Text>
                </View>
                {inProgressLeads.map((item) => (
                  <LeadCard
                    key={item.id}
                    item={item}
                    currentLocation={currentLocation}
                    cardType="inprogress"
                    onSiteObservation={handleSiteObservation}
                    onManualEnable={handleManualEnable}
                    onEdit={handleEdit}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
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
              multiline
              numberOfLines={4}
              value={rejectComment}
              onChangeText={setRejectComment}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
  {/* Cancel Button */}
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

  {/* Save Button */}
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

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Edit Lead</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Name', key: 'name' },
                { label: 'Phone', key: 'phone' },
                { label: 'WhatsApp No', key: 'whatsappNo' },
                { label: 'City', key: 'city' },
                { label: 'Email', key: 'email' },
                { label: 'Referred By', key: 'referredBy' },
                { label: 'Address', key: 'address' },
                { label: 'Latitude', key: 'latitude' },
                { label: 'Longitude', key: 'longitude' },
                { label: 'Comment', key: 'comment' },
              ].map(({ label, key }) => (
                <View key={key} style={{ marginBottom: 12 }}>
                  <Text style={styles.modalLabel}>{label}</Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { minHeight: key === 'comment' || key === 'address' ? 70 : 44 },
                    ]}
                    value={editForm[key]}
                    onChangeText={(val) => setEditForm((prev) => ({ ...prev, [key]: val }))}
                    multiline={key === 'comment' || key === 'address'}
                    placeholderTextColor="#aaa"
                  />
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1, backgroundColor: '#aaa' }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalSaveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1 }]}
                onPress={confirmEdit}
              >
                <Text style={styles.modalSaveBtnText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
  visible={reachedModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setReachedModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalBox}>
      
      <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15 }}>
        You have reached the location
      </Text>

      <TouchableOpacity
        style={styles.smallSiteBtn}
        onPress={() => {
          setReachedModalVisible(false);
          handleSiteObservation(selectedLead);
        }}
      >
        <Text style={styles.smallSiteBtnText}>
          Site Observation
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modalSaveBtn, { marginTop: 10, backgroundColor: '#aaa' }]}
        onPress={() => setReachedModalVisible(false)}
      >
        <Text style={styles.modalSaveBtnText}>Cancel</Text>
      </TouchableOpacity>

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
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 16, paddingBottom: 6,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 14, paddingHorizontal: 30 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 12,
    borderRadius: 10, padding: 12, elevation: 3,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  referred: { fontSize: 12, color: '#E53935' },
  date: { fontSize: 12, color: '#888' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#f0f0f0', marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: 'bold' },
  subText: { fontSize: 12, color: '#555' },
  iconContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { padding: 4 },
  commentRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 8,
  },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12, color: '#1E88E5' },

  startBtn: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  reachBtnWrapper: { alignItems: 'center' },
  reachBtn: {
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, opacity: 0.85,
  },
  reachBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  reachDistance: { fontSize: 10, color: '#f97316', marginTop: 3, fontWeight: '600' },

  smallSiteBtn: {
    backgroundColor: '#ED1C25', paddingHorizontal: 10,
    paddingVertical: 8, borderRadius: 6, alignItems: 'center',
  },
  smallSiteBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  editBtn: {
    backgroundColor: '#3b82f6', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
  },
  editBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 12, padding: 20, elevation: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#222' },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#333',
    textAlignVertical: 'top', minHeight: 90, marginBottom: 16,
  },
  modalSaveBtn: { backgroundColor: '#ED1C25', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
 editBtn: {
  backgroundColor: '#3b82f6',
  padding: 8,
  borderRadius: 50,
  justifyContent: 'center',
  alignItems: 'center',
},
});
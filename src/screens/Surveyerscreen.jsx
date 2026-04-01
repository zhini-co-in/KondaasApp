import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Image,
  StatusBar,
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import API from '../api/api1';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BackgroundGeolocation from 'react-native-background-geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { USER_DATA } from '../service/localStorage';

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
};

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
    <View style={styles.card}>
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
    <TouchableOpacity style={styles.startBtn} onPress={() => onStart(item.id)}>
      <Ionicons name="play-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
      <Text style={styles.startBtnText}>Start</Text>
    </TouchableOpacity>
  </View>
)}

        {cardType === 'inprogress' && (() => {
  if (item.manualSiteEnabled || (hasLatLong && withinRange)) {
    return (
      <View style={{ alignItems: 'center', gap: 6 }}>
        <TouchableOpacity
          style={styles.smallSiteBtn}
          onPress={() => onSiteObservation(item)}
        >
          <Text style={styles.smallSiteBtnText}>Site{'\n'}Observation</Text>
        </TouchableOpacity>

        {/* ← NEW Edit Button */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => onEdit(item)}       // ← new prop
        >
          <Ionicons name="create-outline" size={12} color="#fff" style={{ marginRight: 2 }} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // All other cases → Show Reach button, tap to enable Site Observation
  return (
    <View style={styles.reachBtnWrapper}>
      <TouchableOpacity
        style={styles.reachBtn}
        onPress={() => onManualEnable(item.id)}
      >
        <Ionicons name="navigate-outline" size={14} color="#fff" style={{ marginRight: 3 }} />
        <Text style={styles.reachBtnText}>Reach</Text>
      </TouchableOpacity>
      {hasLatLong && distToLead !== null && (
        <Text style={styles.reachDistance}>{distToLead} m</Text>
      )}
      {!hasLatLong && item.address && (
        <Text numberOfLines={2} style={{ fontSize: 9, color: '#888', marginTop: 4, textAlign: 'center', maxWidth: 100 }}>
          {item.address}
        </Text>
      )}
    </View>
  );
})()}
      </View>

      <View style={[styles.commentRow, { borderTopWidth: 0.5, borderTopColor: '#eee', marginTop: 8, paddingTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 2 }}>Comment</Text>
          <Text numberOfLines={2} style={styles.comment}>{item.comment}</Text>
        </View>
        <Text style={styles.seeMore}>See more</Text>
      </View>
    </View>
  );
};

const SurveyerScreen = () => {
  const navigation = useNavigation();
  const isMounted = useRef(true);
  const locationSubscriberRef = useRef(null);
  const heartbeatSubscriberRef = useRef(null);
  const lastSentRef = useRef(0);

  const [isOn, setIsOn] = useState(false);
  const [leads, setLeads] = useState([]);
  const [acceptedLeads, setAcceptedLeads] = useState([]);
  const [inProgressLeads, setInProgressLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectLeadId, setRejectLeadId] = useState(null);
   const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    isMounted.current = true;
    fetchLeads();
    return () => {
      isMounted.current = false;
      locationSubscriberRef.current?.remove();
      heartbeatSubscriberRef.current?.remove();
      BackgroundGeolocation.stop();
    };
  }, []);

  const fetchLeads = async () => {
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
        address: item.address
      }));
      if (isMounted.current) setLeads(mapped);
    } catch (err) {
      console.log('Error fetching leads:', err);
    } finally {
      if (isMounted.current) setLeadsLoading(false);
    }
  };

  const handleAccept = (item) => {
  setLeads((prev) => prev.filter((l) => l.id !== item.id));
  setAcceptedLeads((prev) => {
    // Prevent duplicates
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

  const handleStart = (id) => {
  const lead = acceptedLeads.find((l) => l.id === id);
  if (!lead) return;
  setAcceptedLeads((prev) => prev.filter((l) => l.id !== id));
  setInProgressLeads((prev) => {
    if (prev.some((l) => l.id === id)) return prev;
    return [...prev, lead];
  });
};
const handleManualEnable = (id) => {
  console.log('Manual enable called for id:', id); // ← Add this
  setInProgressLeads((prev) =>
    prev.map((l) => l.id === id ? { ...l, manualSiteEnabled: true } : l)
  );
};

  const handleSiteObservation = (lead) => {
    navigation.navigate('Form', { category: 'site_observation', lead });
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
      mobile: editForm.phone,        // ← This is what backend uses to find the record
      name: editForm.name,
      whatsappNo: editForm.whatsappNo || editForm.phone, // ← Must match mobile or be null
      city: editForm.city,
      comment: editForm.comment,
      address: editForm.address || null,
      email: editForm.email || null,
      referredBy: editForm.referredBy,
      latitude: editForm.latitude || null,
      longitude: editForm.longitude || null,
    };

    console.log('Payload:', JSON.stringify(payload));

    // URL-ல் id தேவையில்லை — backend mobile by தான் find பண்றது
    const res = await API.put('/order/update', payload);

    console.log('Response:', JSON.stringify(res.data));

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
  const getUserPhone = async () => {
    try {
      const data = await AsyncStorage.getItem(USER_DATA);
      if (data) return JSON.parse(data)?.UserInfo?.phoneNo || '';
    } catch (e) {}
    return '';
  };

  const sendLocation = async (latitude, longitude, timestamp) => {
    const now = Date.now();
    if (now - lastSentRef.current < 120000) return;
    lastSentRef.current = now;
    try {
      const phoneNo = await getUserPhone();
      await API.post('/location/add', {
        latitude, longitude, phoneNo,
        epoch: timestamp ? new Date(timestamp).getTime() : Date.now(),
      });
    } catch (err) {
      console.log('Location send error:', err);
    }
  };

  const startBackgroundTracking = () => {
    locationSubscriberRef.current?.remove();
    heartbeatSubscriberRef.current?.remove();

    locationSubscriberRef.current = BackgroundGeolocation.onLocation(async (location) => {
      const { latitude, longitude } = location.coords;
      if (isMounted.current) setCurrentLocation({ latitude, longitude });
      await sendLocation(latitude, longitude, location.timestamp);
    });

    heartbeatSubscriberRef.current = BackgroundGeolocation.onHeartbeat(async () => {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({ samples: 1, persist: false });
        const { latitude, longitude } = location.coords;
        if (isMounted.current) setCurrentLocation({ latitude, longitude });
        await sendLocation(latitude, longitude, location.timestamp);
      } catch (err) { console.log('Heartbeat error:', err); }
    });

    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      interval: 120000,
      fastestInterval: 120000,
      heartbeatInterval: 120,
      stopOnTerminate: false,
      startOnBoot: true,
      debug: false,
    }).then((state) => { if (!state.enabled) BackgroundGeolocation.start(); });
  };

  const stopBackgroundTracking = () => {
    BackgroundGeolocation.stop();
    locationSubscriberRef.current?.remove();
    heartbeatSubscriberRef.current?.remove();
  };

  const handleToggle = async () => {
    if (!isOn) {
      if (Platform.OS === 'android') {
        const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        const bg = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
        if (fine !== PermissionsAndroid.RESULTS.GRANTED || bg !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Required', 'Enable location permission', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]);
          return;
        }
      }
      setIsOn(true);
      startBackgroundTracking();
      fetchLeads();
    } else {
      setIsOn(false);
      stopBackgroundTracking();
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(USER_DATA);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (e) { Alert.alert('Error', 'Failed to logout.'); }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── OFF STATE: Full red gradient with logout + toggle on top ── */}
{!isOn && (
  <LinearGradient colors={['#F00001', '#B00100']} style={{ flex: 1 }}>
    {/* Logout top-left */}
    <TouchableOpacity style={styles.offLogoutBtn} onPress={handleLogout}>
      <Ionicons name="log-out-outline" size={28} color="#fff" />
    </TouchableOpacity>

    {/* Toggle top-right */}
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
      {/* Logo */}
      <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 20 }}>
        <Image
          source={require('../../assets/images/kondass.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Leads or Welcome */}
      {leadsLoading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
      ) : leads.length === 0 ? (
        // No leads → show old welcome screen content
        <View style={styles.offTextContainer}>
          <Text style={styles.welcome}>Welcome!</Text>
          <Text style={styles.message}>
            Let's get started! Turn on availability!
          </Text>
        </View>
      ) : (
        // Has leads → show unaccepted leads list
        <>
          <View style={[styles.sectionHeader, { paddingHorizontal: 15 }]}>
            <View style={[styles.sectionDot, { backgroundColor: '#fff' }]} />
            <Text style={[styles.sectionTitle, { color: '#fff' }]}>
              Leads - Un Accepted
            </Text>
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

      {/* ── ON STATE: White fixed top bar + ScrollView ── */}
      {isOn && (
        <>
          {/* Fixed white top bar */}
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
            {/* ── SECTION 1: Leads Un Accepted ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#ED1C25' }]} />
              <Text style={styles.sectionTitle}>Leads - Un Accepted</Text>
            </View>

            {leadsLoading && (
              <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />
            )}

            {!leadsLoading && leads.length === 0 && (
              <Text style={styles.emptyText}>No leads available right now.</Text>
            )}

            {!leadsLoading && leads.map((item) => (
              <LeadCard
                key={item.id}
                item={item}
                currentLocation={currentLocation}
                cardType="unaccepted"
                onAccept={handleAccept}
                onReject={handleReject}
              />
            ))}

            {/* ── SECTION 2: Leads Accepted ── */}
            {acceptedLeads.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: '#22c55e' }]} />
                  <Text style={styles.sectionTitle}>Leads Accepted</Text>
                </View>
                {acceptedLeads.map((item) => (
                  <LeadCard
                    key={item.id}
                    item={item}
                    currentLocation={currentLocation}
                    cardType="accepted"
                    onStart={handleStart}
                  />
                ))}
              </>
            )}

            {/* ── SECTION 3: Lead Inprogress ── */}
            {inProgressLeads.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: '#f97316' }]} />
                  <Text style={styles.sectionTitle}>Lead Inprogress</Text>
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

      {/* Reject Modal */}
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
            <TouchableOpacity style={styles.modalSaveBtn} onPress={confirmReject}>
              <Text style={styles.modalSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Edit Modal */}
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
              style={[styles.modalInput, { minHeight: key === 'comment' || key === 'address' ? 70 : 44 }]}
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
    </View>
  );
};

export default SurveyerScreen;

const styles = StyleSheet.create({
  // OFF state
  offLogoContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingTop: 80,
  },
  logo: { width: 200, height: 100 },
  offLogoutBtn: {
    position: 'absolute',
    top: 55,
    left: 20,
    zIndex: 10,
  },
  offToggleBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
    elevation: 4,
  },
  offTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message: { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 30 },

  // ON state fixed top bar
  fixedTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

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
  seeMore: { fontSize: 12, color: '#1E88E5' },

  startBtn: { backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  reachBtnWrapper: { alignItems: 'center' },
  reachBtn: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, opacity: 0.85 },
  reachBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  reachDistance: { fontSize: 10, color: '#f97316', marginTop: 3, fontWeight: '600' },

  smallSiteBtn: { backgroundColor: '#ED1C25', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  smallSiteBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', width: '85%', borderRadius: 12, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#222' },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13, color: '#333', textAlignVertical: 'top', minHeight: 90, marginBottom: 16 },
  modalSaveBtn: { backgroundColor: '#ED1C25', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  editBtn: {
  backgroundColor: '#3b82f6',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 5,
  borderRadius: 6,
},
editBtnText: {
  color: '#fff',
  fontSize: 10,
  fontWeight: 'bold',
},
});
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput, Alert, Dimensions,Linking
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { enqueue } from '../service/syncQueue';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLocationTracking, getDistance, stopHighFrequencyTracking } from '../service/locationService';
import API from '../api/api1';

const { width } = Dimensions.get('window');

const LeadCard = ({ item, currentLocation, onSiteObservation, onManualEnable, onEdit, navigation }) => {
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

    onManualEnable(item); // ✅ auto-trigger reached flow
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
        <Text style={styles.referred}>
          Referred by — <Text style={{ fontWeight: 'bold' }}>{item.referredBy || 'N/A'}</Text>
        </Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>

      {/* User info row */}
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={22} color="#aaa" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <TouchableOpacity
  onPress={() => {
    if (item.phone) {
      Linking.openURL(`tel:${item.phone}`);
    }
  }}
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

        {item.status === 'completed' ? (
          <View style={{
            backgroundColor: '#22c55e',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
              ✓ Completed
            </Text>
          </View>

        ) : (item.manualSiteEnabled || (hasLatLong && withinRange)) ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <TouchableOpacity style={styles.smallSiteBtn} onPress={() => onSiteObservation(item)}>
              <Text style={styles.smallSiteBtnText}>Site{'\n'}Observation</Text>
            </TouchableOpacity>

            <TouchableOpacity
  style={[styles.commonBtn, { backgroundColor: '#3b82f6', marginTop: 6 }]}
  onPress={() => onEdit(item)}
>
  <Ionicons name="create-outline" size={20} color="#fff" />
  <Text style={[styles.commonBtnText, { marginLeft: 5 }]}>
    Edit
  </Text>
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

            {/* Map button only before reached */}
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
              <Text style={styles.reachDistance}>{distToLead} m</Text>
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
// InProgressScreen
// ─────────────────────────────────────────────────────────────────────────────
const InProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isMounted = useRef(true);
  const { lead, completedLeadId } = route.params || {};
  const formCompletedRef = useRef(null);

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
  const { currentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

useEffect(() => {
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

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [reachedModalVisible, setReachedModalVisible] = useState(false);
const [selectedLead, setSelectedLead] = useState(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
 const handleManualEnable = async (item) => {
  setInProgressLeads((prev) =>
    prev.map((l) => (l.id === item.id ? { ...l, manualSiteEnabled: true } : l))
  );

  // ✅ Notification - scenarioType: 3
  try {
    await API.post('https://kondaas-api.trisentrix-dev.workers.dev/notification/trigger', {
      customerMobile: item.phone,
      scenarioType: 3,
    });
  } catch (e) {
    console.log('Notification error (reached):', e);
  }

  setSelectedLead({ ...item, id: item.id || item._id });
  setReachedModalVisible(true);
};

 const handleSiteObservation = (item) => {
  const leadToPass = {
    ...item,
    id: item.id || item._id,
  };
  
  console.log('Navigating to Form with lead:', JSON.stringify(leadToPass));

  navigation.navigate('Form', {
    category: 'site_observation',
    lead: leadToPass,
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
      await API.put('/order/update', {
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
      });
      setInProgressLeads((prev) =>
        prev.map((l) => l.id === editLead.id ? { ...l, ...editForm } : l)
      );
      setEditModalVisible(false);
      Alert.alert('Success', 'Lead updated successfully!');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>

      <View style={styles.header}>
  <TouchableOpacity onPress={() => {
  const hasIncomplete = inProgressLeads.some(l => l.status !== 'completed');
  
  if (hasIncomplete) {
    Alert.alert(
      'Warning',
      'Form not submitted yet.\nDo you want to exit without submitting?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Exit', 
          onPress: () => {
            // Form submit ஆகல → status inprogress ஆகவே விடு (backend-ல மாற்ற வேண்டாம்)
            navigation.goBack();
          } 
        },
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

        {/* ── Lead Cards ── */}
        <View style={{ padding: 15, paddingTop: 20 }}>
          {inProgressLeads.map((item) => (
            <LeadCard
              key={item.id}
              item={item}
              currentLocation={currentLocation}
              onSiteObservation={handleSiteObservation}
              onManualEnable={handleManualEnable}
              onEdit={handleEdit}
              navigation={navigation}
            />
          ))}
        </View>
      </ScrollView>

      {/* ── Edit Modal ── */}
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
                    style={[styles.modalInput,
                      { minHeight: key === 'comment' || key === 'address' ? 70 : 44 }]}
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
    <View style={[styles.modalBox, { alignItems: 'center', paddingVertical: 28 }]}>

      {/* Icon */}
      <View style={{
        backgroundColor: '#fef2f2',
        borderRadius: 50,
        padding: 14,
        marginBottom: 14,
      }}>
        <Ionicons name="location" size={32} color="#ED1C25" />
      </View>

      {/* Title */}
      <Text style={{
        fontSize: 17,
        fontWeight: 'bold',
        color: '#222',
        marginBottom: 4,
        textAlign: 'center',
      }}>
        You've Reached the Location!
      </Text>

      {/* Subtitle */}
      <Text style={{
        fontSize: 13,
        color: '#888',
        marginBottom: 24,
        textAlign: 'center',
      }}>
        Do you want to start Site Observation?
      </Text>

      {/* Site Observation Button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#ED1C25',
          width: '100%',
          paddingVertical: 13,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 10,
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

      {/* Cancel Button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#f1f1f1',
          width: '100%',
          paddingVertical: 13,
          borderRadius: 8,
          alignItems: 'center',
        }}
        onPress={() => setReachedModalVisible(false)}
      >
        <Text style={{ color: '#555', fontSize: 14, fontWeight: '600' }}>
          Cancel
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

  // ── Card ──
  card: {
    backgroundColor: '#fff', marginBottom: 12,
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
  commentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12, color: '#1E88E5' },

  // ── Buttons ──
  reachBtnWrapper: { alignItems: 'center' },
  commonBtn: {
  width: 100,              // 👈 same width
  height: 36,              // 👈 same height
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
},

commonBtnText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: 'bold',
},
  reachBtn: {
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
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

  // ── Map ──
  mapContainer: {
    marginHorizontal: 15, marginBottom: 20,
    borderRadius: 16, overflow: 'hidden',
    elevation: 4, backgroundColor: '#fff',
  },
  map: { width: '100%', height: 280 },
  liveBadge: {
    position: 'absolute', top: 10, left: 10, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20, elevation: 5,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22c55e', marginRight: 5,
  },
  liveText: { fontSize: 11, fontWeight: 'bold', color: '#22c55e' },
  surveyorMarker: {
    backgroundColor: '#ED1C25', padding: 8, borderRadius: 50,
    elevation: 5, borderWidth: 2, borderColor: '#fff',
  },
  leadMarker: {
    backgroundColor: '#22c55e', padding: 8, borderRadius: 50,
    elevation: 5, borderWidth: 2, borderColor: '#fff',
  },
  distanceBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  distanceItem: { flex: 1, alignItems: 'center' },
  distanceValue: { fontSize: 13, fontWeight: 'bold', color: '#333', marginTop: 2 },
  distanceLabel: { fontSize: 10, color: '#999', marginTop: 1 },
  distanceDivider: { width: 1, height: 36, backgroundColor: '#eee' },

  // ── No location ──
  noLocationBox: { alignItems: 'center', paddingVertical: 30, marginHorizontal: 15 },
  noLocationText: { color: '#bbb', marginTop: 8, fontSize: 13 },

  // ── Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: { backgroundColor: '#fff', width: '85%', borderRadius: 12, padding: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#222' },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#333', textAlignVertical: 'top',
  },
  modalSaveBtn: { backgroundColor: '#ED1C25', paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  iconBtn: {
  backgroundColor: '#3b82f6',
  padding: 8,
  borderRadius: 50,
  justifyContent: 'center',
  alignItems: 'center',
},
});
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Modal, TextInput, Alert, Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useLocationTracking, getDistance } from '../service/locationService';
import API from '../api/api1';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard
// ─────────────────────────────────────────────────────────────────────────────
const LeadCard = ({ item, currentLocation, onSiteObservation, onManualEnable, onEdit }) => {
  const hasLatLong = item.latitude && item.longitude &&
    item.latitude !== '' && item.longitude !== '';

  const distToLead = currentLocation && hasLatLong
    ? Math.round(getDistance(
        currentLocation.latitude, currentLocation.longitude,
        parseFloat(item.latitude), parseFloat(item.longitude)
      ))
    : null;

  const withinRange = distToLead !== null && distToLead <= 300;

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

      {/* ✅ Right side buttons - ஒரே இடத்தில் மட்டும் */}
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
          <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
            <Ionicons name="create-outline" size={12} color="#fff" style={{ marginRight: 2 }} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.reachBtnWrapper}>
          <TouchableOpacity style={styles.reachBtn} onPress={() => onManualEnable(item.id)}>
            <Ionicons name="navigate-outline" size={14} color="#fff" style={{ marginRight: 3 }} />
            <Text style={styles.reachBtnText}>Reached</Text>
          </TouchableOpacity>
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
      <Text style={styles.seeMore}>See more</Text>
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

  const [inProgressLeads, setInProgressLeads] = useState(lead ? [lead] : []);
  const { currentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

useEffect(() => {
  startTracking(); 
  return () => {
    isMounted.current = false;
    stopTracking();
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
    navigation.goBack();

  }, [route.params?.completedLeadId])
);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
  if (inProgressLeads.length > 0) {
    const allCompleted = inProgressLeads.every(l => l.status === 'completed');
    if (allCompleted) {
      const timer = setTimeout(() => {
        navigation.goBack();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }
}, [inProgressLeads]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleManualEnable = (id) => {
    setInProgressLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, manualSiteEnabled: true } : l))
    );
  };

 const handleSiteObservation = (item) => {
  navigation.navigate('Form', {
    category: 'site_observation',
    lead: item,
  });
  
  const unsubscribe = navigation.addListener('focus', () => {
    unsubscribe();
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
        'Task is not completed yet. Do you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Go Back', onPress: () => navigation.goBack() },
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
            />
          ))}
        </View>

        {/* ── Live Tracking Map ── */}
        {currentLocation ? (
          <View style={styles.mapContainer}>

            {/* LIVE badge */}
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>

            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              region={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
            >
              {/* Surveyor marker (moving) */}
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="You are here"
              >
                <View style={styles.surveyorMarker}>
                  <Ionicons name="navigate" size={20} color="#fff" />
                </View>
              </Marker>

              {/* Lead location markers + polyline */}
              {inProgressLeads.map((l) => {
                if (!l.latitude || !l.longitude) return null;
                const leadCoord = {
                  latitude: parseFloat(l.latitude),
                  longitude: parseFloat(l.longitude),
                };
                return (
                  <React.Fragment key={l.id}>
                    <Marker
                      coordinate={leadCoord}
                      title={l.name}
                      description={l.address || l.city}
                    >
                      <View style={styles.leadMarker}>
                        <Ionicons name="home" size={16} color="#fff" />
                      </View>
                    </Marker>

                    {/* Dashed line surveyor → lead */}
                    <Polyline
                      coordinates={[
                        {
                          latitude: currentLocation.latitude,
                          longitude: currentLocation.longitude,
                        },
                        leadCoord,
                      ]}
                      strokeColor="#ED1C25"
                      strokeWidth={3}
                      lineDashPattern={[8, 4]}
                    />
                  </React.Fragment>
                );
              })}
            </MapView>

            {/* Distance info bar */}
            {inProgressLeads.map((l) => {
              if (!l.latitude || !l.longitude) return null;
              const dist = Math.round(
                getDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  parseFloat(l.latitude),
                  parseFloat(l.longitude)
                )
              );
              return (
                <View key={l.id} style={styles.distanceBar}>
                  <View style={styles.distanceItem}>
                    <Ionicons name="navigate-outline" size={16} color="#ED1C25" />
                    <Text style={styles.distanceValue}>
                      {dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`}
                    </Text>
                    <Text style={styles.distanceLabel}>Distance</Text>
                  </View>
                  <View style={styles.distanceDivider} />
                  <View style={styles.distanceItem}>
                    <Ionicons name="person-outline" size={16} color="#22c55e" />
                    <Text style={styles.distanceValue}>{l.name}</Text>
                    <Text style={styles.distanceLabel}>Lead</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.noLocationBox}>
            <Ionicons name="location-outline" size={32} color="#ccc" />
            <Text style={styles.noLocationText}>Waiting for location...</Text>
          </View>
        )}
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
});
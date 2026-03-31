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
} from 'react-native';
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

const SurveyerScreen = () => {
  const navigation = useNavigation();

  const isMounted = useRef(true);
  const locationSubscriberRef = useRef(null);
  const heartbeatSubscriberRef = useRef(null); // ✅ NEW
  const lastSentRef = useRef(0);

  const [isOn, setIsOn] = useState(false);
  const [leads, setLeads] = useState([]);
  const [acceptedLeads, setAcceptedLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  const acceptedLeadsRef = useRef([]);
  useEffect(() => {
    acceptedLeadsRef.current = acceptedLeads;
  }, [acceptedLeads]);

  const isAnyLeadAccepted = acceptedLeads.length > 0;

  const isWithin300m = () => {
    if (!currentLocation || !acceptedLeads[0]) return false;
    const { latitude: uLat, longitude: uLon } = currentLocation;
    const { latitude: lLat, longitude: lLon } = acceptedLeads[0];
    if (!lLat || !lLon) return false;
    const dist = getDistance(uLat, uLon, lLat, lLon);
    return dist <= 300;
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      locationSubscriberRef.current?.remove();
      heartbeatSubscriberRef.current?.remove(); // ✅ NEW
      locationSubscriberRef.current = null;
      heartbeatSubscriberRef.current = null;
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
      }));

      if (isMounted.current) {
        setLeads((prev) => {
          const newLeads = mapped.filter(
            (l) =>
              !acceptedLeadsRef.current.some((a) => a.id === l.id) &&
              !prev.some((p) => p.id === l.id)
          );
          return [...prev, ...newLeads];
        });
      }
    } catch (err) {
      console.log('Error fetching leads:', err);
    } finally {
      if (isMounted.current) setLeadsLoading(false);
    }
  };

  const handleAccept = (item) => {
    setAcceptedLeads([item]);
    acceptedLeadsRef.current = [item];
    setLeads((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, isAccepted: true } : l))
    );
  };

  const handleReject = (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  const getUserPhone = async () => {
    try {
      const data = await AsyncStorage.getItem(USER_DATA);
      if (data) return JSON.parse(data)?.UserInfo?.phoneNo || '';
    } catch (e) {}
    return '';
  };

  // ✅ Shared send function — 2 min check centralized
  const sendLocation = async (latitude, longitude) => {
    const now = Date.now();
    if (now - lastSentRef.current < 120000) return; // 2 minutes
    lastSentRef.current = now;

    try {
      const phoneNo = await getUserPhone();
      await API.post('/location/add', {
        latitude,
        longitude,
        phoneNo,
        timestamp: new Date().toISOString(), // ✅ Mobile time
      });
      console.log('✅ Location sent:', latitude, longitude);
    } catch (err) {
      console.log('❌ Location send error:', err);
    }
  };

  const startBackgroundTracking = () => {
    // ✅ Remove old listeners first
    locationSubscriberRef.current?.remove();
    heartbeatSubscriberRef.current?.remove();
    locationSubscriberRef.current = null;
    heartbeatSubscriberRef.current = null;

    // ✅ onLocation — surveyor நடந்தா trigger ஆகும்
    locationSubscriberRef.current = BackgroundGeolocation.onLocation(
      async (location) => {
        const { latitude, longitude } = location.coords;

        if (isMounted.current) {
          setCurrentLocation({ latitude, longitude });
        }

        await sendLocation(latitude, longitude);
      }
    );

    // ✅ onHeartbeat — stationary ஆ இருந்தாலும் 2 min-ku trigger ஆகும்
    heartbeatSubscriberRef.current = BackgroundGeolocation.onHeartbeat(async () => {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          samples: 1,
          persist: false,
        });
        const { latitude, longitude } = location.coords;

        if (isMounted.current) {
          setCurrentLocation({ latitude, longitude });
        }

        await sendLocation(latitude, longitude);
      } catch (err) {
        console.log('Heartbeat position error:', err);
      }
    });

    // ✅ BGGeo config
    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,
      interval: 120000,        // 2 min
      fastestInterval: 120000, // 2 min
      heartbeatInterval: 120,  // 120 sec = 2 min
      stopOnTerminate: false,
      startOnBoot: true,
      debug: false,
    }).then((state) => {
      if (!state.enabled) BackgroundGeolocation.start();
    });
  };

  const stopBackgroundTracking = () => {
    BackgroundGeolocation.stop();
    locationSubscriberRef.current?.remove();
    heartbeatSubscriberRef.current?.remove(); // ✅ NEW
    locationSubscriberRef.current = null;
    heartbeatSubscriberRef.current = null;
  };

  const handleToggle = async () => {
    if (!isOn) {
      if (Platform.OS === 'android') {
        const fine = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const bg = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
        );
        if (
          fine !== PermissionsAndroid.RESULTS.GRANTED ||
          bg !== PermissionsAndroid.RESULTS.GRANTED
        ) {
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
          } catch (e) {
            Alert.alert('Error', 'Failed to logout.');
          }
        },
      },
    ]);
  };

  const siteButtonEnabled = isWithin300m();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={28} color="#ED1C25" />
      </TouchableOpacity>

      <View style={styles.toggleContainer}>
        <Switch
          trackColor={{ false: '#ccc', true: 'red' }}
          thumbColor="#fff"
          value={isOn}
          onValueChange={handleToggle}
        />
      </View>

      {/* ── OFF STATE ── */}
      {!isOn && (
        <>
          <LinearGradient colors={['#F00001', '#B00100']} style={styles.header}>
            <Image
              source={require('../../assets/images/kondass.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </LinearGradient>
          <View style={styles.offContainer}>
            <Text style={styles.welcome}>Welcome!</Text>
            <Text style={styles.message}>Let's get started! Turn on availability!</Text>
          </View>
        </>
      )}

      {/* ── ON STATE ── */}
      {isOn && (
        <View style={styles.onContainer}>

          {/* Accepted lead card */}
          {isAnyLeadAccepted ? (
            <View style={{ flex: 1, width: '100%', padding: 15 }}>
              <Text style={styles.headerTitle}>Accepted Lead</Text>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.referred}>
                    Referred by — {acceptedLeads[0].referredBy || 'N/A'}
                  </Text>
                  <Text style={styles.date}>{acceptedLeads[0].date}</Text>
                </View>
                <View style={styles.userRow}>
                  <View style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{acceptedLeads[0].name}</Text>
                    <Text style={styles.subText}>{acceptedLeads[0].phone}</Text>
                    <Text style={styles.subText}>{acceptedLeads[0].city}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={36} color="#22c55e" />
                </View>
                <View style={styles.commentRow}>
                  <Text numberOfLines={2} style={styles.comment}>
                    {acceptedLeads[0].comment}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.siteButton,
                    { backgroundColor: siteButtonEnabled ? '#ED1C25' : '#aaa', marginTop: 10 },
                  ]}
                  disabled={!siteButtonEnabled}
                  onPress={() => {
                    // navigation.navigate('SiteObservation', { lead: acceptedLeads[0] });
                  }}
                >
                  <Text style={styles.siteButtonText}>
                    {siteButtonEnabled ? 'Site Observation' : 'Site Observation (Go to site)'}
                  </Text>
                </TouchableOpacity>

                {!siteButtonEnabled && currentLocation && acceptedLeads[0]?.latitude && (
                  <Text style={styles.distanceHint}>
                    📍{' '}
                    {Math.round(
                      getDistance(
                        currentLocation.latitude,
                        currentLocation.longitude,
                        acceptedLeads[0].latitude,
                        acceptedLeads[0].longitude
                      )
                    )}{' '}
                    m away — reach within 300m to enable
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1, width: '100%', backgroundColor: '#F5F5F5' }}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              <Text style={styles.headerTitle}>Leads - Un Accepted</Text>

              {leadsLoading && (
                <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />
              )}

              {!leadsLoading && leads.length === 0 && (
                <Text style={styles.emptyText}>No leads available right now.</Text>
              )}

              {!leadsLoading &&
                leads.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.referred}>
                        Referred by — {item.referredBy || 'N/A'}
                      </Text>
                      <Text style={styles.date}>{item.date}</Text>
                    </View>
                    <View style={styles.userRow}>
                      <View style={styles.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.subText}>{item.phone}</Text>
                        <Text style={styles.subText}>{item.city}</Text>
                      </View>
                      {item.isAccepted ? (
                        <TouchableOpacity style={styles.smallSiteBtn}>
                          <Text style={styles.smallSiteBtnText}>Site Observation</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.iconContainer}>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => handleAccept(item)}>
                            <Ionicons name="checkmark-circle" size={36} color="#22c55e" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => handleReject(item.id)}>
                            <Ionicons name="close-circle" size={36} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                    <View style={styles.commentRow}>
                      <Text numberOfLines={2} style={styles.comment}>
                        {item.comment}
                      </Text>
                      <Text style={styles.seeMore}>See more</Text>
                    </View>
                  </View>
                ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

export default SurveyerScreen;

const styles = StyleSheet.create({
  header: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: { width: 200, height: 100 },
  toggleContainer: {
    position: 'absolute', top: 60, right: 20, zIndex: 10,
  },
  logoutButton: {
    position: 'absolute', top: 60, left: 20, zIndex: 10,
  },
  offContainer: {
    flex: 1, backgroundColor: '#E0E0E0',
    justifyContent: 'center', alignItems: 'center',
  },
  welcome: { fontSize: 20, fontWeight: 'bold', color: '#666' },
  message: { marginTop: 10, color: '#E53935' },
  onContainer: {
    flex: 1, alignItems: 'center', paddingTop: 110,
  },
  siteButton: {
    marginBottom: 6, padding: 15,
    borderRadius: 8, width: '100%',
    alignItems: 'center',
  },
  siteButtonText: {
    color: '#fff', fontSize: 16,
    textAlign: 'center', fontWeight: 'bold',
  },
  distanceHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', margin: 15 },
  emptyText: {
    textAlign: 'center', marginTop: 40,
    color: '#999', fontSize: 14, paddingHorizontal: 30,
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 15,
    marginBottom: 15, borderRadius: 10, padding: 12, elevation: 3,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  referred: { fontSize: 12, color: '#E53935' },
  date: { fontSize: 12, color: '#888' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#ccc', marginRight: 10,
  },
  name: { fontSize: 16, fontWeight: 'bold' },
  subText: { fontSize: 12, color: '#555' },
  iconContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn: { padding: 4 },
  commentRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },
  comment: { flex: 1, fontSize: 12, color: '#555' },
  seeMore: { fontSize: 12, color: '#1E88E5' },
  smallSiteBtn: {
    backgroundColor: '#ED1C25',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  smallSiteBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
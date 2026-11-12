import { useRef, useState } from 'react';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { PermissionsAndroid, Platform, Alert, Linking, DeviceEventEmitter, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';

export const getDistance = (lat1, lon1, lat2, lon2) => {
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

// 👇 புதுசா சேர்த்தது: Road distance (OSRM) — DISPLAY purpose மட்டும் இதை use பண்ணணும்.
// Proximity check (300m auto "Reached" trigger) க்கு இதை use பண்ணக்கூடாது —
// அதுக்கு மேலே இருக்குற getDistance (Haversine) தான் fast + offline-safe + accurate போதும்.
// Return: km (number) success ஆனா, network/route fail ஆனா null.
export const getRoadDistanceKm = async (originLat, originLon, destLat, destLon) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes?.length > 0) {
      return data.routes[0].distance / 1000; // meters -> km
    }
    console.log('⚠️ OSRM no route found');
    return null;
  } catch (e) {
    console.log('❌ OSRM error:', e.message);
    return null;
  }
};

export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    return data ? JSON.parse(data)?.UserInfo?.phoneNo || '' : '';
  } catch (e) {
    return '';
  }
};

const isMockLocation = (lat, lon) => {
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return true;
  return false;
};

const INTERVAL_NORMAL = 30 * 60 * 1000; // duty ON
const INTERVAL_ACTIVE = 3 * 60 * 1000;  // Start click
const TOLERANCE_MS    = 5000;

let currentIntervalMs = INTERVAL_NORMAL;
let inFlight = false;
const lastSentTime = { current: 0 };

export const setLocationShareMode = (mode, getLocationFn) => {
  if (mode === 'active') {
    currentIntervalMs = INTERVAL_ACTIVE;
    lastSentTime.current = 0; // udane oru thadava anuppa
    const loc = getLocationFn?.();
    if (loc?.latitude && loc?.longitude) {
      sendLocation(loc.latitude, loc.longitude, Date.now());
    }
  } else {
    currentIntervalMs = INTERVAL_NORMAL;
  }
};

export const sendLocation = async (latitude, longitude, timestamp) => {
  if (isMockLocation(latitude, longitude)) return;
  if (inFlight) return;
  const now = Date.now();
  if (now - lastSentTime.current < currentIntervalMs - TOLERANCE_MS) return;

  inFlight = true;
  const finalEpoch = timestamp || Date.now();
  try {
    await AsyncStorage.setItem(
      'last_known_location',
      JSON.stringify({ latitude, longitude })
    );
    const phoneNo = await getUserPhone();
    const res = await API.post('/location/add', {
      phoneNo,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      epoch: finalEpoch,
    });
    lastSentTime.current = now; // success aana piragu mattum
    console.log('✅ Location saved:', res.status);
  } catch (err) {
    console.log('❌ Send error:', err?.response?.data || err.message);
  } finally {
    inFlight = false;
  }
};

export const requestLocationPermissions = async () => {
  if (Platform.OS === 'android') {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'This app needs location access to track your position.',
        buttonPositive: 'Allow',
      }
    );
    if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
      console.log('❌ Fine location denied');
      return false;
    }
    if (Platform.Version >= 29) {
      const bg = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location',
          message: 'Allow location access all the time for background tracking.',
          buttonPositive: 'Allow',
        }
      );
      console.log('🔐 Background location result:', bg);
    }
    return true;
  } else if (Platform.OS === 'ios') {
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📍 iOS whenInUse permission:', whenInUse);
    if (whenInUse !== RESULTS.GRANTED) {
      console.log('❌ iOS whenInUse denied');
      return false;
    }
    const always = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    console.log('📍 iOS always permission:', always);
    return true;
  }
  return true;
};

export const requestIOSLocationPermission = requestLocationPermissions;

export const requestBatteryOptimizationExemption = () => {
  if (Platform.OS !== 'android') return;
  Alert.alert(
    'Background Location',
    'Please turn off Battery Optimization for location tracking to work properly.',
    [
      { text: 'Go to Settings', onPress: () => Linking.openSettings() },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
};

export const useLocationTracking = (isMounted) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const watchIdRef = useRef(null);
  const isTrackingRef = useRef(false);
  const listenerRef = useRef(null);

  const startTracking = () => {
    if (isTrackingRef.current) {
      console.log('⚠️ Already tracking, skip');
      return;
    }
    isTrackingRef.current = true;
            // normal mode-la mattum udane first send. Active mode (lead In-Progress) la reset pannaadhinga.
    if (currentIntervalMs === INTERVAL_NORMAL) {
      lastSentTime.current = 0;
    }
    console.log('🟢 Starting location tracking');

    // ── Common: get the right native module for the platform ──
    const { LocationService } = NativeModules;

    console.log(`📱 [${Platform.OS}] LocationService exists?`, !!LocationService);

    if (!LocationService) {
      console.log(`❌ [${Platform.OS}] LocationService native module not found!`);
      isTrackingRef.current = false;
      return;
    }

    // ── Common: set up the event emitter for the platform ──
    const emitter =
      Platform.OS === 'android'
        ? DeviceEventEmitter
        : new NativeEventEmitter(LocationService);

    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }

    listenerRef.current = emitter.addListener(
      'nativeLocationUpdate',
      async (data) => {
        console.log(`🔔 [${Platform.OS}] Native location received:`, data);
        if (data?.latitude && data?.longitude) {
          if (isMounted.current) {
            setCurrentLocation({
              latitude: data.latitude,
              longitude: data.longitude,
            });
          }
          await sendLocation(data.latitude, data.longitude, data.timestamp);
        }
      }
    );
    console.log(`✅ [${Platform.OS}] Listener added successfully`);

    // ── Common: explicitly start native tracking on BOTH platforms ──
    setTimeout(() => {
      LocationService.startTracking();
      console.log(`✅ [${Platform.OS}] startTracking called`);
      watchIdRef.current = 1;
    }, 500);
  };

  const stopTracking = (keepNative = false) => {
    console.log('🔴 Stopping location tracking');
    isTrackingRef.current = false;

    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }

    const { LocationService } = NativeModules;
    if (!keepNative && watchIdRef.current !== null && LocationService) {
      LocationService.stopTracking();
      watchIdRef.current = null;
    }
  };

  return { currentLocation, setCurrentLocation, startTracking, stopTracking };
};
// ✅ Idha podunga
export const isGPSEnabled = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const enabled = await NativeModules.LocationManager?.isLocationEnabled();
    console.log('🔍 GPS enabled:', enabled);
    if (typeof enabled !== 'boolean') return null; // unknown
    return enabled;
  } catch (e) {
    console.log('🔍 GPS check error:', e);
    return null; // unknown
  }
};

export const checkAndPromptGPS = async () => {
  return true;
};

export const startHighFrequencyTracking = (getLocationFn) => {
  setLocationShareMode('active', getLocationFn);
  console.log('⚡ Active mode: location every 3 min');
};

export const stopHighFrequencyTracking = () => {
  setLocationShareMode('normal');
  console.log('🛑 Normal mode: location every 30 min');
};
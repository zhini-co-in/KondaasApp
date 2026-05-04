import { useRef, useState } from 'react';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { PermissionsAndroid, Platform, Alert, Linking, DeviceEventEmitter, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';

export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
};

export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    return data ? JSON.parse(data)?.UserInfo?.phoneNo || '' : '';
  } catch (e) { return ''; }
};

const isMockLocation = (lat, lon) => {
  if (Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01) return true;
  return false;
};

const lastSentTime = { current: 0 };
let lastSentCoords = { lat: null, lon: null }; // ✅ ADD THIS

export const sendLocation = async (latitude, longitude, timestamp) => {
  if (isMockLocation(latitude, longitude)) return;
  const now = Date.now();
  if (now - lastSentTime.current < 110000) return;
  lastSentTime.current = now;
  const finalEpoch = timestamp || Date.now();
  try {
    const phoneNo = await getUserPhone();
    console.log(`📞 phoneNo being sent: "${phoneNo}"`);
    console.log(`📍 [${Platform.OS}] SENDING → ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    const res = await API.post('/location/add', {
  phoneNo,
  latitude: parseFloat(latitude),
  longitude: parseFloat(longitude),
  epoch: finalEpoch,
});
console.log('✅ Location saved:', res.status);
  } catch (err) {
    console.log('❌ Send error:', err?.response?.data || err.message);
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
    if (whenInUse !== RESULTS.GRANTED) return false;
    await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
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

// ✅ Module level-la வை (hook outside)
let globalListenerRef = null; // single global ref

export const useLocationTracking = (isMounted) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const watchIdRef = useRef(null);
  const isTrackingRef = useRef(false); // ✅ tracking guard

  const startTracking = () => {
    if (isTrackingRef.current) {
      console.log('⚠️ Already tracking, skip');
      return;
    }
    isTrackingRef.current = true;
    console.log('🟢 Starting location tracking');

    if (Platform.OS === 'android') {
      // ✅ Global listener clean பண்ணு first
      if (globalListenerRef) {
        globalListenerRef.remove();
        globalListenerRef = null;
      }

      globalListenerRef = DeviceEventEmitter.addListener(
        'nativeLocationUpdate',
        async (data) => {
          console.log('🔔 Native service triggered:', data);
          if (data?.latitude && data?.longitude) {
            if (isMounted.current) {
              setCurrentLocation({ latitude: data.latitude, longitude: data.longitude });
            }
            await sendLocation(data.latitude, data.longitude, data.timestamp);
          }
        }
      );
    } else if (Platform.OS === 'ios') {
      if (watchIdRef.current !== null) return; // ✅ iOS guard
      watchIdRef.current = global.navigator?.geolocation?.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          if (isMounted.current) setCurrentLocation({ latitude, longitude });
          await sendLocation(latitude, longitude, position.timestamp);
        },
        (error) => console.log('iOS watch error:', error),
        { enableHighAccuracy: true, distanceFilter: 10, interval: 120000 }
      );
    }
  };

  const stopTracking = () => {
    console.log('🔴 Stopping location tracking');
    isTrackingRef.current = false; // ✅ Reset guard

    if (Platform.OS === 'ios' && watchIdRef.current !== null) {
      global.navigator?.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (globalListenerRef) {
      globalListenerRef.remove();
      globalListenerRef = null;
    }
  };

  return { currentLocation, startTracking, stopTracking };
};

export const isGPSEnabled = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const enabled = await NativeModules.LocationManager?.isLocationEnabled();
    console.log('🔍 GPS enabled:', enabled);
    return enabled ?? false;
  } catch (e) {
    console.log('🔍 GPS check error:', e);
    return false;
  }
};

export const checkAndPromptGPS = async () => {
  return true;
};
let intervalTracker = null;
let lastSentHFCoords = { lat: null, lon: null };
let lastCheckCoords = { lat: null, lon: null };

export const startHighFrequencyTracking = (getLocationFn) => {
  if (intervalTracker) {
    clearInterval(intervalTracker);
  }

  intervalTracker = setInterval(async () => {
    const loc = getLocationFn();
    if (!loc?.latitude || !loc?.longitude) return;

    // ✅ முந்தைய check-இல் இருந்து எவ்வளவு நகர்ந்தோம்
    let movedSinceLastCheck = 0;
    if (lastCheckCoords.lat !== null) {
      movedSinceLastCheck = getDistance(
        lastCheckCoords.lat, lastCheckCoords.lon,
        loc.latitude, loc.longitude
      );
    }
    lastCheckCoords = { lat: loc.latitude, lon: loc.longitude };

    // ✅ நிற்கும்போது — 2 மீட்டர்க்கு கீழே இருந்தால் skip
    if (lastSentHFCoords.lat !== null && movedSinceLastCheck < 2) {
      console.log('🧍 Stationary, skipping...');
      return;
    }

    // ✅ நகரும்போது — last sent-இல் இருந்து 10 மீட்டர் மேல் இருந்தால் மட்டும் send
    if (lastSentHFCoords.lat !== null) {
      const movedSinceLastSent = getDistance(
        lastSentHFCoords.lat, lastSentHFCoords.lon,
        loc.latitude, loc.longitude
      );
      if (movedSinceLastSent < 10) return;
    }

    lastSentHFCoords = { lat: loc.latitude, lon: loc.longitude };

    try {
      const phoneNo = await getUserPhone();
      await API.post('/location/add', {
        phoneNo,
        latitude: parseFloat(loc.latitude),
        longitude: parseFloat(loc.longitude),
        epoch: Date.now(),
      });
      console.log('⚡ Location sent:', loc.latitude, loc.longitude);
    } catch (err) {
      console.log('❌ HF send error:', err?.message);
    }
  }, 3000); // ✅ 3 seconds check
};

export const stopHighFrequencyTracking = () => {
  if (intervalTracker) {
    clearInterval(intervalTracker);
    intervalTracker = null;
    lastSentHFCoords = { lat: null, lon: null };
    lastCheckCoords = { lat: null, lon: null };
    console.log('🛑 High-freq tracking stopped');
  }
};
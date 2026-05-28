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

const lastSentTime = { current: 0 };

export const sendLocation = async (latitude, longitude, timestamp) => {
  if (isMockLocation(latitude, longitude)) return;
  const now = Date.now();
 if (now - lastSentTime.current < 180000) return;
  lastSentTime.current = now;
  const finalEpoch = timestamp || Date.now();
  await AsyncStorage.setItem(
    'last_known_location',
    JSON.stringify({ latitude, longitude })
  );
  try {
    const phoneNo = await getUserPhone();
    console.log(`📞 phoneNo being sent: "${phoneNo}"`);
    console.log(
      `📍 [${Platform.OS}] SENDING → ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    );
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
    console.log('🟢 Starting location tracking');

    if (Platform.OS === 'android') {
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }

      listenerRef.current = DeviceEventEmitter.addListener(
        'nativeLocationUpdate',
        async (data) => {
          console.log('🔔 Native service triggered:', data);
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

} else if (Platform.OS === 'ios') {
  if (watchIdRef.current !== null) return;

  const { LocationService } = NativeModules;

  // ✅ Debug
  console.log('📱 LocationService exists?', !!LocationService);
  console.log('📱 LocationService value:', LocationService);

  if (!LocationService) {
    console.log('❌ LocationService not found!');
    return;
  }

  const emitter = new NativeEventEmitter(LocationService);

  if (listenerRef.current) {
    listenerRef.current.remove();
    listenerRef.current = null;
  }

  listenerRef.current = emitter.addListener(
    'nativeLocationUpdate',
    async (data) => {
      console.log('🔔 iOS Native location received:', data);
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
  console.log('✅ Listener added successfully');

 setTimeout(() => {
    LocationService.startTracking();
    console.log('✅ iOS startTracking called');
    watchIdRef.current = 1;
  }, 500);
}
  };

  const stopTracking = () => {
    console.log('🔴 Stopping location tracking');
    isTrackingRef.current = false;

    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }

  if (Platform.OS === 'ios' && watchIdRef.current !== null) {
  const { LocationService } = NativeModules;
  if (LocationService) {
    LocationService.stopTracking(); // ✅ stopService இல்ல!
  }
  watchIdRef.current = null;
}

    if (Platform.OS === 'android' && watchIdRef.current !== null) {
      global.navigator?.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  return { currentLocation, setCurrentLocation, startTracking, stopTracking };
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

// High Frequency Tracking
let intervalTracker = null;
let lastSentHFCoords = { lat: null, lon: null };

export const startHighFrequencyTracking = (getLocationFn) => {
  if (intervalTracker) {
    clearInterval(intervalTracker);
    intervalTracker = null;
  }

  intervalTracker = setInterval(async () => {
    const loc = getLocationFn();
    if (!loc?.latitude || !loc?.longitude) return;

    if (lastSentHFCoords.lat !== null) {
      const moved = getDistance(
        lastSentHFCoords.lat,
        lastSentHFCoords.lon,
        loc.latitude,
        loc.longitude
      );
      if (moved < 5) {
        console.log('🧍 Stationary, skipping HF send');
        return;
      }
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
      console.log('⚡ HF location sent:', loc.latitude, loc.longitude);
    } catch (err) {
      console.log('❌ HF send error:', err?.message);
    }
  }, 60000);
};

export const stopHighFrequencyTracking = () => {
  if (intervalTracker) {
    clearInterval(intervalTracker);
    intervalTracker = null;
    lastSentHFCoords = { lat: null, lon: null };
    console.log('🛑 High-freq tracking stopped');
  }
};
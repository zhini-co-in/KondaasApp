// locationService.js — COMMON FOR ANDROID + iOS (Stable)

import { useRef, useState } from 'react';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
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

// Send Location (Common)
export const sendLocation = async (latitude, longitude, timestamp, lastSentRef) => {
  if (isMockLocation(latitude, longitude)) return;

  const now = Date.now();
  if (now - lastSentRef.current < 110000) return;   // ~2 நிமிடம்

  lastSentRef.current = now;

  const finalEpoch = timestamp && !isNaN(Number(timestamp)) ? Number(timestamp) : Date.now();

  try {
    const phoneNo = await getUserPhone();
    console.log(`📍 [${Platform.OS}] SENDING → ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

    await API.post('/location/add', {
      phoneNo,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      epoch: finalEpoch,
    });
  } catch (err) {
    console.log('❌ Send error:', err?.response?.data || err.message);
  }
};

// Common Permission Request
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

    if (fine !== PermissionsAndroid.RESULTS.GRANTED) return false;

    if (Platform.Version >= 29) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
    }
    return true;
  } 
  else if (Platform.OS === 'ios') {
    // iOS - When In Use + Always
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (whenInUse !== RESULTS.GRANTED) return false;

    const always = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (always !== RESULTS.GRANTED) {
      console.log('iOS Always permission not granted - continuing with When In Use');
    }
    return true;
  }
  return true;
};

// Main Tracking (Common for iOS + Android)
export const startBackgroundTracking = ({
  locationSubscriberRef,
  heartbeatSubscriberRef,
  lastSentRef,
  isMounted,
  onLocationUpdate,
  intervalRef,
}) => {
  locationSubscriberRef.current?.remove();
  heartbeatSubscriberRef.current?.remove();
  clearInterval(intervalRef?.current);

  BackgroundGeolocation.ready({
  desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
  distanceFilter: 10,
  
  // ✅ App terminated ஆனாலும் work ஆக
  stopOnTerminate: false,   // already இருக்கு ✓
  startOnBoot: true,        // already இருக்கு ✓
  
  // ✅ Heartbeat = 2 minutes (120 seconds)
  heartbeatInterval: 120,   // 180 → 120 மாத்துங்க
  
  // Android specific
  interval: 120000,
  fastestInterval: 60000,
  
  // ✅ iOS kill ஆனாலும் wake up ஆக
  preventSuspend: true,     // already இருக்கு ✓
  pausesLocationUpdatesAutomatically: false, // already இருக்கு ✓
  enableHeadless: true,     // ⬅️ இது MISSING — add பண்ணுங்க
  
  locationAuthorizationRequest: 'Always',
  debug: false,             // production-ல் false வையுங்க
}).then(async (state) => {
    console.log(`✅ BackgroundGeolocation ready on ${Platform.OS}`);

    locationSubscriberRef.current = BackgroundGeolocation.onLocation(async (location) => {
      const { latitude, longitude } = location.coords;
      const timestamp = location.timestamp || Date.now();

      if (isMounted.current) onLocationUpdate({ latitude, longitude });
      await sendLocation(latitude, longitude, timestamp, lastSentRef);
    });

    const forceSend = async () => {
      try {
        const loc = await BackgroundGeolocation.getCurrentPosition({
          samples: 2,
          timeout: 60,
          maximumAge: 300000,
        });
        const { latitude, longitude } = loc.coords;
        const timestamp = loc.timestamp || Date.now();

        if (isMounted.current) onLocationUpdate({ latitude, longitude });
        await sendLocation(latitude, longitude, timestamp, lastSentRef);
      } catch (e) {
        console.log('Force send error:', e);
      }
    };

    heartbeatSubscriberRef.current = BackgroundGeolocation.onHeartbeat(forceSend);
    intervalRef.current = setInterval(forceSend, 120000);   // 2 நிமிடத்துக்கு ஒரு முறை

    if (!state.enabled) await BackgroundGeolocation.start();
  }).catch((err) => {
    console.log(`❌ BackgroundGeolocation failed on ${Platform.OS}:`, err);
  });
};

export const stopBackgroundTracking = (locationSubscriberRef, heartbeatSubscriberRef) => {
  BackgroundGeolocation.stop();
  locationSubscriberRef.current?.remove();
  heartbeatSubscriberRef.current?.remove();
};

export const useLocationTracking = (isMounted) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const locationSubscriberRef = useRef(null);
  const heartbeatSubscriberRef = useRef(null);
  const lastSentRef = useRef(0);
  const intervalRef = useRef(null);

  const startTracking = () => {
    startBackgroundTracking({
      locationSubscriberRef,
      heartbeatSubscriberRef,
      lastSentRef,
      isMounted,
      onLocationUpdate: setCurrentLocation,
      intervalRef,
    });
  };

  const stopTracking = () => {
    clearInterval(intervalRef.current);
    stopBackgroundTracking(locationSubscriberRef, heartbeatSubscriberRef);
  };

  return { currentLocation, startTracking, stopTracking };
};
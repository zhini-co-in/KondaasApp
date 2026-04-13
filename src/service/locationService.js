// locationService.js
// Location-related logic extracted from SurveyerScreen

import { useRef, useState } from 'react';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';

// ─────────────────────────────────────────────
// 1. Pure utility: Haversine distance (metres)
// ─────────────────────────────────────────────
/**
 * Returns the distance in **metres** between two GPS coordinates.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in metres
 */
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

// ─────────────────────────────────────────────
// 2. Get user phone from AsyncStorage
// ─────────────────────────────────────────────
/**
 * Reads the logged-in user's phone number from AsyncStorage.
 * @returns {Promise<string>}
 */
export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    if (data) return JSON.parse(data)?.UserInfo?.phoneNo || '';
  } catch (e) {}
  return '';
};

// ─────────────────────────────────────────────
// 3. Send location to backend (throttled: 2 min)
// ─────────────────────────────────────────────
/**
 * Sends the current GPS coordinates to the backend.
 * Throttled to once every 2 minutes using the lastSentRef.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string|number} timestamp
 * @param {React.MutableRefObject<number>} lastSentRef - ref to track last send time
 */
export const sendLocation = async (latitude, longitude, timestamp, lastSentRef) => {
  const now = Date.now();
  if (now - lastSentRef.current < 120000) return;
  lastSentRef.current = now;
  try {
    const phoneNo = await getUserPhone();
    await API.post('/location/add', {
      latitude,
      longitude,
      phoneNo,
      epoch: timestamp ? new Date(timestamp).getTime() : Date.now(),
    });
  } catch (err) {
    console.log('Location send error:', err);
  }
};

// ─────────────────────────────────────────────
// 4. Request Android location permissions
// ─────────────────────────────────────────────
/**
 * Requests ACCESS_FINE_LOCATION and ACCESS_BACKGROUND_LOCATION on Android.
 * Opens Settings if denied.
 * @returns {Promise<boolean>} true if all permissions granted
 */
export const requestLocationPermissions = async () => {
  if (Platform.OS !== 'android') return true;

  // Step 1: Request Fine location
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location Permission',
      message: 'This app needs access to your location.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );

  if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
    Alert.alert('Permission Required', 'Enable location permission', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return false;
  }

  // Step 2: Request Background location only for Android 10+
  if (Platform.Version >= 29) {
    const bg = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Background Location',
        message: 'Please select "Allow all the time" for background tracking.',
        buttonPositive: 'Open Settings',
        buttonNegative: 'Skip',
      }
    );

    // App continues even if background permission is denied
    if (bg !== PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Background location not granted - continuing with foreground only');
    }
  }

  // Fine location alone is sufficient to proceed
  return true;
};

// ─────────────────────────────────────────────
// 5. Start background GPS tracking
// ─────────────────────────────────────────────
/**
 * Starts BackgroundGeolocation tracking.
 * Attaches onLocation and onHeartbeat listeners.
 *
 * @param {object} params
 * @param {React.MutableRefObject} params.locationSubscriberRef
 * @param {React.MutableRefObject} params.heartbeatSubscriberRef
 * @param {React.MutableRefObject<number>} params.lastSentRef
 * @param {React.MutableRefObject<boolean>} params.isMounted
 * @param {function({latitude: number, longitude: number}): void} params.onLocationUpdate
 */
export const startBackgroundTracking = ({
  locationSubscriberRef,
  heartbeatSubscriberRef,
  lastSentRef,
  isMounted,
  onLocationUpdate,
   intervalRef,
}) => {
  // Clean up previous subscribers
  locationSubscriberRef.current?.remove();
  heartbeatSubscriberRef.current?.remove();
  clearInterval(intervalRef?.current);

  locationSubscriberRef.current = BackgroundGeolocation.onLocation(async (location) => {
    const { latitude, longitude } = location.coords;
    if (isMounted.current) onLocationUpdate({ latitude, longitude });
    await sendLocation(latitude, longitude, location.timestamp, lastSentRef);
  });

  heartbeatSubscriberRef.current = BackgroundGeolocation.onHeartbeat(async () => {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: false,
      });
      const { latitude, longitude } = location.coords;
      if (isMounted.current) onLocationUpdate({ latitude, longitude });
      await sendLocation(latitude, longitude, location.timestamp, lastSentRef);
    } catch (err) {
      console.log('Heartbeat error:', err);
    }
  });

   intervalRef.current = setInterval(async () => {
    try {
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1, persist: false,
      });
      const { latitude, longitude } = location.coords;
      if (isMounted.current) onLocationUpdate({ latitude, longitude });
      await sendLocation(latitude, longitude, location.timestamp, lastSentRef);
    } catch (err) {
      console.log('Interval location error:', err);
    }
  }, 120000); // 2 minutes

  BackgroundGeolocation.ready({
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 10,
    interval: 120000,
    fastestInterval: 120000,
    heartbeatInterval: 120,
    stopOnTerminate: false,
    startOnBoot: true,
    debug: false,
  }).then((state) => {
    if (!state.enabled) BackgroundGeolocation.start();
  });
};

// ─────────────────────────────────────────────
// 6. Stop background GPS tracking
// ─────────────────────────────────────────────
/**
 * Stops BackgroundGeolocation and removes all subscribers.
 *
 * @param {React.MutableRefObject} locationSubscriberRef
 * @param {React.MutableRefObject} heartbeatSubscriberRef
 */
export const stopBackgroundTracking = (locationSubscriberRef, heartbeatSubscriberRef) => {
  BackgroundGeolocation.stop();
  locationSubscriberRef.current?.remove();
  heartbeatSubscriberRef.current?.remove();
};

// ─────────────────────────────────────────────
// 7. Custom Hook: useLocationTracking
// ─────────────────────────────────────────────
/**
 * All-in-one hook that manages location state and tracking lifecycle.
 *
 * Usage in SurveyerScreen:
 *   const { currentLocation, startTracking, stopTracking } = useLocationTracking();
 *
 * @param {React.MutableRefObject<boolean>} isMounted
 * @returns {{ currentLocation: {latitude:number,longitude:number}|null, startTracking: function, stopTracking: function }}
 */
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
    clearInterval(intervalRef.current); // ← cleanup
    stopBackgroundTracking(locationSubscriberRef, heartbeatSubscriberRef);
  };

  return { currentLocation, startTracking, stopTracking };
};
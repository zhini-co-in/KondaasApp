// InstallerService.js - Fixed for InstallerScreen

import { useRef, useState, useEffect } from 'react';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { 
  PermissionsAndroid, 
  Platform, 
  Alert, 
  Linking, 
  DeviceEventEmitter, 
  NativeModules, 
  NativeEventEmitter 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { USER_DATA } from './localStorage';


// const BASE_URL = 'https://board.trisentrix.com'; // fallback if needed



// ==================== UTILITIES ====================

export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    return data ? JSON.parse(data)?.UserInfo?.phoneNo || '' : '';
  } catch (e) {
    return '';
  }
};

const isMockLocation = (lat, lon) => {
  return Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01;
};

const lastSentTime = { current: 0 };

// ==================== SEND LOCATION ====================

export const sendLocationToServer = async (latitude, longitude, timestamp = null) => {
  if (isMockLocation(latitude, longitude)) return false;

  const now = Date.now();
  if (now - lastSentTime.current < 180000) return false; // 3 minutes throttle
  lastSentTime.current = now;

  try {
    const phoneNo = await getUserPhone();
    if (!phoneNo) return false;

    const payload = {
      phoneNo: phoneNo.toString().trim(),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      epoch: timestamp || Math.floor(Date.now() / 1000),
    };

    console.log('📤 Logistic Sending:', payload);

    const res = await API.post('/installer/add', payload);
    console.log('✅ Installer Location Saved:', res.status);
    return true;
  } catch (err) {
    console.error('❌ Installer Send Error:', err?.response?.data || err.message);
    return false;
  }
};

// ==================== PERMISSIONS ====================

export const requestLocationPermissions = async () => {
  if (Platform.OS === 'android') {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      { title: 'Location Permission', message: 'Installer tracking ku location access venum.', buttonPositive: 'Allow' }
    );

    if (fine !== PermissionsAndroid.RESULTS.GRANTED) return false;

    if (Platform.Version >= 29) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        { title: 'Background Location', message: 'Background tracking ku Always allow pannanum.', buttonPositive: 'Allow' }
      );
    }
    return true;
  } 
  else if (Platform.OS === 'ios') {
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (whenInUse !== RESULTS.GRANTED) return false;
    
    await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    return true;
  }
  return true;
};

export const isGPSEnabled = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    return await NativeModules.LocationManager?.isLocationEnabled?.() ?? false;
  } catch (e) {
    return false;
  }
};

// ==================== MAIN HOOK - LOGISTIC TRACKING ====================

export const useInstallerTracking = (isMountedRef) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const watchIdRef = useRef(null);
  const isTrackingRef = useRef(false);
  const listenerRef = useRef(null);

  const startTracking = () => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;

    console.log('🟢 Installer Tracking Started');

    if (Platform.OS === 'android') {
      // Native Service (StartStopService) already started from LogisticScreen
      listenerRef.current = DeviceEventEmitter.addListener(
        'nativeLocationUpdate',
        async (data) => {
          if (data?.latitude && data?.longitude && isMountedRef.current) {
            setCurrentLocation({
              latitude: data.latitude,
              longitude: data.longitude,
              speed: data.speed || 0,
            });
            await sendLocationToServer(data.latitude, data.longitude, data.timestamp);
          }
        }
      );
    } 
    else if (Platform.OS === 'ios') {
      const { LocationService } = NativeModules;
      if (!LocationService) {
        console.error('❌ LocationService Native Module not found!');
        return;
      }

      const emitter = new NativeEventEmitter(LocationService);

      listenerRef.current = emitter.addListener('nativeLocationUpdate', async (data) => {
        if (data?.latitude && data?.longitude && isMountedRef.current) {
          setCurrentLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed || 0,
          });
          await sendLocationToServer(data.latitude, data.longitude, data.timestamp);
        }
      });

      setTimeout(() => {
        LocationService.startTracking();
      }, 500);
    }
  };

  const stopTracking = () => {
    console.log('🔴 Installer Tracking Stopped');
    isTrackingRef.current = false;

    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }

    if (Platform.OS === 'ios') {
      NativeModules.LocationService?.stopTracking?.();
    }

    setCurrentLocation(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return { currentLocation, startTracking, stopTracking };
};

// ==================== HIGH FREQUENCY TRACKING (Optional) ====================

let hfInterval = null;

export const startHighFrequencyTracking = () => {
  if (hfInterval) clearInterval(hfInterval);

  hfInterval = setInterval(async () => {
    // You can get latest location from global or AsyncStorage
    const lastLoc = await AsyncStorage.getItem('last_known_location');
    if (!lastLoc) return;

    const { latitude, longitude } = JSON.parse(lastLoc);
    await sendLocationToServer(latitude, longitude);
  }, 45000); // every 45 seconds
};

export const stopHighFrequencyTracking = () => {
  if (hfInterval) {
    clearInterval(hfInterval);
    hfInterval = null;
  }
};
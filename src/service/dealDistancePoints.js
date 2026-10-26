import AsyncStorage from '@react-native-async-storage/async-storage';

const toPoint = (loc) => ({
  latitude: Number(loc.latitude),
  longitude: Number(loc.longitude),
  capturedAt: Date.now(),
});

export const getBestLocation = async (liveLoc) => {
  if (liveLoc?.latitude != null && liveLoc?.longitude != null) {
    console.log('[Points] using live location');
    return liveLoc;
  }
  try {
    const raw = await AsyncStorage.getItem('last_known_location');
    console.log('[Points] live null, last_known_location =', raw);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.log('[Points] getBestLocation error:', e?.message);
    return null;
  }
};

const savePointOnce = async (key, loc) => {
  console.log('[Points] save try:', key, JSON.stringify(loc));
  if (!loc) {
    console.log('[Points] NOT saved, location is null:', key);
    return;
  }
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing === null) {
      await AsyncStorage.setItem(key, JSON.stringify(toPoint(loc)));
      console.log('[Points] saved:', key);
    } else {
      console.log('[Points] already exists:', key, existing);
    }
  } catch (e) {
    console.log('[Points] save error:', e?.message);
  }
};

export const saveStartPointOnce = (leadId, loc) => savePointOnce(`start_point_${leadId}`, loc);
export const saveSitePointOnce  = (leadId, loc) => savePointOnce(`site_point_${leadId}`, loc);

export const getDistancePoints = async (leadId) => {
  const read = async (k) => {
    try {
      const raw = await AsyncStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const start = await read(`start_point_${leadId}`);
  const site  = await read(`site_point_${leadId}`);
  console.log('[Points] read for', leadId, 'start:', JSON.stringify(start), 'site:', JSON.stringify(site));
  return { start, site };
};
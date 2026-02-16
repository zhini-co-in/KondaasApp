// src/utils/SolarParseUtil.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import MonthlyDataManager from "./MonthlyDataManager";
/**
 * Utility class to detect Indian state from solar station data
 * 
 * Primary sources (in order of reliability):
 * 1. regionLevel1 code
 * 2. locationAddress string parsing
 * 3. geo coordinates fallback (lat/lng bounding box) - optional
 * 
 * Returns normalized state key suitable for Firestore/AsyncStorage
 * e.g. 'tamil-nadu', 'kerala', 'karnataka', etc.
 */
class SolarParseUtil {
  // Known regionLevel1 → state mapping (from your samples + common values)
  static REGION_LEVEL1_MAP = {
    1413: 'tamil-nadu',
    1399: 'kerala',
    // Add more as you discover them from real API responses
    // Examples:
    // 1401: 'karnataka',
    // 1407: 'andhra-pradesh',
    // 1410: 'telangana',
    // 1395: 'maharashtra',
    // ...
  };

  // Simple keyword-based fallback if regionLevel1 is missing/unknown
  static ADDRESS_KEYWORDS = {
    'tamil nadu': 'tamil-nadu',
    'tamil-nadu': 'tamil-nadu',
    'tn ': 'tamil-nadu',
    '641': 'tamil-nadu',      // pincode prefix example
    'kerala': 'kerala',
    'kl ': 'kerala',
    'kottayam': 'kerala',
    'changanassery': 'kerala',
    'changanachery': 'kerala',
    '686': 'kerala',          // pincode prefix example
  };


  /**
   * Parse and extract key info from station JSON
   * @param {Object} station - the station JSON object
   * @returns {Object} extracted data or error
   */
  static parseStation(station) {
    if (!station || typeof station !== 'object') {
      console.warn('Invalid station object passed to SolarParseUtil');
      return { error: 'Invalid station data' };
    }

    console.log("Parsing station:", station.id || station.name || 'unknown');

    // 1. State detection (same logic as before)
    let state = 'unknown';

    const regionCode = station.regionLevel1;
    if (regionCode && this.REGION_LEVEL1_MAP[regionCode]) {
      state = this.REGION_LEVEL1_MAP[regionCode];
    } else {
      const address = (station.locationAddress || '').toLowerCase().trim();
      if (address) {
        for (const [keyword, stateKey] of Object.entries(this.ADDRESS_KEYWORDS)) {
          if (address.includes(keyword)) {
            state = stateKey;
            break;
          }
        }
      }

      // Rough geo fallback (optional)
      const lat = Number(station.locationLat);
      const lng = Number(station.locationLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= 8.0 && lat <= 13.5 && lng >= 76.0 && lng <= 80.5) {
          state = 'tamil-nadu';
        } else if (lat >= 8.0 && lat <= 12.8 && lng >= 74.8 && lng <= 77.5) {
          state = 'kerala';
        }
      }
    }

    if (state === 'unknown') {
      console.warn(`Could not detect state for station: ${station.id || 'unknown'}`);
      state = 'tamil-nadu'; // your default/fallback
    }

    // 2. Installed capacity in kW
    let capacityW = station.installedCapacity ?? 0;
    const capacityKw = capacityW > 100 ? capacityW / 1000 : capacityW;

    // 3. Operational / creation date
    // Prefer startOperatingTime (actual commissioning) over createdDate (record creation)
    const startTs = station.startOperatingTime ?? station.createdDate ?? null;
    const operationalDate = startTs 
      ? new Date(startTs * 1000).toISOString()
      : null;

    const operationalTimestamp = startTs || null;

    return {
      state,
      capacityKw: Number(capacityKw.toFixed(2)),
      operationalDate,             // ISO string
      operationalTimestamp,        // original Unix seconds
      stationId: station.id,
      name: station.name || null,
      parsedAt: new Date().toISOString(),
      error: null
    };
  }

  /**
   * Parse + immediately save to AsyncStorage
   * @returns {Object} parsed result
   */
  static async parseAndSave(station) {
    const parsed = this.parseStation(station);

    try {
      await AsyncStorage.setItem('@SolarApp:station_parsed', JSON.stringify(parsed));
      console.log('Station parsed & saved:', parsed);
      
      // Trigger background monthly sync (non-blocking)
    // Automatically start monthly sync in background
      console.log('Triggering background monthly data sync...');
      MonthlyDataManager.sync(parsed.stationId).catch(err => {
        console.error('Background monthly sync failed:', err);
      });

    } catch (err) {
      console.error('Failed to save parsed station info:', err);
      parsed.error = 'Save failed';
    }
    if (parsed.error) {
      return parsed;
    }

    return parsed;
  }


  /**
   * Load previously parsed station info
   */
  static async getParsedStation() {
    try {
      const json = await AsyncStorage.getItem('@SolarApp:station_parsed');
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear parsed station data (on logout, etc.)
   */
  static async clear() {
    await AsyncStorage.removeItem('@SolarApp:station_parsed');
    await MonthlyDataManager.clear();
  }
}

export default SolarParseUtil;
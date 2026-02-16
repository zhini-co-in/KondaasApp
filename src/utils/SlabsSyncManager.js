import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const STALE_THRESHOLD_DAYS = 7;

const DEFAULT_FALLBACK = {
  'tamil-nadu': [
    // Your TN progressive export slabs as fallback
    { from: 1,   to: 100,   rate: 0.00 },
    { from: 101, to: 200,   rate: 2.35 },
    { from: 201, to: 400,   rate: 4.70 },
    { from: 401, to: 500,   rate: 6.30 },
    { from: 501, to: 600,   rate: 8.40 },
    { from: 601, to: 800,   rate: 9.45 },
    { from: 801, to: 1000,  rate: 10.50 },
    { from: 1001, to: 'above', rate: 11.55 },
  ],
  // Add kerala or others if needed
};

class SlabsSyncManager {
  static getStorageKey() {
    return '@SolarApp:all_slabs'; // single key for all states
  }

  static getLastSyncKey() {
    return '@SolarApp:slabs_last_sync';
  }

  static async isCacheStale() {
    const lastSyncStr = await AsyncStorage.getItem(this.getLastSyncKey());
    if (!lastSyncStr) return true;
    const lastSync = new Date(lastSyncStr);
    const now = new Date();
    const diffDays = (now - lastSync) / (1000 * 60 * 60 * 24);
    return diffDays > STALE_THRESHOLD_DAYS;
  }

  /**
   * Fetch ALL documents from solarExportSlabs collection and cache them
   * Returns a map: { stateId: { ...documentData } }
   */
  static async syncAllFromFirestore() {
    try {
      const snapshot = await firestore()
        .collection('solarExportSlabs')
        .get();

      const allSlabs = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        allSlabs[doc.id] = {
          ...data,
          id: doc.id,
          // Ensure slabs exist (normalize if needed)
          slabs: data.slabs || [],
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        };
      });

      if (Object.keys(allSlabs).length === 0) {
        console.warn('No slabs found in Firestore → using fallback');
        return DEFAULT_FALLBACK;
      }

      const payload = {
        allSlabs,
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(this.getStorageKey(), JSON.stringify(payload));
      await AsyncStorage.setItem(this.getLastSyncKey(), new Date().toISOString());

      console.log(`Synced ${Object.keys(allSlabs).length} state slabs`);
      return allSlabs;
    } catch (error) {
      console.error('Firestore sync all failed:', error);
      return DEFAULT_FALLBACK;
    }
  }

  /**
   * Get all cached slabs (map of state → data)
   */
  static async getAllCachedSlabs() {
    const json = await AsyncStorage.getItem(this.getStorageKey());
    if (!json) return DEFAULT_FALLBACK;

    try {
      const parsed = JSON.parse(json);
      return parsed.allSlabs || DEFAULT_FALLBACK;
    } catch (e) {
      console.error('Invalid cache format');
      return DEFAULT_FALLBACK;
    }
  }

  /**
   * Get slabs for a specific state (from cache or fallback)
   * Triggers background sync if stale
   * @param {string} stateId e.g. "tamil-nadu"
   * @returns {Array} slabs array
   */
  static async getSlabsForState(stateId) {
    const allCached = await this.getAllCachedSlabs();

    if (await this.isCacheStale()) {
      this.syncAllFromFirestore().catch(() => {}); // background refresh
    }

    const stateData = allCached[stateId.toLowerCase()];
    return stateData?.slabs || DEFAULT_FALLBACK[stateId.toLowerCase()] || [];
  }

  /**
   * Force full sync of all slabs
   */
  static async forceRefreshAll() {
    return this.syncAllFromFirestore();
  }

  /**
   * Clear all slabs cache
   */
  static async clear() {
    await AsyncStorage.multiRemove([
      this.getStorageKey(),
      this.getLastSyncKey(),
    ]);
  }
}

export default SlabsSyncManager;

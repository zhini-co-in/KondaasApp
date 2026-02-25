// src/utils/MonthlyDataManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import SolarExportCalculator from './SolarExportCalculator';
import SlabsSyncManager from './SlabsSyncManager';
import { setAuthToken, fetchHistoricalData } from "../api/api";
import { getStationId } from "./stationId";

const getKey = (stationId) =>
  `@SolarApp:monthly_generation_${stationId}`;


class MonthlyDataManager {
  static async _getStoredData(stationId) {
  try {
    const json = await AsyncStorage.getItem(getKey(stationId));
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

  static async _saveData(stationId, data) {
  try {
    await AsyncStorage.setItem(
      getKey(stationId),
      JSON.stringify(data)
    );
  } catch (e) {
    console.error('Failed to save monthly data', e);
  }
}

  /**
   * Full sync: Fetch month-by-month from creation date to current month
   * @param {string} stationId - current station ID
   */
  static async sync(stationId) {

  if (!stationId) {
    stationId = await getStationId(); // ✅ AUTO LOAD
  }

  if (!stationId) {
    console.warn("No stationId found");
    return null;
  }

    const stored = (await this._getStoredData(stationId)) || {
      monthlyRecords: {},
      cumulativeUnits: 0,
      cumulativeCost: 0,
      startMonth: null,
      stationId,
      state: 'tamil-nadu'
    };
    // Get start date from parsed station
    const parsedJson = await AsyncStorage.getItem('@SolarApp:station_parsed');
    if (!parsedJson) {
      console.warn('No parsed station info → cannot sync');
      return stored;
    }

    const parsed = JSON.parse(parsedJson);
    const startTs = parsed.operationalTimestamp ?? 0;
    if (startTs <= 0) {
      console.warn('No valid operational date');
      return stored;
    }

    const startDate = new Date(startTs * 1000);
    const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    stored.startMonth = startMonth;
    const normalizeState = (s) => {
  if (!s) return "tamil-nadu";
  s = s.toLowerCase();

  if (s.includes("tamil")) return "tamil-nadu";
  if (s.includes("kerala")) return "kerala";

  return s;
};

stored.state = normalizeState(parsed.state);
console.log("STATE USED FOR SLAB:", stored.state);

    // Build month list
    const monthsToFetch = [];
let cursor = new Date(startDate);
cursor.setDate(1);

const isFirstSync = !stored.lastSyncMonth;

while (cursor <= now) {
  const m = this._formatYearMonth(cursor);

  if (isFirstSync) {
    // First time → fetch all
    monthsToFetch.push(m);
  } else {
    // After first sync → fetch months after lastSyncMonth
    if (m > stored.lastSyncMonth) {
      monthsToFetch.push(m);
    }
  }

  cursor.setMonth(cursor.getMonth() + 1);
}


    const calculator = new SolarExportCalculator();
    const updatedRecords = { ...stored.monthlyRecords };

    for (const monthKey of monthsToFetch) {
      const [year, month] = monthKey.split('-').map(Number);

      const payload = {
        stationId,
        timeType: 3,  // month
        startTime: `${year}-${String(month).padStart(2, '0')}`,
        endTime: `${year}-${String(month).padStart(2, '0')}`,
      };

      console.log(`📤 Payload for ${monthKey}:`, payload);

      let units = 0;
      try {
        const data = await fetchHistoricalData(payload);

        if (data?.success && data.stationDataItems?.length > 0) {
          units = Number(data.stationDataItems[0].generationValue || 0);
        }
      } catch (err) {
        console.error(`Fetch failed for ${monthKey}:`, err);
      }

      const template = await SlabsSyncManager.getSlabsForState(stored.state);

if (template) {
  template.state = stored.state;

  // ✅ FIXED
  calculator.addConfig(monthKey, template, stored.state);
} else {
  calculator.addConfig(
    monthKey,
    [{ from: 0, to: 'above', rate: 2.55 }],
    stored.state
  );
}

      const cost = calculator.calculateMonthlyCredit(units, monthKey);      console.log('Ezhil MonthlySync cost for ', monthKey, cost);

      updatedRecords[monthKey] = {
        units: Number(units.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        lastUpdated: new Date().toISOString()
      };
    }

    // Recalculate cumulative
    let cumUnits = 0;
    let cumCost = 0;
    Object.values(updatedRecords).forEach(r => {
      cumUnits += r.units || 0;
      cumCost += r.cost || 0;
    });

    const finalData = {
      monthlyRecords: updatedRecords,
      cumulativeUnits: Number(cumUnits.toFixed(2)),
      cumulativeCost: Number(cumCost.toFixed(2)),
      lastSyncMonth: currentMonth,
      lastSyncTime: new Date().toISOString(),
      startMonth,
      stationId,
      state: stored.state
    };


    await this._saveData(stationId, finalData);
    console.log('Ezhil Monthly sync completed ', finalData);

    return finalData;
  }

  static _formatYearMonth(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  static async getMonth(stationId, monthKey) {
  const stored = await this._getStoredData(stationId);
  return stored?.monthlyRecords?.[monthKey] || null;
}

  static async getCurrentMonth(stationId) {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return this.getMonth(stationId, current);
}

  static async getAll(stationId) {
  return await this._getStoredData(stationId);
}

  static async clear(stationId) {
  await AsyncStorage.removeItem(getKey(stationId));
}
}

export default MonthlyDataManager;
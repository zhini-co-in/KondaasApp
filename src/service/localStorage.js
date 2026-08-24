import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";

export const USER_DATA = "user_data";
export const IsLackCallsShown = "isLackCallsShown";
export const getSavingsKey    = (phoneNo)              => `savings_data_${phoneNo}`;
export const getStationsKey   = (phoneNo)              => `stations_data_${phoneNo}`;
export const getTodayGenKey   = (stationId)            => `today_gen_${stationId}`;
export const getLifetimeKey   = (stationId)            => `lifetime_${stationId}`;
export const getHistoryKey    = (stationId, tab, date) => `history_${stationId}_${tab}_${date}`;

// ─────────────────────────────────────────────────────────────
// DEVICE ID
// ─────────────────────────────────────────────────────────────
export const getDeviceId = async () => {
  try {
    return await DeviceInfo.getUniqueId();
  } catch (e) {
    console.log("getDeviceId error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// CURRENT SESSION INFO — deviceId + authToken ஒரே call-ல
// ─────────────────────────────────────────────────────────────
export const getSessionInfo = async () => {
  try {
    const [stored, deviceId] = await Promise.all([
      AsyncStorage.getItem(USER_DATA),
      DeviceInfo.getUniqueId(),
    ]);

    const parsed = stored ? JSON.parse(stored) : null;

    // authToken — top-level shortcut (OtpScreen-ல store பண்றோம்)
    const authToken = parsed?.authToken || null;
    const phoneNo   = parsed?.UserInfo?.phoneNo || null;
    const email     = parsed?.UserInfo?.email   || null;
    const password  = parsed?.UserInfo?.password || null;
    const provider  = parsed?.UserInfo?.provider || null;   // ✅ FIX: variable name "provider"-ஆ மாத்தினேன்
    const accessToken = parsed?.accessToken     || null;

    return { deviceId, authToken, phoneNo, email, password, provider, accessToken, parsed };
  } catch (e) {
    console.log("getSessionInfo error:", e.message);
    return { deviceId: null, authToken: null, phoneNo: null, email: null, password: null, provider: null, accessToken: null, parsed: null };
  }
};

// ─────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────
export const storeData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
    console.log("Data stored successfully", key);
  } catch (e) {
    console.log("Error Storing Data in Async");
  }
};

export const getStorageData = async (key) => {
  try {
    const val = await AsyncStorage.getItem(key);
    console.log(`📖 getStorageData [${key}]:`, val ? "HAS DATA" : "EMPTY");
    return val;
  } catch (e) {
    return null;
  }
};

export const clearStorage = async () => {
  try {
    // 🔍 WHO CALLED THIS? Stack trace பார்க்கிறோம்
    console.log("🚨 clearStorage CALLED!", new Error().stack);
    
    await AsyncStorage.clear();
    const keys = await AsyncStorage.getAllKeys();
    console.log("Storage cleared. Current keys:", keys);
  } catch (e) {
    console.error("Error clearing storage:", e);
  }
};
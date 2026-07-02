import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { getAuth } from "@react-native-firebase/auth";
import DeviceInfo from "react-native-device-info";
import { USER_DATA, getSessionInfo } from "../service/localStorage";


const BASE_URL = "https://crucial-purifier-canopener.ngrok-free.dev";
//const BASE_URL = "https://board.trisentrix.com";

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
const API1 = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 90000,
});

API1.interceptors.request.use(async (config) => {
  try {
    const skipUrls = [
      "/solarman/get",
      "/solarman/user",
      "/solarman/token",
      "/solarman/history",
      "/solarman/stations",
      "/solarman/calculate-savings",
    ];
    const shouldSkip = skipUrls.some((url) => config.url?.includes(url));

    if (!shouldSkip) {
      const currentUser = getAuth().currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        config.headers["x-auth-token"] = idToken;
      }
    }
  } catch (e) {
    console.log("Firebase token error:", e);
  }
  return config;
});

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPER
// x-auth-token
// ─────────────────────────────────────────────────────────────
const solarmanFetch = async (endpoint, body, authToken, deviceId) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": authToken || "",
      "x-device-id":  deviceId  || "",
    },
    body: JSON.stringify(body),
  });
  return res.json();
};

// ─────────────────────────────────────────────────────────────
// 1. GET USER
// ─────────────────────────────────────────────────────────────
export const getUser = async (phoneNo) => {
  try {
    const { deviceId, authToken } = await getSessionInfo();

    const data = await solarmanFetch(
      "/solarman/get",
      { phoneNo },
      authToken,
      deviceId
    );

    console.log("✅ getUser response:", data);
    if (data?.success && data?.data) return data.data;
    return null;
  } catch (error) {
    console.log("❌ getUser error:", error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 2. SAVE USER
// ─────────────────────────────────────────────────────────────
export const saveUser = async (payload) => {
  try {
    const { deviceId, authToken } = await getSessionInfo();

    const { deviceId: _removed, ...cleanPayload } = payload;

    const data = await solarmanFetch(
      "/solarman/user",
      cleanPayload,
      authToken,
      deviceId
    );

    console.log("✅ saveUser response:", data);
    return { success: true, data };
  } catch (error) {
    console.log("❌ saveUser error:", error.message);
    return { success: false, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
export const saveMailCredentials = async (email, password) => {
  try {
    if (!email || !password) {
      return { success: false, message: "Please enter email and password" };
    }

    const { phoneNo, parsed } = await getSessionInfo();

    if (!phoneNo) {
      return { success: false, message: "Session expired. Please login again." };
    }

    const hashedPassword = CryptoJS.SHA256(password).toString();

    const payload = {
      ...parsed,
      UserInfo: {
        ...parsed.UserInfo,
        phoneNo,
        email,
        password: hashedPassword,
      },
    };

    const result = await saveUser(payload);
    if (!result.success) {
      return { success: false, message: "Server error: " + result.message };
    }

    await AsyncStorage.setItem(USER_DATA, JSON.stringify(payload));
    console.log("✅ Credentials saved & AsyncStorage updated");
    return { success: true, message: "Credentials saved successfully" };
  } catch (error) {
    console.log("❌ saveMailCredentials error:", error.message);
    return { success: false, message: "Failed to save credentials" };
  }
};

// ─────────────────────────────────────────────────────────────
// 4. SAVE STATIONS
// 
// ─────────────────────────────────────────────────────────────
export const saveStations = async (stationsList) => {
  try {
    const { phoneNo, parsed } = await getSessionInfo();

    if (!phoneNo) { console.log("❌ saveStations: phoneNo not found"); return; }
    if (!stationsList?.length) { console.log("⚠️ saveStations: empty list"); return; }

    const existingList = parsed?.devicelist || [];
    const stationArray = stationsList.map((item) => {
      const old = existingList.find((d) => d.id === item.id);
      return {
        id:                 item.id,
        name:               item.name || "",
        installationAmount: old?.installationAmount ?? "",
      };
    });

    const payload = {
      ...parsed,
      UserInfo:   { ...parsed.UserInfo, phoneNo },
      devicelist: stationArray,
    };

    const result = await saveUser(payload);
    if (!result.success) { console.log("❌ saveStations failed:", result.message); return; }

    await AsyncStorage.setItem(USER_DATA, JSON.stringify(payload));
    console.log("✅ Stations saved successfully");
  } catch (error) {
    console.log("❌ saveStations error:", error.message);
  }
};

// ─────────────────────────────────────────────────────────────
// 5. GET INSTALLATION AMOUNT
//
// ─────────────────────────────────────────────────────────────
export const getInstallationAmount = async (stationId) => {
  try {
    const { parsed } = await getSessionInfo();
    const device = (parsed?.devicelist || []).find((d) => d.id === stationId);
    if (device) {
      const amt = Number(device.installationAmount || 0);
      console.log("💰 Installation Amount:", amt);
      return amt;
    }
    return 0;
  } catch (error) {
    console.log("❌ getInstallationAmount error:", error.message);
    return 0;
  }
};

// ─────────────────────────────────────────────────────────────
// 6. UPDATE DEVICE INFO 
// ─────────────────────────────────────────────────────────────
export const updateDeviceInfo = async ({ fcmToken } = {}) => {
  try {
    const { deviceId, parsed } = await getSessionInfo();
    if (!parsed) return;

    const now             = new Date().toISOString();
    const existingDevices = parsed?.PlatformInfo?.devices || [];

    const updatedDevices = existingDevices.map((d) =>
      d.deviceId === deviceId
        ? { ...d, fcmToken: fcmToken || d.fcmToken, lastUsedAt: now }
        : d
    );

    if (!existingDevices.find((d) => d.deviceId === deviceId)) {
      updatedDevices.push({
        deviceId,
        os:         DeviceInfo.getSystemName(),
        version:    DeviceInfo.getSystemVersion(),
        authToken:  parsed.authToken || "",
        fcmToken:   fcmToken || null,
        lastUsedAt: now,
      });
    }

    const payload = {
      ...parsed,
      PlatformInfo: { devices: updatedDevices },
    };

    await saveUser(payload);
    await AsyncStorage.setItem(USER_DATA, JSON.stringify(payload));
    console.log("✅ Device info updated:", deviceId);
  } catch (error) {
    console.log("❌ updateDeviceInfo error:", error.message);
  }
};

// ─────────────────────────────────────────────────────────────
// 7. GET HISTORY
// 
// ─────────────────────────────────────────────────────────────
export const getHistory = async ({ stationId, timeType, startTime, endTime }) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    const data = await solarmanFetch(
      "/solarman/history",
      {
        phoneNo,
        stationId,
        timeType,
        startTime,
        endTime,
      },
      authToken,
      deviceId
    );

    console.log("✅ getHistory:", JSON.stringify(data).slice(0, 200));

    if (data?.success) return { stationDataItems: data.data || [] };
    return { stationDataItems: [] };
  } catch (e) {
    console.log("❌ getHistory error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 8. FETCH STATION LIST

// ─────────────────────────────────────────────────────────────
export const fetchStationList = async () => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    console.log("📡 fetchStationList | deviceId:", deviceId);

    const data = await solarmanFetch(
      "/solarman/stations",
      { phoneNo },
      authToken,
      deviceId
    );

    console.log("🏭 fetchStationList:", JSON.stringify(data));

    if (data?.stations)      return data.stations;
    if (data?.stationList)   return data.stationList;
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.log("❌ fetchStationList error:", e.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// 9. FETCH HISTORICAL DATA (wrapper)
// ─────────────────────────────────────────────────────────────
export const fetchHistoricalData = async ({ stationId, timeType, startTime, endTime }) => {
  return await getHistory({ stationId, timeType, startTime, endTime });
};

// ─────────────────────────────────────────────────────────────
// 10. FETCH REAL TIME DATA
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
export const fetchRealTimeData = async ({ stationId }) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    console.log("📡 fetchRealTimeData | stationId:", stationId, "| deviceId:", deviceId, "| authToken:", authToken ? "EXISTS" : "MISSING");

    const data = await solarmanFetch(
      "/solarman/realtime",
      { phoneNo, stationId },
      authToken,
      deviceId
    );

    console.log("✅ fetchRealTimeData:", JSON.stringify(data));
    return data;

  } catch (error) {
    console.log("❌ fetchRealTimeData error:", error.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 11. FETCH SAVINGS
// ─────────────────────────────────────────────────────────────
export const fetchSavings = async (phoneNo, stationId) => {
  try {
    const { deviceId, authToken } = await getSessionInfo();

    console.log("💰 fetchSavings | phoneNo:", phoneNo, "| stationId:", stationId);

    const data = await solarmanFetch(
      "/savings/calculate-savings",
      { phoneNo, stationId },
      authToken,
      deviceId
    );

    console.log("✅ fetchSavings:", JSON.stringify(data));
    return data;

  } catch (e) {
    console.log("❌ fetchSavings error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 12. FETCH STATION DEVICES
// ─────────────────────────────────────────────────────────────
export const fetchStationDevices = async (stationId) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    const data = await solarmanFetch(
      "/solarman/devices",
      { phoneNo, stationId },
      authToken,
      deviceId
    );

    console.log("✅ fetchStationDevices:", JSON.stringify(data));
    return data;

  } catch (e) {
    console.log("❌ fetchStationDevices error:", e.message);
    return null;
  }
};

export default API1;



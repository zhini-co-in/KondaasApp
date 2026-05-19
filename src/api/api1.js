import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { getAuth } from "@react-native-firebase/auth";
import DeviceInfo from "react-native-device-info";
import { USER_DATA, getSessionInfo } from "../service/localStorage";

const BASE_URL = "https://board.trisentrix.com";

// ─────────────────────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────────────────────
const API1 = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
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
// 1. GET USER
// ─────────────────────────────────────────────────────────────
export const getUser = async (phoneNo) => {
  try {
    const { deviceId } = await getSessionInfo();
    const response = await API1.post("/solarman/get", { phoneNo, deviceId });
    console.log("✅ getUser response:", response.data);
    if (response.data?.success && response.data?.data) return response.data.data;
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
    const { deviceId } = await getSessionInfo();
    const response = await API1.post("/solarman/user", { ...payload, deviceId });
    console.log("✅ saveUser response:", response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.log("❌ saveUser error:", error.message);
    return { success: false, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// 3. SAVE MAIL CREDENTIALS
// ─────────────────────────────────────────────────────────────
export const saveMailCredentials = async (email, password) => {
  try {
    if (!email || !password) {
      return { success: false, message: "Please enter email and password" };
    }

    const { deviceId, phoneNo, parsed } = await getSessionInfo();

    if (!phoneNo) {
      return { success: false, message: "Session expired. Please login again." };
    }

    const hashedPassword = CryptoJS.SHA256(password).toString();

    const payload = {
      ...parsed,
      deviceId,
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
// ─────────────────────────────────────────────────────────────
export const saveStations = async (stationsList) => {
  try {
    const { deviceId, phoneNo, parsed } = await getSessionInfo();

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
      deviceId,
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
// 6. UPDATE DEVICE INFO (fcmToken refresh / lastUsedAt update)
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
      deviceId,
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
// ─────────────────────────────────────────────────────────────
export const getHistory = async ({ stationId, timeType, startTime, endTime }) => {
  try {
    const {
      deviceId, authToken, phoneNo,
      email, password, accessToken: storedToken, parsed,
    } = await getSessionInfo();

    let token = storedToken;

    // Solarman access token refresh
    try {
      const tokenRes = await fetch(`${BASE_URL}/solarman/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({ phoneNo, deviceId, email, password }),
      });
      const tokenData = await tokenRes.json();
      console.log("🔄 Token refresh:", JSON.stringify(tokenData));

      if (tokenData?.access_token) {
        token = tokenData.access_token;
        await AsyncStorage.setItem(USER_DATA, JSON.stringify({ ...parsed, accessToken: token }));
        console.log("✅ Token refreshed");
      }
    } catch (tokenErr) {
      console.log("⚠️ Token refresh failed:", tokenErr.message);
    }

    const res = await fetch(`${BASE_URL}/solarman/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": authToken,
      },
      body: JSON.stringify({
        token,        // solarman accessToken
        phoneNo,
        deviceId,     // ← which device is requesting
        stationId,
        timeType,
        startTime,
        endTime,
      }),
    });

    const data = await res.json();
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
    const { deviceId, authToken, phoneNo, accessToken } = await getSessionInfo();

    console.log("📡 fetchStationList | deviceId:", deviceId);

    const res = await fetch(`${BASE_URL}/solarman/stations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": authToken,
      },
      body: JSON.stringify({
        token:    accessToken,  // solarman accessToken
        phoneNo,
        deviceId,              // ← which device is requesting
      }),
    });

    const data = await res.json();
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
export const fetchRealTimeData = async ({ stationId }) => {
  try {
    const { deviceId, accessToken } = await getSessionInfo();

    if (!accessToken) {
      console.log("❌ fetchRealTimeData: accessToken not found");
      return null;
    }

    console.log("📡 fetchRealTimeData | deviceId:", deviceId, "| stationId:", stationId);

    const response = await axios.post(
      "https://globalapi.solarmanpv.com/station/v1.0/realTime?language=en",
      { stationId, deviceId },
      {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ fetchRealTimeData response:", response.data);
    return response.data;
  } catch (error) {
    console.log("❌ fetchRealTimeData error:", error.message);
    return null;
  }
};

export default API1;
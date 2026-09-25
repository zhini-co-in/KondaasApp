import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import DeviceInfo from "react-native-device-info";
import { USER_DATA, getSessionInfo } from "../service/localStorage";
import { fetchDeyeStationList, fetchDeyeHistory, fetchDeyeSavings } from "./api2";
import { fetchSolisStationList, fetchSolisHistory, fetchSolisSavings } from "./api3";
import { logSecurity } from "../utils/crashLogger";
import { apiFetch, BASE_URL, getAuthHeaders } from "./apiClient";

// ─────────────────────────────────────────────────────────────
// Axios instance (optional — mostly apiFetch use பண்றோம்)
// ─────────────────────────────────────────────────────────────
const API1 = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 90000,
});

// ✅ எல்லா request-க்கும் Firebase token + phone + deviceId
API1.interceptors.request.use(async (config) => {
  try {
    const authHeaders = await getAuthHeaders();

    // FormData upload-னா Content-Type override பண்ணாதீங்க
    // (boundary axios/RN தானே set பண்ணணும்)
    const isFormData =
      (typeof FormData !== "undefined" && config.data instanceof FormData) ||
      config.headers?.["Content-Type"]?.includes?.("multipart");

    if (isFormData) {
      // token + phone மட்டும்; Content-Type விடாதீங்க
      const { "Content-Type": _ct, ...rest } = authHeaders;
      config.headers = {
        ...config.headers,
        ...rest,
      };
      // RN axios: multipart boundary-க்கு Content-Type delete பண்ணுவது safe
      if (config.headers["Content-Type"]) {
        delete config.headers["Content-Type"];
      }
      if (config.headers["content-type"]) {
        delete config.headers["content-type"];
      }
    } else {
      config.headers = {
        ...config.headers,
        ...authHeaders,
      };
    }
  } catch (e) {
    console.log("Firebase token error:", e);
    logSecurity("firebase_token_fetch_failed", { message: e.message });
  }
  return config;
});

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPER — apiFetch use பண்றது
// ─────────────────────────────────────────────────────────────
const solarmanFetch = async (endpoint, body) => {
  const result = await apiFetch(endpoint, {
    method: "POST",
    body,
  });
  return result.data;
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const isDeyeProduct = (productType) =>
  typeof productType === "string" && productType.toLowerCase().includes("deye");

const isSolisProduct = (productType) =>
  typeof productType === "string" && productType.toLowerCase().includes("solis");

// ─────────────────────────────────────────────────────────────
// TEMPLATE — Product type options
// ─────────────────────────────────────────────────────────────
export const getProductTypeOptions = async () => {
  try {
    const result = await apiFetch("/template/get/product_type", { method: "GET" });
    if (Array.isArray(result.data?.options) && result.data.options.length > 0) {
      return result.data.options;
    }
    return [];
  } catch (error) {
    console.log("❌ getProductTypeOptions error:", error.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// 1. GET USER
// ─────────────────────────────────────────────────────────────
export const getUser = async (phoneNo) => {
  try {
    const data = await solarmanFetch("/solarman/get", { phoneNo });

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
    const { deviceId: _removed, ...cleanPayload } = payload;

    const data = await solarmanFetch("/solarman/user", cleanPayload);

    console.log("✅ saveUser response:", data);
    return { success: true, data };
  } catch (error) {
    console.log("❌ saveUser error:", error.message);
    return { success: false, message: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// 3. SAVE MAIL CREDENTIALS
// ─────────────────────────────────────────────────────────────
export const saveMailCredentials = async (email, password, productType) => {
  try {
    if (!email || !password) {
      return { success: false, message: "Please enter email and password" };
    }
    if (!productType) {
      return { success: false, message: "Please select a product" };
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
        provider: productType,
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
    const { phoneNo, parsed } = await getSessionInfo();

    if (!phoneNo) {
      console.log("❌ saveStations: phoneNo not found");
      return;
    }
    if (!stationsList?.length) {
      console.log("⚠️ saveStations: empty list");
      return;
    }

    const existingList = parsed?.devicelist || [];
    const stationArray = stationsList.map((item) => {
      const old = existingList.find((d) => d.id === item.id);
      return {
        id: item.id,
        name: item.name || "",
        deviceSn: item.deviceSn || old?.deviceSn || "",
        installationAmount: old?.installationAmount ?? "",
      };
    });

    const payload = {
      ...parsed,
      UserInfo: { ...parsed.UserInfo, phoneNo },
      devicelist: stationArray,
    };

    const result = await saveUser(payload);
    if (!result.success) {
      console.log("❌ saveStations failed:", result.message);
      return;
    }

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
// 6. UPDATE DEVICE INFO
// ─────────────────────────────────────────────────────────────
export const updateDeviceInfo = async ({ fcmToken } = {}) => {
  try {
    const { deviceId, authToken, parsed } = await getSessionInfo();
    if (!parsed) return;

    const now = new Date().toISOString();
    const existingDevices = parsed?.PlatformInfo?.devices || [];

    const updatedDevices = existingDevices.map((d) =>
      d.deviceId === deviceId
        ? { ...d, fcmToken: fcmToken || d.fcmToken, lastUsedAt: now }
        : d
    );

    if (!existingDevices.find((d) => d.deviceId === deviceId)) {
      updatedDevices.push({
        deviceId,
        os: DeviceInfo.getSystemName(),
        version: DeviceInfo.getSystemVersion(),
        authToken: authToken || "",
        fcmToken: fcmToken || null,
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
// ─────────────────────────────────────────────────────────────
const TIME_TYPE_MAP = {
  default: { Day: 1, Week: 2, Month: 2, Year: 3 },
  solis: { Day: 1, Week: 2, Month: 3, Year: 4 },
};

export const getHistory = async ({
  stationId,
  tab,
  timeType,
  startTime,
  endTime,
}) => {
  try {
    const { phoneNo, parsed } = await getSessionInfo();

    const productType = parsed?.UserInfo?.provider;
    const isSolis = isSolisProduct(productType);

    const resolvedTimeType = tab
      ? (isSolis ? TIME_TYPE_MAP.solis : TIME_TYPE_MAP.default)[tab]
      : timeType;

    let finalStart = startTime;
    let finalEnd = endTime;
    if (!isSolis && tab === "Year") {
      finalStart = startTime?.slice(0, 7);
      finalEnd = endTime?.slice(0, 7);
    }

    if (isDeyeProduct(productType)) {
      const device = (parsed?.devicelist || []).find((d) => d.id === stationId);
      return await fetchDeyeHistory({
        stationId,
        deviceSn: device?.deviceSn,
        timeType: resolvedTimeType,
        startTime: finalStart,
        endTime: finalEnd,
      });
    }

    if (isSolis) {
      console.log(
        "📡 getHistory → routing to Solis | stationId:",
        stationId,
        "| timeType:",
        resolvedTimeType
      );
      return await fetchSolisHistory({
        stationId,
        timeType: resolvedTimeType,
        startTime: finalStart,
        endTime: finalEnd,
      });
    }

    const data = await solarmanFetch("/solarman/history", {
      phoneNo,
      stationId,
      timeType: resolvedTimeType,
      startTime: finalStart,
      endTime: finalEnd,
    });

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
    const { phoneNo, parsed } = await getSessionInfo();

    const productType = parsed?.UserInfo?.provider;

    if (isDeyeProduct(productType)) {
      console.log("📡 fetchStationList → routing to Deye");
      return await fetchDeyeStationList();
    }

    if (isSolisProduct(productType)) {
      console.log("📡 fetchStationList → routing to Solis");
      return await fetchSolisStationList();
    }

    console.log("📡 fetchStationList");

    const data = await solarmanFetch("/solarman/stations", { phoneNo });

    console.log("🏭 fetchStationList:", JSON.stringify(data));

    if (data?.stations) return data.stations;
    if (data?.stationList) return data.stationList;
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
export const fetchHistoricalData = async ({
  stationId,
  timeType,
  startTime,
  endTime,
}) => {
  return await getHistory({ stationId, timeType, startTime, endTime });
};

// ─────────────────────────────────────────────────────────────
// 10. FETCH REAL TIME DATA
// ─────────────────────────────────────────────────────────────
export const fetchRealTimeData = async ({ stationId }) => {
  try {
    const { phoneNo } = await getSessionInfo();

    console.log("📡 fetchRealTimeData | stationId:", stationId);

    const data = await solarmanFetch("/solarman/realtime", {
      phoneNo,
      stationId,
    });

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
    const { parsed } = await getSessionInfo();

    const productType = parsed?.UserInfo?.provider;

    if (isDeyeProduct(productType)) {
      console.log(
        "💰 fetchSavings → routing to Deye | phoneNo:",
        phoneNo,
        "| stationId:",
        stationId
      );
      return await fetchDeyeSavings({ phoneNo, stationId });
    }

    if (isSolisProduct(productType)) {
      console.log(
        "💰 fetchSavings → routing to Solis | phoneNo:",
        phoneNo,
        "| stationId:",
        stationId
      );
      return await fetchSolisSavings({ phoneNo, stationId });
    }

    console.log("💰 fetchSavings | phoneNo:", phoneNo, "| stationId:", stationId);

    const data = await solarmanFetch("/savings/calculate-savings", {
      phoneNo,
      stationId,
    });

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
    const { phoneNo } = await getSessionInfo();

    const data = await solarmanFetch("/solarman/devices", {
      phoneNo,
      stationId,
    });

    console.log("✅ fetchStationDevices:", JSON.stringify(data));
    return data;
  } catch (e) {
    console.log("❌ fetchStationDevices error:", e.message);
    return null;
  }
};

export default API1;
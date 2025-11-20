import axios from "axios";
import { getData, getStorageData, USER_DATA } from "../service/localStorage";

const api = axios.create({
  baseURL: "https://globalapi.solarmanpv.com/",
  timeout: 15000,
});

export const setToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};
export const setAuthToken = async () => {
  try {
    const userData = await getStorageData(USER_DATA);
    const parsed = userData ? JSON.parse(userData) : {};
    const token =
      parsed?.accessToken || parsed?.access_token || parsed?.solarmanToken;

    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      console.log("✅ Token added to header:", token);
    } else {
      console.warn("⚠️ No token found in USER_DATA:", parsed);
    }
  } catch (error) {
    console.error("🚨 Error setting token:", error);
  }
};


export const getSolarmanToken = async (appId, appSecret, email, password, language = "en") => {
  try {
    const response = await api.post(
      `account/v1.0/token?appId=${appId}&language=${language}`,
      { appSecret, email, password }
    );

    return response.data;
  } catch (error) {
    console.error("🚨 Solarman Token API Error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.msg || "Failed to get Solarman token");
  }
};
export const fetchStationList = async () => {
  try {
    await setAuthToken();
    const token = api.defaults.headers.common.Authorization;
    console.log("🪪 Current Authorization Token:", token);
    const response = await api.post("station/v1.0/list?language=en", {
      page: 1,
      size: 10,
    });
    console.log("✅ Station API Response:", response.data);
    return response.data?.stationList || [];
  } catch (error) {
    console.error("🚨 Station List API Error:", error.response?.data || error.message);
    return [];
  }
};

export const fetchStationDevices = async (stationId) => {
  try {
    await setAuthToken();

    const body = {
      page: 1,
      size: 10,
      stationId: stationId,
    };

    const response = await api.post(
      "station/v1.0/device?language=en",
      body
    );

    console.log(" Station Devices Response:", response.data);
    return response.data;
  } catch (error) {
    console.error("🚨 Error fetching station devices:", error);
    return null;
  }
};

export const fetchHistoricalData = async (body) => {
  try {
    const res = await api.post("station/v1.0/history?language=en", body);
    return res.data;
  } catch (err) {
    console.error("🚨 API fetch error:", err.response?.data || err.message);
    throw err;
  }
};
export const fetchRealTimeData = async (body) => {
  try {
    await setAuthToken(); // attach token to header
    const res = await api.post("station/v1.0/realTime?language=en", body);
    return res.data;
  } catch (err) {
    console.error("🚨 Real-time API error:", err.response?.data || err.message);
    throw err;
  }
};


export default api;



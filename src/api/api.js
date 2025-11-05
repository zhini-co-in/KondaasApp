// api.js
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
    const userData = await getStorageData(USER_DATA); // ✅ your correct function name
    const parsed = userData ? JSON.parse(userData) : {};

    // ✅ Try all possible token keys
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
export default api;



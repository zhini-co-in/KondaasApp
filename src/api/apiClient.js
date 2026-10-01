import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import DeviceInfo from "react-native-device-info";
import { getSessionInfo } from "../service/localStorage";

export const BASE_URL = "https://kondaas.atom8itsolutions.com";

// Auth state restore aagura varaikkum wait (max 3s)
const waitForUser = () =>
  new Promise((resolve) => {
    const auth = getAuth();
    if (auth.currentUser) return resolve(auth.currentUser);
    let done = false;
    const finish = (u) => {
      if (done) return;
      done = true;
      unsub && unsub();
      resolve(u);
    };
    const unsub = onAuthStateChanged(auth, (u) => finish(u));
    setTimeout(() => finish(auth.currentUser), 3000);
  });

// Always fresh token. force=true → server-ku poi puthu token vaangum
export const getFreshToken = async (force = false) => {
  try {
    const user = await waitForUser();
    if (!user) return null;
    return await user.getIdToken(force);
  } catch (e) {
    console.log("⚠️ getFreshToken error:", e.message);
    return null;
  }
};

export const getAuthHeaders = async (extraHeaders = {}, forceRefresh = false) => {
  const headers = { "Content-Type": "application/json", ...extraHeaders };

  try {
    const idToken = await getFreshToken(forceRefresh);
    if (idToken) headers["x-auth-token"] = idToken; // ❌ stale AsyncStorage fallback remove

    const { phoneNo, deviceId } = await getSessionInfo();
    if (phoneNo) headers["x-user-phone"] = String(phoneNo).replace("+91", "").trim();
    if (deviceId) headers["x-device-id"] = deviceId;
  } catch (e) {
    console.log("⚠️ getAuthHeaders error:", e.message);
  }
  return headers;
};

export const apiFetch = async (endpoint, options = {}) => {
  const { method = "GET", body = null, headers: extraHeaders = {}, skipAuth = false } = options;
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

  const doRequest = async (forceRefresh) => {
    const headers = skipAuth
      ? { "Content-Type": "application/json", ...extraHeaders }
      : await getAuthHeaders(extraHeaders, forceRefresh);

    const config = { method, headers };
    if (body && method !== "GET" && method !== "HEAD") {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      const res = await fetch(url, config);
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.log(`⚠️ ${endpoint} non-JSON (status ${res.status}):`, rawText.slice(0, 200));
        data = { error: rawText || `Non-JSON response (status ${res.status})` };
      }
      return { ok: res.status < 400, status: res.status, data };
    } catch (networkErr) {
      console.log("🔴 Network error:", networkErr.message);
      return { ok: false, status: 0, data: { error: networkErr.message } };
    }
  };

  let result = await doRequest(false);

  // 401 → token force refresh panni oru thadava retry
  if (result.status === 401 && !skipAuth) {
    console.log("🔁 401 — refreshing token & retrying:", endpoint);
    result = await doRequest(true);
  }
  return result;
};

export const apiGet = (endpoint, extraHeaders) =>
  apiFetch(endpoint, { method: "GET", headers: extraHeaders });

export const apiPost = (endpoint, body, extraHeaders) =>
  apiFetch(endpoint, { method: "POST", body, headers: extraHeaders });
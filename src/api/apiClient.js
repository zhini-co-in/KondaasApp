import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";
import { getSessionInfo, USER_DATA } from "../service/localStorage";

export const BASE_URL = "https://kondaas.atom8itsolutions.com";
const SYNCED_KEY = "last_synced_token";

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

export const getFreshToken = async (force = false) => {
  try {
    const user = await waitForUser();
    if (!user) return null;
    return await user.getIdToken(force);
  } catch (e) {
    console.log("⚠️ getFreshToken error:", e.message);
    return null; // offline na null, logout pannaadheenga
  }
};

// ── fetch with timeout ──────────────────────────────────────
const fetchT = async (url, options, ms = 10000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

// ── Token → DB sync ─────────────────────────────────────────
let syncPromise = null;
let syncingToken = null;

export const syncTokenToServer = async (token, force = false) => {
  if (!token) return false;
  if (!force) {
    const last = await AsyncStorage.getItem(SYNCED_KEY);
    if (last === token) return true;
  }
  if (syncPromise && syncingToken === token) return syncPromise;

  syncingToken = token;
  syncPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_DATA);
      const local = raw ? JSON.parse(raw) : null;
      const phone = String(local?.UserInfo?.phoneNo || "").replace("+91", "").trim();
      if (!phone) return false; // login nadakkudhu, skip

      const headers = {
        "Content-Type": "application/json",
        "x-auth-token": token,
        "x-user-phone": phone,
      };

      // 1. Server latest data (pazhaya local data overwrite aagakoodadhu)
      const getRes = await fetchT(`${BASE_URL}/solarman/get`, {
        method: "POST", headers, body: JSON.stringify({ phoneNo: phone }),
      });
      if (!getRes.ok) return false;
      const getJson = await getRes.json().catch(() => null);
      const serverData = getJson?.data;
      if (!getJson?.success || !serverData) return false; // get fail → overwrite pannaadhe

      // 2. Indha device token mattum maathu
      const deviceId = await DeviceInfo.getUniqueId();
      const now = new Date().toISOString();
      const devices = serverData?.PlatformInfo?.devices || [];
      const exists = devices.some((d) => d.deviceId === deviceId);
      const updatedDevices = exists
        ? devices.map((d) =>
            d.deviceId === deviceId ? { ...d, authToken: token, lastUsedAt: now } : d)
        : [...devices, {
            deviceId,
            os: DeviceInfo.getSystemName(),
            version: DeviceInfo.getSystemVersion(),
            authToken: token,
            fcmToken: null,
            lastUsedAt: now,
            isLastLoggedIn: true,
          }];

      const payload = { ...serverData, PlatformInfo: { devices: updatedDevices } };

      // 3. Save
      const saveRes = await fetchT(`${BASE_URL}/solarman/user`, {
        method: "POST", headers, body: JSON.stringify(payload),
      });
      if (!saveRes.ok) return false;

      await AsyncStorage.setItem(SYNCED_KEY, token);
      await AsyncStorage.setItem(
        USER_DATA,
        JSON.stringify({ ...local, PlatformInfo: { devices: updatedDevices }, authToken: token })
      );
      return true;
    } catch (e) {
      console.log("⚠️ syncTokenToServer:", e.message);
      return false; // offline / timeout → next time retry (SYNCED_KEY set aagala)
    }
  })().finally(() => {
    syncPromise = null;
    syncingToken = null;
  });

  return syncPromise;
};

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((res) => setTimeout(() => res(false), ms))]);

export const getAuthHeaders = async (extraHeaders = {}, forceRefresh = false) => {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  try {
    const idToken = await getFreshToken(forceRefresh);
    if (idToken) {
      await withTimeout(syncTokenToServer(idToken), 6000); // slow network la block aagaadhu
      headers["x-auth-token"] = idToken;
    }
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

  const doRequest = async () => {
    const headers = skipAuth
      ? { "Content-Type": "application/json", ...extraHeaders }
      : await getAuthHeaders(extraHeaders);

    const config = { method, headers };
    if (body && method !== "GET" && method !== "HEAD") {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    try {
      const res = await fetch(url, config);
      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); }
      catch { data = { error: rawText || `Non-JSON response (status ${res.status})` }; }
      return { ok: res.status < 400, status: res.status, data };
    } catch (networkErr) {
      return { ok: false, status: 0, data: { error: networkErr.message } };
    }
  };

  let result = await doRequest();

  // 401 → force sync token to DB → retry once
  if (result.status === 401 && !skipAuth) {
    const token = await getFreshToken(false);
    if (token) {
      const ok = await syncTokenToServer(token, true);
      if (ok) result = await doRequest();
    }
  }
  return result;
};

export const apiGet = (endpoint, extraHeaders) =>
  apiFetch(endpoint, { method: "GET", headers: extraHeaders });
export const apiPost = (endpoint, body, extraHeaders) =>
  apiFetch(endpoint, { method: "POST", body, headers: extraHeaders });
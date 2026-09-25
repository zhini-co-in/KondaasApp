import { getAuth } from "@react-native-firebase/auth";
import DeviceInfo from "react-native-device-info";
import { getSessionInfo } from "../service/localStorage";

// ─────────────────────────────────────────────────────────────
// BASE URL — இங்க மட்டும் மாத்துங்க
// ─────────────────────────────────────────────────────────────
export const BASE_URL = "https://crucial-purifier-canopener.ngrok-free.dev";
// export const BASE_URL = "https://kondaas.atom8itsolutions.com";

// ─────────────────────────────────────────────────────────────
// getAuthHeaders — Firebase token + phone + deviceId
// ─────────────────────────────────────────────────────────────
export const getAuthHeaders = async (extraHeaders = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  try {
    // 1. Firebase ID token
    const currentUser = getAuth().currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      headers["x-auth-token"] = idToken;
    } else {
      const { authToken } = await getSessionInfo();
      if (authToken) headers["x-auth-token"] = authToken;
    }

    // 2. Mobile number
    const { phoneNo, deviceId } = await getSessionInfo();
    if (phoneNo) {
      headers["x-user-phone"] = String(phoneNo).replace("+91", "").trim();
    }

    // 3. Device ID
    if (deviceId) {
      headers["x-device-id"] = deviceId;
    }
  } catch (e) {
    console.log("⚠️ getAuthHeaders error:", e.message);
  }

  return headers;
};

// ─────────────────────────────────────────────────────────────
// apiFetch — common fetch for all endpoints
// ─────────────────────────────────────────────────────────────
export const apiFetch = async (endpoint, options = {}) => {
  const {
    method = "GET",
    body = null,
    headers: extraHeaders = {},
    skipAuth = false,
  } = options;

  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

  let headers = { "Content-Type": "application/json", ...extraHeaders };

  if (!skipAuth) {
    headers = await getAuthHeaders(extraHeaders);
  }

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
      console.log(
        `⚠️ ${endpoint} non-JSON (status ${res.status}):`,
        rawText.slice(0, 200)
      );
      data = {
        error: rawText || `Non-JSON response (status ${res.status})`,
      };
    }

    return { ok: res.status < 400, status: res.status, data };
  } catch (networkErr) {
    console.log("🔴 Network error:", networkErr.message);
    return {
      ok: false,
      status: 0,
      data: { error: networkErr.message },
    };
  }
};

export const apiGet = (endpoint, extraHeaders) =>
  apiFetch(endpoint, { method: "GET", headers: extraHeaders });

export const apiPost = (endpoint, body, extraHeaders) =>
  apiFetch(endpoint, { method: "POST", body, headers: extraHeaders });
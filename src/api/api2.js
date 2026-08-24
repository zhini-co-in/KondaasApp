import { getSessionInfo } from "../service/localStorage";

// ─────────────────────────────────────────────────────────────
// DEYE — Backend deyeRoutes: /deye/token, /deye/stations,
//   /deye/real-time, /deye/history, /deye/savings
//
// ⚠️ REMOVED: /deye/devices — இந்த route backend-ல இல்லவே இல்ல
// (call பண்ணா 404 "Not Found" plain text வரும், JSON.parse crash
// ஆகும்). deviceSn எடுக்க வேற வழி பாக்கணும் (கீழ Note பாருங்க).
//
// ⚠️ Call பண்ண வேண்டாம் (இப்போவைக்கு): /deye/real-time
// ─────────────────────────────────────────────────────────────

const BASE_URL = "https://kondaas.atom8itsolutions.com";

const deyeFetch = async (endpoint, body, authToken, deviceId) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-token": authToken || "",
      "x-device-id":  deviceId  || "",
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  try {
    return JSON.parse(rawText);
  } catch {
    console.log(`⚠️ ${endpoint} returned non-JSON (status ${res.status}):`, rawText.slice(0, 200));
    return { error: rawText || `Non-JSON response (status ${res.status})` };
  }
};

const normalizeDeyeItem = (raw) => {
  const itemList = raw?.itemList || [];

  const findVal = (keys) => {
    for (const k of keys) {
      const found = itemList.find((i) => i.key === k);
      if (found) return parseFloat(found.value) || 0;
    }
    return undefined;
  };

  const timeRaw = raw?.time;
  const isUnixTimestamp = /^\d{9,}$/.test(String(timeRaw));

  let dateObj = null;
  if (isUnixTimestamp) {
    dateObj = new Date(Number(timeRaw) * 1000);
  } else if (typeof timeRaw === "string" && timeRaw.includes("-")) {
    const [y, m, d] = timeRaw.split("-").map(Number);
    dateObj = new Date(y, (m || 1) - 1, d || 1);
  }

  return {
    ...raw,
    dateTime: isUnixTimestamp
      ? Number(timeRaw)
      : dateObj
      ? Math.floor(dateObj.getTime() / 1000)
      : null,
    day: dateObj ? dateObj.getDate() : undefined,
    month: dateObj ? dateObj.getMonth() + 1 : undefined,
    year: dateObj ? dateObj.getFullYear() : undefined,
    generationValue: findVal(["Production", "DailyActiveProduction"]),
    generationPower: findVal(["TotalActiveACOutputPower", "ActivePower"]),
  };
};
// ─────────────────────────────────────────────────────────────
// 1. DEYE — FETCH STATION LIST
// ✅ FIX: முன்னாடி ஒவ்வொரு station-க்கும் /deye/devices call பண்ணி
// deviceSn attach பண்ண try பண்ணுச்சு — அந்த route backend-ல இல்ல,
// அதனால அந்த enrichment step நீக்கிருக்கேன். stations plain-ஆ
// return பண்றோம்.
// ─────────────────────────────────────────────────────────────
let inFlightDeyeStationListRequest = null;

const fetchDeyeStationListInternal = async () => {
  const { deviceId, authToken, phoneNo } = await getSessionInfo();

  console.log("📡 fetchDeyeStationList | deviceId:", deviceId);

  const data = await deyeFetch("/deye/stations", { phoneNo }, authToken, deviceId);

  console.log("🏭 fetchDeyeStationList:", JSON.stringify(data));

  if (data?.stations)      return data.stations;
  if (data?.stationList)   return data.stationList;
  if (Array.isArray(data)) return data;
  return [];
};

export const fetchDeyeStationList = async () => {
  try {
    if (inFlightDeyeStationListRequest) {
      console.log("⏳ fetchDeyeStationList: reusing in-flight request");
      return await inFlightDeyeStationListRequest;
    }
    inFlightDeyeStationListRequest = fetchDeyeStationListInternal();
    return await inFlightDeyeStationListRequest;
  } catch (e) {
    console.log("❌ fetchDeyeStationList error:", e.message);
    return [];
  } finally {
    inFlightDeyeStationListRequest = null;
  }
};

// ─────────────────────────────────────────────────────────────
// 2. DEYE — GET HISTORY
// deviceSn கட்டாயம் தேவை. backend fallback-ஆ user.devicelist-ல
// save பண்ணிருக்கிற deviceSn-ஐ எடுக்கும் — அதனால caller (getHistory
// in api1.js) devicelist-ல deviceSn already இருந்தா தான் வேலை செய்யும்.
// ─────────────────────────────────────────────────────────────
export const fetchDeyeHistory = async ({ stationId, deviceSn, timeType, startTime, endTime }) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    const data = await deyeFetch(
      "/deye/history",
      { phoneNo, stationId, deviceSn, timeType, startTime, endTime },
      authToken,
      deviceId
    );

    console.log("✅ fetchDeyeHistory:", JSON.stringify(data).slice(0, 200));

    if (data?.success) {
      const normalizedItems = (data.data || []).map(normalizeDeyeItem);

      return {
        stationDataItems: normalizedItems,
        fromCache: !!data.fromCache,
        liveGenerationToday: data.liveGenerationToday,
      };
    }

    console.log("⚠️ fetchDeyeHistory: backend error:", data?.error);
    return { stationDataItems: [], fromCache: false, liveGenerationToday: undefined };
  } catch (e) {
    console.log("❌ fetchDeyeHistory error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 3. DEYE — FETCH SAVINGS
// ─────────────────────────────────────────────────────────────
export const fetchDeyeSavings = async ({ phoneNo, stationId } = {}) => {
  try {
    const { deviceId, authToken, phoneNo: sessionPhoneNo } = await getSessionInfo();

    const data = await deyeFetch(
      "/deye/savings",
      { phoneNo: phoneNo || sessionPhoneNo, stationId, deviceId },
      authToken,
      deviceId
    );

    console.log("💰 fetchDeyeSavings:", JSON.stringify(data));
    return data;
  } catch (e) {
    console.log("❌ fetchDeyeSavings error:", e.message);
    return null;
  }
};
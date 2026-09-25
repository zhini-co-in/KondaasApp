import { getSessionInfo } from "../service/localStorage";
import { apiFetch } from "./apiClient";

// ─────────────────────────────────────────────────────────────
// DEYE — /deye/stations, /deye/history, /deye/savings
// ─────────────────────────────────────────────────────────────

const deyeFetch = async (endpoint, body) => {
  const result = await apiFetch(endpoint, {
    method: "POST",
    body,
  });
  return result.data;
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
// 1. FETCH STATION LIST
// ─────────────────────────────────────────────────────────────
let inFlightDeyeStationListRequest = null;

const fetchDeyeStationListInternal = async () => {
  const { phoneNo } = await getSessionInfo();

  console.log("📡 fetchDeyeStationList");

  const data = await deyeFetch("/deye/stations", { phoneNo });

  console.log("🏭 fetchDeyeStationList:", JSON.stringify(data));

  if (data?.stations) return data.stations;
  if (data?.stationList) return data.stationList;
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
// 2. GET HISTORY
// ─────────────────────────────────────────────────────────────
export const fetchDeyeHistory = async ({
  stationId,
  deviceSn,
  timeType,
  startTime,
  endTime,
}) => {
  try {
    const { phoneNo } = await getSessionInfo();

    const data = await deyeFetch("/deye/history", {
      phoneNo,
      stationId,
      deviceSn,
      timeType,
      startTime,
      endTime,
    });

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
    return {
      stationDataItems: [],
      fromCache: false,
      liveGenerationToday: undefined,
    };
  } catch (e) {
    console.log("❌ fetchDeyeHistory error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 3. FETCH SAVINGS
// ─────────────────────────────────────────────────────────────
export const fetchDeyeSavings = async ({ phoneNo, stationId } = {}) => {
  try {
    const { phoneNo: sessionPhoneNo, deviceId } = await getSessionInfo();

    const data = await deyeFetch("/deye/savings", {
      phoneNo: phoneNo || sessionPhoneNo,
      stationId,
      deviceId,
    });

    console.log("💰 fetchDeyeSavings:", JSON.stringify(data));
    return data;
  } catch (e) {
    console.log("❌ fetchDeyeSavings error:", e.message);
    return null;
  }
};
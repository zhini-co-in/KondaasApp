import { getSessionInfo } from "../service/localStorage";
import { apiFetch } from "./apiClient";

// ─────────────────────────────────────────────────────────────
// SOLIS — /solis/stations, /solis/history, /solis/savings
// ─────────────────────────────────────────────────────────────

const solisFetch = async (endpoint, body) => {
  const result = await apiFetch(endpoint, {
    method: "POST",
    body,
  });
  return result.data;
};

// ─────────────────────────────────────────────────────────────
// normalizeSolisStation
// ─────────────────────────────────────────────────────────────
const normalizeSolisStation = (raw) => {
  if (!raw) return raw;

  const capacityVal =
    raw.capacityKw != null ? Number(raw.capacityKw) : Number(raw.capacity || 0);

  return {
    ...raw,
    id: raw.id != null ? String(raw.id) : raw.stationId,
    stationId:
      raw.stationId != null
        ? String(raw.stationId)
        : raw.id != null
        ? String(raw.id)
        : undefined,
    name: raw.name || raw.stationName || "",
    deviceSn: raw.deviceSn || raw.sno || "",
    capacityKw: capacityVal,
    installedCapacity: capacityVal,
    state: raw.state || raw.regionStr || "",
    operationalTimestamp:
      raw.operationalTimestamp != null
        ? raw.operationalTimestamp
        : raw.createDate
        ? Math.floor(raw.createDate / 1000)
        : null,
  };
};

// ─────────────────────────────────────────────────────────────
// normalizeSolisItem
// ─────────────────────────────────────────────────────────────
const normalizeSolisItem = (raw) => {
  if (!raw) return raw;

  const isRawReading = raw.time != null;

  if (isRawReading) {
    const timeMs = Number(raw.time);
    const dateObj = new Date(timeMs);

    const generationPower =
      raw.generatorPower != null
        ? Number(raw.generatorPower)
        : raw.power != null
        ? Number(raw.power) * 1000
        : 0;

    const generationValue =
      raw.generationValue != null
        ? Number(raw.generationValue)
        : raw.produceEnergy != null
        ? Number(raw.produceEnergy) / 1000
        : undefined;

    return {
      ...raw,
      dateTime: Math.floor(timeMs / 1000),
      day: dateObj.getDate(),
      month: dateObj.getMonth() + 1,
      year: dateObj.getFullYear(),
      generationValue,
      generationPower,
    };
  }

  // SHAPE B — aggregate (Week/Month/Year)
  let day, month, year;
  if (raw.dateStr) {
    const parts = raw.dateStr.split("-").map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  }

  return {
    ...raw,
    dateTime: raw.date != null ? Math.floor(Number(raw.date) / 1000) : undefined,
    day,
    month,
    year,
    generationValue: raw.energy != null ? Number(raw.energy) : 0,
    generationPower: 0,
  };
};

// ─────────────────────────────────────────────────────────────
// 1. FETCH STATION LIST
// ─────────────────────────────────────────────────────────────
export const fetchSolisStationList = async ({
  email,
  deviceSn,
  stationName,
  stationId,
} = {}) => {
  try {
    const { phoneNo } = await getSessionInfo();

    console.log("📡 fetchSolisStationList | stationId:", stationId, "| deviceSn:", deviceSn);

    const data = await solisFetch("/solis/stations", {
      phoneNo,
      email,
      deviceSn,
      stationName,
      stationId,
    });

    console.log("🏭 fetchSolisStationList:", JSON.stringify(data));

    if (data?.error) {
      console.log("❌ fetchSolisStationList backend error:", data.error);
      return [];
    }

    if (!data?.stations || data.stations.length === 0) {
      if (data?.message) console.log("ℹ️ fetchSolisStationList:", data.message);
      return [];
    }

    return data.stations.map(normalizeSolisStation);
  } catch (e) {
    console.log("❌ fetchSolisStationList error:", e.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// 2. GET HISTORY
// ─────────────────────────────────────────────────────────────
export const fetchSolisHistory = async ({
  stationId,
  timeType,
  startTime,
  endTime,
}) => {
  if (!stationId || !timeType) {
    console.log("⚠️ fetchSolisHistory: stationId/timeType missing, skipping call");
    return { stationDataItems: [], fromCache: false };
  }

  try {
    const { phoneNo } = await getSessionInfo();

    const data = await solisFetch("/solis/history", {
      phoneNo,
      stationId,
      timeType,
      startTime,
      endTime,
    });

    console.log(
      "✅ fetchSolisHistory | timeType:",
      timeType,
      "| item count:",
      data?.data?.length
    );

    if (data?.success) {
      const normalizedItems = (data.data || []).map(normalizeSolisItem);

      // generatorPower all-zero → backfill from generationValue delta
      const isRawReadingShape = normalizedItems.some((it) => it.time != null);
      const allGeneratorPowerZero =
        isRawReadingShape &&
        normalizedItems.every((it) => !Number(it.generatorPower)) &&
        normalizedItems.some((it) => it.generationValue != null);

      if (allGeneratorPowerZero) {
        const sorted = [...normalizedItems].sort(
          (a, b) => (a.dateTime || 0) - (b.dateTime || 0)
        );
        let prevValue = null;
        sorted.forEach((item) => {
          if (item.generationValue == null) return;
          const curr = Number(item.generationValue);
          if (prevValue != null) {
            let deltaKwh = curr - prevValue;
            if (deltaKwh < 0) deltaKwh = 0;
            item.generationPower = Number((deltaKwh * 12000).toFixed(1));
          } else {
            item.generationPower = 0;
          }
          prevValue = curr;
        });
        console.log(
          "🔧 fetchSolisHistory: generatorPower was all-zero, backfilled from generationValue delta"
        );
      }

      if (normalizedItems.length === 0) {
        console.log(
          `⚠️ fetchSolisHistory: EMPTY data for timeType=${timeType} (${startTime} → ${endTime})`
        );
      }

      return {
        stationDataItems: normalizedItems,
        fromCache: !!data.fromCache,
      };
    }

    console.log("⚠️ fetchSolisHistory: backend error:", data?.error);
    return { stationDataItems: [], fromCache: false };
  } catch (e) {
    console.log("❌ fetchSolisHistory error:", e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 3. FETCH SAVINGS
// ─────────────────────────────────────────────────────────────
export const fetchSolisSavings = async ({ stationId } = {}) => {
  try {
    const { phoneNo, deviceId } = await getSessionInfo();

    const data = await solisFetch("/solis/savings", {
      phoneNo,
      stationId,
      deviceId,
    });

    console.log("💰 fetchSolisSavings:", JSON.stringify(data));

    if (data?.error) {
      console.log("❌ fetchSolisSavings backend error:", data.error);
      return null;
    }

    return data;
  } catch (e) {
    console.log("❌ fetchSolisSavings error:", e.message);
    return null;
  }
};
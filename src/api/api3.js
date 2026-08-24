import { getSessionInfo } from "../service/localStorage";

// ─────────────────────────────────────────────────────────────
// SOLIS — Product selection "solis" ஆனா இந்த file-ல உள்ள functions
// use பண்ணு. Backend solisRoutes:
//   /solis/stations, /solis/history, /solis/savings
// ─────────────────────────────────────────────────────────────

const BASE_URL = "https://kondaas.atom8itsolutions.com";
//const BASE_URL = "https://board.trisentrix.com";

const solisFetch = async (endpoint, body, authToken, deviceId) => {
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

// ─────────────────────────────────────────────────────────────
// ✅ normalizeSolisStation — backend `getSolisStations` DB-ல
// formattedDeviceList (name/deviceSn/stationId/capacityKw/state/
// operationalTimestamp) save பண்ணுச்சு, ஆனா client-கு RAW Solis
// fields (stationName/sno/capacity/regionStr/createDate/id)
// தான் திருப்பி அனுப்புது (matchedStations, formattedDeviceList
// இல்ல). இதனால frontend இரண்டு shape-ஐயும் handle பண்ண வேண்டியிருக்கு
// (single-lookup path vs search path இரண்டும் raw fields தான்
// கொடுக்குது) — அதனால ஒரே consistent object-ஆ normalize பண்றோம்.
// ─────────────────────────────────────────────────────────────
const normalizeSolisStation = (raw) => {
  if (!raw) return raw;

  // ✅ FIX: capacityVal-ஐ முதல்ல compute பண்ணி வச்சிக்கணும்,
  // அப்புறம் தான் capacityKw & installedCapacity இரண்டுக்கும் use பண்ணணும்.
  const capacityVal = raw.capacityKw != null ? Number(raw.capacityKw) : Number(raw.capacity || 0);

  return {
    ...raw,
    id:        raw.id != null ? String(raw.id) : raw.stationId,
    stationId: raw.stationId != null ? String(raw.stationId) : (raw.id != null ? String(raw.id) : undefined),
    name:      raw.name || raw.stationName || "",
    deviceSn:  raw.deviceSn || raw.sno || "",
    capacityKw: capacityVal,
    installedCapacity: capacityVal,   // ✅ screen-ல installedCapacity தேடுது, இதுனால % calculation சரியாகும்
    state:     raw.state || raw.regionStr || "",
    operationalTimestamp:
      raw.operationalTimestamp != null
        ? raw.operationalTimestamp
        : (raw.createDate ? Math.floor(raw.createDate / 1000) : null),
  };
};

// ─────────────────────────────────────────────────────────────
// ✅ normalizeSolisItem — history items (day / week / month / year)
//
// SHAPE A — Day tab (timeType:1): raw 5-min readings, `time` field
//   இருக்கும் — இது 100% confirmed, live logs-ல verify ஆச்சு.
//   { time(ms), generatorPower, produceEnergy, power, ... }
//
// SHAPE B — Week/Month/Year (timeType:2/3/4): aggregate summary
//   record(s), `time` field இல்லை, `money`/`energy`/`fullHour`
//   இருக்கும். இதுல day/month field இல்லாததால per-day/month bar
//   chart split பண்ண முடியாது (Solis API-ல itself அந்த breakdown
//   தராது) — screens இந்த item-ஐ ஒரு single total-ஆ தான் நம்பணும்.
//
//   Backend formatSolisDate (current, confirmed):
//     timeType 1        → YYYY-MM-DD   (Day)
//     timeType 2        → YYYY-MM      (Week)
//     timeType 3        → YYYY-MM      (Month)
//     timeType 4        → YYYY         (Year)
//   ⚠️ Week & Month இரண்டுமே YYYY-MM format தான், ஆனா cache key
//   `history_${timeType}_${formattedDate}`-ல timeType வேற்றுமையா
//   இருக்கிறதால தான் இரண்டும் தனித்தனியா cache ஆகும் — caller
//   Week-க்கு timeType:2, Month-க்கு timeType:3 (இரண்டையும் 2 வச்சு
//   அனுப்பினா cache collide ஆகி ஒரே data இரண்டு tab-லயும் தெரியும்).
//   ⚠️ day/month FABRICATE பண்ணமாட்டோம் — wrong number காட்டறதுக்கு
//   பதிலா, இருக்கிற total energy value-ஐ மட்டும் pass பண்றோம்.
// ─────────────────────────────────────────────────────────────
const normalizeSolisItem = (raw) => {
  if (!raw) return raw;

  const isRawReading = raw.time != null; // SHAPE A signal — confirmed

  if (isRawReading) {
    const timeMs  = Number(raw.time);
    const dateObj = new Date(timeMs);

    const generationPower =
      raw.generatorPower != null ? Number(raw.generatorPower) :
      raw.power != null ? Number(raw.power) * 1000 :
      0;

    // 🔧 FIX: raw.produceEnergy Solis API-ல Wh (watt-hours) unit-ல வருது,
    // kWh இல்ல. இதை /1000 பண்ணாம "TODAY" screen-ல 27900 Units மாதிரி
    // wrong number காமிச்சுகிட்டு இருந்தது (real value 27.9 kWh தான்).
    // dayEnergy summary(kWh)-உடன் compare பண்ணி இது confirm ஆச்சு.
    const generationValue =
      raw.generationValue != null ? Number(raw.generationValue) :
      raw.produceEnergy   != null ? Number(raw.produceEnergy) / 1000 :
      undefined;

    return {
      ...raw,
      dateTime: Math.floor(timeMs / 1000),
      day:   dateObj.getDate(),
      month: dateObj.getMonth() + 1,
      year:  dateObj.getFullYear(),
      generationValue,
      generationPower,
    };
  }

  // ── SHAPE B — aggregate summary, no time field ──
  // day/month fabricate பண்ணமாட்டோம் — screens இந்த item-ஐ ஒரு
  // single total-ஆ தான் நம்பணும், per-day/month bar chart split
  // இப்போதைக்கு Solis-க்கு சாத்தியமில்ல (Solis API limitation).
    // ── SHAPE B — aggregate summary (Week/Month/Year), "time" field இல்ல,
  // ஆனா "dateStr" field-ல date இருக்கு:
  //   "YYYY-MM-DD" → day-level entry (Week & Month tabs இதை பயன்படுத்தும்)
  //   "YYYY-MM"    → month-level entry (Year tab இதை பயன்படுத்தும்)
  // 🔧 FIX: முன்னாடி day/month/year-ஐ undefined-ஆ discard பண்ணிச்சு —
  // dateStr-ல இருந்து parse பண்ணி சரியா populate பண்றோம்.
  let day, month, year;
  if (raw.dateStr) {
    const parts = raw.dateStr.split("-").map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2]; // "YYYY-MM" (Year tab) entries-ல இது undefined-ஆவே இருக்கும் — அது சரி
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
// 1. SOLIS — FETCH STATION LIST
//
// Backend (getSolisStations):
//   - phoneNo compulsory-ஆ (body-ல), x-auth-token header compulsory.
//   - stationId கொடுத்தா → direct single-station lookup fast-path,
//     `{ success:true, stations:[singlePlant] }`.
//   - இல்லைன்னா → email/deviceSn/stationName வச்சு flexible
//     matching cascade (matchEmail || matchSn || matchName) master
//     list-ல search பண்ணும், `{ success:true, stations:[...] }`.
//   - match ஒண்ணும் இல்லைன்னா `{ message:"...", stations:[] }`
//     (⚠️ இதுல `error` field இல்ல, `message` தான்).
// ─────────────────────────────────────────────────────────────
export const fetchSolisStationList = async ({
  email,
  deviceSn,
  stationName,
  stationId,
} = {}) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    console.log("📡 fetchSolisStationList | deviceId:", deviceId, "| stationId:", stationId, "| deviceSn:", deviceSn);

    const data = await solisFetch(
      "/solis/stations",
      { phoneNo, email, deviceSn, stationName, stationId },
      authToken,
      deviceId
    );

    console.log("🏭 fetchSolisStationList:", JSON.stringify(data));

    if (data?.error) {
      console.log("❌ fetchSolisStationList backend error:", data.error);
      return [];
    }

    if (!data?.stations || data.stations.length === 0) {
      if (data?.message) console.log("ℹ️ fetchSolisStationList:", data.message);
      return [];
    }

    // 🔧 FIX: backend `stations` raw Solis fields-ஐ தான் திருப்புது
    // (stationName/sno/capacity/regionStr/createDate), DB-ல save
    // பண்ண formattedDeviceList shape இல்ல. Normalize பண்ணி consistent
    // shape-ஆ கொடுக்கிறோம் (name/deviceSn/stationId/capacityKw/state).
    return data.stations.map(normalizeSolisStation);
  } catch (e) {
    console.log("❌ fetchSolisStationList error:", e.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────
// 2. SOLIS — GET HISTORY
//
// Backend (getSolisHistory) compulsory: x-auth-token header,
// x-device-id header, phoneNo (body), stationId + timeType.
// Missing எதுவும் இருந்தா 400/401 வரும் — அதை முன்னாடியே catch
// பண்ணி backend வரைக்கும் போகாம தடுக்கிறோம்.
//
// ✅ CONFIRMED timeType mapping (caller இதை exact-ஆ follow பண்ணணும்):
//   timeType 1 → Day    → startTime/endTime "YYYY-MM-DD" → raw 5-min readings
//   timeType 2 → Week   → startTime/endTime "YYYY-MM-DD" (backend YYYY-MM ஆ collapse பண்ணும்)
//   timeType 3 → Month  → startTime/endTime "YYYY-MM-DD" (backend YYYY-MM ஆ collapse பண்ணும்)
//   timeType 4 → Year   → startTime/endTime "YYYY-MM-DD" (backend YYYY ஆ collapse பண்ணும்)
//
// ⚠️ Week-க்கும் Month-க்கும் VERU VERU timeType (2 vs 3) கண்டிப்பா
// அனுப்பணும் — இரண்டையும் ஒரே timeType வச்சா cache key collide
// ஆகி ஒரே data இரண்டு tab-லயும் தெரியும்.
//
// ⚠️ startTime full "YYYY-MM-DD" (10 chars, dash) format-ல அனுப்பினா
// தான் backend fast string-parse path trigger ஆகும் — "YYYY-MM" மாதிரி
// partial date அனுப்பினா Date() parse fallback-க்கு போய் wrong date
// varakoodum (local timezone issues). Always full day-level date அனுப்பு.
//
// Response shape: { success, fromCache, data: [...] }
// ─────────────────────────────────────────────────────────────
export const fetchSolisHistory = async ({ stationId, timeType, startTime, endTime }) => {
  if (!stationId || !timeType) {
    console.log("⚠️ fetchSolisHistory: stationId/timeType missing, skipping call");
    return { stationDataItems: [], fromCache: false };
  }

  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    const data = await solisFetch(
      "/solis/history",
      { phoneNo, stationId, timeType, startTime, endTime },
      authToken,
      deviceId
    );

    console.log("✅ fetchSolisHistory | timeType:", timeType, "| item count:", data?.data?.length, "| items:", JSON.stringify(data?.data));

    if (data?.success) {
      const normalizedItems = (data.data || []).map(normalizeSolisItem);

      // ✅ FIX: சில Solis stations (hybrid/battery inverters — இந்த
      // station-ல familyLoadPower/batteryPower/psum fields இருக்கு)
      // "generatorPower" field-ஐ track பண்ணாது, daytime-லயும் 0-ஆவே
      // இருக்கும். ஆனா "produceEnergy" (cumulative day energy, normalize
      // ஆனது generationValue) சரியா வரும் (home screen "todayGeneration"
      // இதை வச்சுத்தான் சரியான total காமிக்குது). generatorPower எல்லா
      // items-லயும் 0-ஆ இருந்தா, consecutive generationValue readings-க்கு
      // இடையிலான delta வச்சு average power-ஐ derive பண்ணி
      // generatorPower-ஐ backfill பண்றோம் — screen-ன் power-integration
      // logic (kWh = power×5min) தொடராம சரியா result தரும்.
      const isRawReadingShape = normalizedItems.some(it => it.time != null);
      const allGeneratorPowerZero =
        isRawReadingShape &&
        normalizedItems.every(it => !Number(it.generatorPower)) &&
        normalizedItems.some(it => it.generationValue != null);

      if (allGeneratorPowerZero) {
        const sorted = [...normalizedItems].sort((a, b) => (a.dateTime || 0) - (b.dateTime || 0));
        let prevValue = null;
        sorted.forEach((item) => {
          if (item.generationValue == null) return;
          const curr = Number(item.generationValue);
          if (prevValue != null) {
            let deltaKwh = curr - prevValue;
            if (deltaKwh < 0) deltaKwh = 0; // cumulative counter reset guard
            // deltaKwh 5-min interval-ல accumulate ஆனது → average Watts-ஆ மாத்தறோம்
            // (deltaKwh / (5/60 hr)) * 1000 = deltaKwh * 12000
            item.generationPower = Number((deltaKwh * 12000).toFixed(1));
          } else {
            item.generationPower = 0;
          }
          prevValue = curr;
        });
        console.log("🔧 fetchSolisHistory: generatorPower was all-zero, backfilled from generationValue delta");
      }

      if (normalizedItems.length === 0) {
        console.log(`⚠️ fetchSolisHistory: EMPTY data for timeType=${timeType} (${startTime} → ${endTime}) — check backend`);
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
// 3. SOLIS — FETCH SAVINGS
//
// Backend (calculateSolisUserSavings) requires phoneNo, x-auth-token
// header, deviceId (header OR body — frontend body-லயும் அனுப்புது
// so either way work ஆகும்). Internally backend timeType:3 (Month)
// வச்சு ஒவ்வொரு month-க்கும் loop பண்ணி cumulative units கணக்கு
// பண்றது — caller இங்க timeType பத்தி கவலைப்பட வேண்டாம், backend
// தானே handle பண்ணிக்கும்.
//
// Response:
//   { success, fromCache, data: { stationId, state,
//     cumulativeUnits, cumulativeCost, monthlyRecords } }
// So callers `result.data.cumulativeUnits` etc read பண்ணணும்,
// NOT `result.cumulativeUnits` directly.
//
// ⚠️ KNOWN BACKEND ISSUE (as of latest deploy): `data.state` இப்போ
// lowercase-hyphen slug-ஆ வருது (e.g. "tamil-nadu"), முன்னாடி
// proper-case name ("Tamil Nadu") வந்துச்சு. `data.state`-ஐ UI-ல
// நேரடியா display பண்றீங்கன்னா, backend fix ஆகறவரைக்கும் இங்கயே
// title-case பண்ணி காமிக்க வேண்டியிருக்கும்:
//   const displayState = data.state
//     ?.split('-')
//     .map(w => w.charAt(0).toUpperCase() + w.slice(1))
//     .join(' ');
//
// ⚠️ Cache behavior மாறிடுச்சு: இப்போ backend cache-ஐ trust பண்ண
// `monthlyRecords` non-empty-ஆ இருக்கணும் — காலி monthlyRecords
// cache-ல இருந்தா skip பண்ணி fresh recalculate பண்ணும்.
// ─────────────────────────────────────────────────────────────
export const fetchSolisSavings = async ({ stationId } = {}) => {
  try {
    const { deviceId, authToken, phoneNo } = await getSessionInfo();

    const data = await solisFetch(
      "/solis/savings",
      { phoneNo, stationId, deviceId },
      authToken,
      deviceId
    );

    console.log("💰 fetchSolisSavings:", JSON.stringify(data));

    if (data?.error) {
      console.log("❌ fetchSolisSavings backend error:", data.error);
      return null;
    }

    return data; // { success, fromCache, data: {...} }
  } catch (e) {
    console.log("❌ fetchSolisSavings error:", e.message);
    return null;
  }
};
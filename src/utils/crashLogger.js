import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import DeviceInfo from "react-native-device-info";
import { Platform } from "react-native";

// crashLogger.js -> src/utils/ la irukku, api1.js -> src/api/ la irukku
import API1, { saveUser } from "../api/api1";
import { getSessionInfo } from "../service/localStorage";

const STORAGE_KEY = "@crash_logs_queue";
const CRASH_ENDPOINT = "/crash/add"; // unga backend route: addCrash() function

// ─────────────────────────────────────────────────────────────
// ✅ Backend LogLevel enum ku match aagura levels
// ─────────────────────────────────────────────────────────────
export const LogLevel = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
  SECURITY: "SECURITY",
  CRITICAL: "CRITICAL",
};

// ─────────────────────────────────────────────────────────────
// LOCAL STORAGE HELPERS
// ─────────────────────────────────────────────────────────────

const getLocalLogs = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log("❌ getLocalLogs error:", e.message);
    return [];
  }
};

const saveLocalLogs = async (logs) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.log("❌ saveLocalLogs error:", e.message);
  }
};

// ─────────────────────────────────────────────────────────────
// 1. SAVE CRASH/LOG LOCALLY (backend ku immediate-ah pogadhu)
// ─────────────────────────────────────────────────────────────
export const saveCrashLocally = async (payload) => {
  try {
    // ── User info (mobile number top-la vaikkurathukku) ──────────────
    let phoneNo = null;
    let userInfo = {};
    try {
      const session = await getSessionInfo();
      phoneNo = session?.phoneNo || session?.parsed?.UserInfo?.phoneNo || null;
      userInfo = {
        role: session?.parsed?.UserInfo?.role,
        email: session?.parsed?.UserInfo?.email,
        provider: session?.parsed?.UserInfo?.provider,
      };
    } catch (e) {
      console.log("⚠️ Could not fetch session info for crash log:", e.message);
    }

    // ── Structured entry: mobileNumber -> device -> app -> user -> error ──
    const entry = {
      localId: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),

      // ✅ Mobile number irundhaal mattum top-la add pannuvom
      ...(phoneNo ? { mobileNumber: phoneNo } : {}),

      device: {
        platform: Platform.OS,
        platformVersion: Platform.Version,
        model: DeviceInfo.getModel(),
        brand: DeviceInfo.getBrand(),
        systemName: DeviceInfo.getSystemName(),
        systemVersion: DeviceInfo.getSystemVersion(),
        deviceId: DeviceInfo.getDeviceId(),
        isTablet: DeviceInfo.isTablet(),
      },

      app: {
        appVersion: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber(),
        bundleId: DeviceInfo.getBundleId(),
      },

      user: userInfo,

      // ✅ Error/log details — level (LogLevel enum) + ella details-ku kீழey
      error: {
        level: payload.level || LogLevel.INFO,
        ...payload,
      },
    };

    const existing = await getLocalLogs();
    existing.push(entry);
    await saveLocalLogs(existing);

    console.log("📝 Crash saved locally:", entry.localId);

    // ✅ ERROR / CRITICAL / SECURITY level na, backend UserInfo.loglevel
    // um automatic-ah update pannுவோம் (background la, silent-ah, fail
    // aana kூda app flow ah affect pannaadhu)
    const escalationLevels = [LogLevel.ERROR, LogLevel.CRITICAL, LogLevel.SECURITY];
    console.log("🔍 Checking escalation for level:", entry.error?.level, "| should escalate:", escalationLevels.includes(entry.error?.level));
    if (escalationLevels.includes(entry.error?.level)) {
      console.log("🚀 Triggering updateUserLogLevel with:", entry.error.level);
      updateUserLogLevel(entry.error.level);
    }

    return entry;
  } catch (e) {
    console.log("❌ saveCrashLocally error:", e.message);
  }
};

/**
 * Backend UserInfo.loglevel field ah update pannум் (background, silent)
 */
const updateUserLogLevel = async (level) => {
  console.log("🔧 updateUserLogLevel STARTED with level:", level);
  try {
    const session = await getSessionInfo();
    console.log("🔧 session fetched | phoneNo:", session?.parsed?.UserInfo?.phoneNo);
    if (!session?.parsed?.UserInfo?.phoneNo) {
      console.log("🔧 ABORTED: no phoneNo found in session");
      return;
    }

    const payload = {
      ...session.parsed,
      UserInfo: {
        ...session.parsed.UserInfo,
        loglevel: level,
      },
    };

    console.log("🔧 calling saveUser with loglevel:", payload.UserInfo.loglevel);
    const result = await saveUser(payload);
    console.log("🔧 saveUser result:", JSON.stringify(result));
    if (result?.success) {
      console.log("✅ UserInfo.loglevel updated to:", level);
    } else {
      console.log("⚠️ saveUser returned failure:", result?.message);
    }
  } catch (e) {
    console.log("⚠️ updateUserLogLevel failed:", e.message);
  }
};

// ─────────────────────────────────────────────────────────────
// 2. SYNC LOCAL LOGS -> BACKEND (success aana local la irundhu delete)
// ─────────────────────────────────────────────────────────────
const SYNC_BATCH_SIZE = 80;

export const syncCrashLogs = async () => {
  const allLogs = await getLocalLogs();

  if (allLogs.length === 0) {
    console.log("✅ No local crash logs to sync.");
    return { synced: 0, failed: 0 };
  }

  // ✅ Occurrence order (oldest first) confirm pannurathukku timestamp vachi sort pannurom
  const sortedLogs = [...allLogs].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // ✅ Oru sync call la first 50 logs mattum anuppuvom (occurrence order la), mீgadhi local la remain aagum
  const logs = sortedLogs.slice(0, SYNC_BATCH_SIZE);
  const untouched = sortedLogs.slice(SYNC_BATCH_SIZE); // idha thodama vidurom

  const remaining = [...untouched];
  let syncedCount = 0;
  let failedCount = 0;

  for (const entry of logs) {
    try {
      const { localId, ...dataToSend } = entry;

      // ⚠️ Backend "addcrash" function expects body shape { data: {...} }
      //    (it does: const { data } = await c.req.json();)
      const res = await API1.post(CRASH_ENDPOINT, { data: dataToSend });

      if (res?.data?.success) {
        syncedCount++;
        // success -> remaining la add pannama vidurom (== delete from local)
      } else {
        failedCount++;
        remaining.push(entry);
      }
    } catch (e) {
      console.log("❌ sync failed for", entry.localId, ":", e.message);
      failedCount++;
      remaining.push(entry); // network/server issue -> local la retain
    }
  }

  await saveLocalLogs(remaining);
  console.log(`🔄 Crash sync done. Synced: ${syncedCount}, Pending: ${remaining.length} (batch size: ${SYNC_BATCH_SIZE})`);
  return { synced: syncedCount, failed: failedCount, pending: remaining.length };
};

// ─────────────────────────────────────────────────────────────
// 3. GLOBAL ERROR CAPTURE (JS errors + unhandled promise rejections)
// ─────────────────────────────────────────────────────────────
export const initCrashLogger = () => {
  // ✅ App open aana matter, session start log pannுவோம் — idhu than
  // app start aanadhukku andha proof-ah irukkும்
  logInfo("app_session_start", {
    startedAt: new Date().toISOString(),
  });

  const defaultHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    saveCrashLocally({
      type: "js_error",
      level: isFatal ? LogLevel.CRITICAL : LogLevel.ERROR,
      message: error?.message || String(error),
      stack: error?.stack || null,
      isFatal: !!isFatal,
    });

    defaultHandler(error, isFatal);
  });

  const rejectionTracking = require("promise/setimmediate/rejection-tracking");
  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: (id, error) => {
      saveCrashLocally({
        type: "unhandled_promise_rejection",
        level: LogLevel.WARN,
        message: error?.message || String(error),
        stack: error?.stack || null,
      });
    },
    onHandled: () => {},
  });

  // ✅ App open aana odane, oru sari sync try pannுவோம் (pending logs
  // irundha, network irundha udane anுப்பணும்)
  syncCrashLogs();

  // ✅ Network vandha udane auto-sync
  NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncCrashLogs();
    }
  });

  // ✅ Safety-net — network event miss aana kூda (flaky network la
  // idhu common), every 2 mins oru sari check pannும்
  setInterval(() => {
    syncCrashLogs();
  }, 2 * 60 * 1000);
};

// ─────────────────────────────────────────────────────────────
// 4. LEVEL-SPECIFIC LOG FUNCTIONS (backend LogLevel enum ku match)
// ─────────────────────────────────────────────────────────────
export const logInfo = (eventName, extraData = {}) => {
  return saveCrashLocally({
    type: "log",
    level: LogLevel.INFO,
    event: eventName,
    ...extraData,
  });
};

export const logWarn = (eventName, extraData = {}) => {
  return saveCrashLocally({
    type: "log",
    level: LogLevel.WARN,
    event: eventName,
    ...extraData,
  });
};

export const logError = (eventName, extraData = {}) => {
  return saveCrashLocally({
    type: "log",
    level: LogLevel.ERROR,
    event: eventName,
    ...extraData,
  });
};

export const logSecurity = (eventName, extraData = {}) => {
  return saveCrashLocally({
    type: "log",
    level: LogLevel.SECURITY,
    event: eventName,
    ...extraData,
  });
};

export const logCritical = (eventName, extraData = {}) => {
  return saveCrashLocally({
    type: "log",
    level: LogLevel.CRITICAL,
    event: eventName,
    ...extraData,
  });
};

// ✅ Backward-compatible — level illama call panna, default INFO
export const logEvent = (eventName, extraData = {}) => {
  return logInfo(eventName, extraData);
};

// ─────────────────────────────────────────────────────────────
// 5. GET ALL LOCAL LOGS (debug popup ku, e.g. logo 5-tap reveal)
// ─────────────────────────────────────────────────────────────
export const getAllLocalLogsForDebug = async () => {
  return await getLocalLogs();
};
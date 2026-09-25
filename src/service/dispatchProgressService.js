import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import API from '../api/api1';
import { enqueueAction } from './syncQueueService';

const keyFor = (dispatch_number) => `dispatch_progress:${dispatch_number}`;

export const getLocalProgress = async (dispatch_number) => {
  try {
    const raw = await AsyncStorage.getItem(keyFor(dispatch_number));
    return raw ? JSON.parse(raw) : { dispatchStatus: null, packages: {} };
  } catch (e) {
    console.warn('[dispatchProgress] getLocalProgress error:', e.message);
    return { dispatchStatus: null, packages: {} };
  }
};

const saveLocalProgress = async (dispatch_number, progress) => {
  try {
    await AsyncStorage.setItem(keyFor(dispatch_number), JSON.stringify(progress));
  } catch (e) {
    console.warn('[dispatchProgress] saveLocalProgress error:', e.message);
  }
};

// LogisticScreen calls this with a 3rd `meta` arg for the reject-reason
// popup (setLocalDispatchStatus(deal_id, 'rejected', { reason })).
// `dispatchStatus` uses the screen's own vocabulary — NOT the backend's:
// 'Accepted' | 'In-Progress' | 'picked' | 'Completed' | 'rejected'
// (getCardColumn() in LogisticScreen.jsx branches on these exact strings).
export const setLocalDispatchStatus = async (dispatch_number, dispatchStatus, meta) => {
  const progress = await getLocalProgress(dispatch_number);
  progress.dispatchStatus = dispatchStatus;
  if (meta) progress.meta = { ...(progress.meta || {}), ...meta };
  await saveLocalProgress(dispatch_number, progress);
  console.log('📦 Local dispatch status:', dispatch_number, '→', dispatchStatus);
  return progress;
};

// Generic — accepts whatever stage string the caller (e.g. LogisticDealCard's
// advancePackage) passes, and stamps `${stage}At`. Not hard-coded to a fixed
// list, since package-level local stages ('picked' for pickup, 'delivered'
// for drop-off per handleVerifyConfirmed) differ from the backend's own
// packed/shipped/delivered vocabulary.
export const setLocalPackageStage = async (dispatch_number, package_number, stage) => {
  const progress = await getLocalProgress(dispatch_number);
  const existing = progress.packages[package_number] || {};
  const stamp = new Date().toISOString();
  const stampKey = stage ? `${stage}At` : null;

  progress.packages[package_number] = {
    ...existing,
    stage,
    ...(stampKey ? { [stampKey]: stamp } : {}),
  };

  await saveLocalProgress(dispatch_number, progress);
  return progress;
};

export const setLocalPackageFormDone = async (dispatch_number, package_number) => {
  const progress = await getLocalProgress(dispatch_number);
  const existing = progress.packages[package_number] || {};
  progress.packages[package_number] = {
    ...existing,
    formDone: true,
    formDoneAt: new Date().toISOString(),
  };
  await saveLocalProgress(dispatch_number, progress);
  return progress;
};

// ─────────────────────────────────────────────────────────────
// MERGE — combine server cards with whatever local progress exists,
// so a pull-to-refresh never wipes out an optimistic local update that
// hasn't reached the backend yet (offline, or a 500 sitting in the queue).
// ─────────────────────────────────────────────────────────────
const DISPATCH_STAGE_RANK = {
  pending: 0,
  Accepted: 1,
  'In-Progress': 2,
  picked: 3,
  Completed: 4,
};

const normalizeServerStatus = (raw) => {
  const v = String(raw || '').toLowerCase().replace(/[-_\s]/g, '');
  if (v === 'accepted') return 'Accepted';
  if (v === 'inprogress' || v === 'processing') return 'In-Progress';
  if (v === 'picked' || v === 'shipped') return 'picked';
  if (v === 'delivered' || v === 'completed') return 'Completed';  // 👈 already lowercase pannitu compare pannuthu, so 'Delivered' automatic-a match aagum
  if (v === 'rejected') return 'rejected';
  return 'pending';
};

// null = unknown status, not "lowest" — caller decides what to do with that
const rankOf = (status, table) =>
  Object.prototype.hasOwnProperty.call(table, status) ? table[status] : null;

const pickHigherDispatchStatus = (serverStatus, localStatus) => {
  if (localStatus === 'rejected') return 'rejected'; // terminal, local-only — backend has no such status
  if (!localStatus) return serverStatus;
  if (!serverStatus) return localStatus;
  const localRank = rankOf(localStatus, DISPATCH_STAGE_RANK);
  const serverRank = rankOf(serverStatus, DISPATCH_STAGE_RANK);
  if (localRank == null || serverRank == null) return localStatus; // unknown shape → trust the optimistic local value
  return serverRank >= localRank ? serverStatus : localStatus;
};

export const mergeCardsWithLocalProgress = async (cards) => {
  if (!Array.isArray(cards)) return [];

  return Promise.all(
    cards.map(async (card) => {
      const dealId = card.deal_id;
      if (!dealId) return card;

      const local = await getLocalProgress(dealId);
      // 👇 FIX: server sends the REAL dispatch progress in `dispatch_status`
      // ('Accepted' | 'Delivered' | ...), NOT `status` (which is a separate,
      // unrelated lead-status field that's always 'pending' here). Prefer
      // dispatch_status when present, fall back to status for old records.
      const rawServerStatus = card.dispatch_status || card.status;
      const status = pickHigherDispatchStatus(normalizeServerStatus(rawServerStatus), local.dispatchStatus);

      const packages = Array.isArray(card.packages)
        ? card.packages.map((pkg) => {
            const localPkg = local.packages?.[pkg.package_number];
            if (!localPkg) return pkg;
            return { ...pkg, ...localPkg, status: localPkg.stage || pkg.status };
          })
        : card.packages;

      return { ...card, status, packages, localProgress: local };
    })
  );
};

// ─────────────────────────────────────────────────────────────
// REMOTE STATUS UPDATES — single endpoint, offline-safe.
// Backend route: PUT /logistic/update-shipment
// Body: { dispatch_number, package_number?, status }
//
// ⚠️ Backend's updateDispatchOrPackageStatus only accepts, for a
// dispatch-level update (no package_number): 'accepted' | 'picked' | 'delivered'.
// LogisticScreen also calls this with 'In-Progress' (on scan) and 'rejected'
// (on reject) — backend will 400 on those today. They won't crash the app
// (400s aren't queued/retried) but they will NOT persist server-side until
// the backend's status enum is extended to cover them.
// ─────────────────────────────────────────────────────────────
const UPDATE_SHIPMENT_URL = '/logistic/update-shipment';

const putDispatchStatus = async (body) => {
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (!isOnline) {
    console.log('📥 Offline — status update queued:', body);
    await enqueueAction({ method: 'put', url: UPDATE_SHIPMENT_URL, body });
    return null;
  }

  try {
    const res = await API.put(UPDATE_SHIPMENT_URL, body);
    return res?.data;
  } catch (e) {
    console.warn('⚠️ putDispatchStatus failed:', e?.response?.data || e.message);
    // Only queue for retry on server/network errors — a 400 (status value the
    // backend doesn't recognize) will never succeed on retry, so don't queue it.
    if (e?.response?.status >= 500 || !e?.response) {
      await enqueueAction({ method: 'put', url: UPDATE_SHIPMENT_URL, body });
    }
    return null;
  }
};

export const updateDispatchStatusRemote = (dispatch_number, status) =>
  putDispatchStatus({ dispatch_number: dispatch_number.toString(), status });

export const updatePackageStatusRemote = (dispatch_number, package_number, status) =>
  putDispatchStatus({
    dispatch_number: dispatch_number.toString(),
    package_number: package_number.toString(),
    status,
  });

// ─────────────────────────────────────────────────────────────
// ACCEPT — LOCAL FIRST + OFFLINE SAFE
// Local status uses the screen's 'Accepted' (capitalized) so
// getCardColumn() in LogisticScreen.jsx routes it into "In-Progress".
// Remote push uses the backend's lowercase 'accepted'.
// ─────────────────────────────────────────────────────────────
export const acceptDealLocalFirst = async (dispatch_number) => {
  await setLocalDispatchStatus(dispatch_number, 'Accepted');

  updateDispatchStatusRemote(dispatch_number, 'accepted').catch((e) => {
    console.warn('⚠️ accept push failed:', e?.message);
  });

  return { localStatus: 'Accepted' };
};
// ─────────────────────────────────────────────────────────────
// LOGOUT — wipe every local key this app writes, so the next login
// (even a different driver on the same device) never sees stale data.
// ─────────────────────────────────────────────────────────────
export const clearAllLocalLogisticData = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      (k) =>
        k.startsWith('dispatch_progress:') ||
        k === 'sync_queue:v1' ||
        k === 'sync:queue' ||
        k === 'delivery_photo_queue:v2' ||
        k === 'distance_synced_package_ids' ||
        k === 'logistic_is_on' ||
        k === 'last_known_location'
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
    console.log('🧹 Cleared local logistic data on logout:', keysToRemove.length, 'keys');
  } catch (e) {
    console.warn('[clearAllLocalLogisticData] error:', e.message);
  }
};
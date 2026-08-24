import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL PROGRESS STORE
// Every dispatch's client-side progress (accept / scan-verify / pickup /
// navigate / reached / deliver-verify / delivered) is mirrored here so that
// a pull-to-refresh or app restart NEVER wipes work the driver already did.
// Key format: 'dispatch_progress:<dispatch_number>'
// Shape:
// {
//   dispatchStatus: 'accepted' | 'inprogress' | 'picked' | 'completed',
//   packages: {
//     [package_number]: {
//       stage: 'pending' | 'pickup_verified' | 'picked' | 'reached' |
//              'delivery_verified' | 'delivered',
//       pickupVerifiedAt, pickedAt, reachedAt, deliveredAt
//     }
//   }
// }
// ─────────────────────────────────────────────────────────────────────────────

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

export const setLocalDispatchStatus = async (dispatch_number, dispatchStatus) => {
  const progress = await getLocalProgress(dispatch_number);
  progress.dispatchStatus = dispatchStatus;
  await saveLocalProgress(dispatch_number, progress);
  console.log('📦 Local dispatch status set:', dispatch_number, '→', dispatchStatus);
  return progress;
};

export const setLocalPackageStage = async (dispatch_number, package_number, stage) => {
  const progress = await getLocalProgress(dispatch_number);
  const existing = progress.packages[package_number] || {};
  const stamp = new Date().toISOString();
  const stampKey = {
    pickup_verified: 'pickupVerifiedAt',
    picked: 'pickedAt',
    reached: 'reachedAt',
    delivery_verified: 'deliveryVerifiedAt',
    delivered: 'deliveredAt',
  }[stage];

  progress.packages[package_number] = {
    ...existing,
    stage,
    ...(stampKey ? { [stampKey]: stamp } : {}),
  };
  await saveLocalProgress(dispatch_number, progress);
  return progress;
};

// STAGE RANK — used so a stale server response ('pending') never downgrades
// progress the driver already made locally.
const STAGE_RANK = {
  pending: 0,
  pickup_verified: 1,
  picked: 2,
  reached: 3,
  delivery_verified: 4,
  delivered: 5,
};
const DISPATCH_RANK = { pending: 0, accepted: 1, inprogress: 2, picked: 3, completed: 4 };

// Merge freshly-fetched dispatch cards with whatever local progress exists,
// always keeping the FURTHER-ALONG state. Call this right after you map the
// server response, before setNewAssignedCards(...).
export const mergeCardsWithLocalProgress = async (cards) => {
  return Promise.all(
    cards.map(async (card) => {
      const progress = await getLocalProgress(card.deal_id);
      if (!progress.dispatchStatus && Object.keys(progress.packages).length === 0) {
        return card; // nothing local — use server value as-is
      }

      const serverRank = DISPATCH_RANK[card.status] ?? 0;
      const localRank = DISPATCH_RANK[progress.dispatchStatus] ?? 0;
      const status = localRank > serverRank ? progress.dispatchStatus : card.status;

      const packages = (card.packages || []).map((pkg) => {
        const localPkg = progress.packages[pkg.package_number];
        if (!localPkg) return pkg;
        return { ...pkg, localStage: localPkg.stage, ...localPkg };
      });

      return { ...card, status, packages };
    })
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE STATUS CALLS — talks to updateDispatchOrPackageStatus on the backend.
// Route: logisticRoutes.put('/update-shipment', updateDispatchOrPackageStatus)
// ─────────────────────────────────────────────────────────────────────────────
const UPDATE_SHIPMENT_URL = '/logistic/update-shipment';

const putDispatchStatus = async (body) => {
  try {
    const res = await API.put(UPDATE_SHIPMENT_URL, body);
    return res?.data;
  } catch (e) {
    console.error('❌ putDispatchStatus failed:', e?.response?.data || e.message, body);
    return null;
  }
};

// status: 'packed' | 'shipped' | 'delivered' — pass package_number to target a package
export const updatePackageStatusRemote = (dispatch_number, package_number, status) =>
  putDispatchStatus({ dispatch_number, package_number, status });

// status: 'ready-to-ship' | 'shipped' | 'delivered' — dispatch-level (no package_number)
export const updateDispatchStatusRemote = (dispatch_number, status) =>
  putDispatchStatus({ dispatch_number, status });
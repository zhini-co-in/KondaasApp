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

export const setLocalDispatchStatus = async (dispatch_number, dispatchStatus) => {
  const progress = await getLocalProgress(dispatch_number);
  progress.dispatchStatus = dispatchStatus;
  await saveLocalProgress(dispatch_number, progress);
  console.log('📦 Local dispatch status:', dispatch_number, '→', dispatchStatus);
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

// Rank — local progress never gets downgraded by stale server data
const STAGE_RANK = {
  pending: 0,
  pickup_verified: 1,
  picked: 2,
  reached: 3,
  delivery_verified: 4,
  delivered: 5,
};

const DISPATCH_RANK = {
  pending: 0,
  accepted: 1,
  inprogress: 2,
  picked: 3,
  completed: 4,
};

export const mergeCardsWithLocalProgress = async (cards) => {
  return Promise.all(
    cards.map(async (card) => {
      const progress = await getLocalProgress(card.deal_id);

      if (!progress.dispatchStatus && Object.keys(progress.packages).length === 0) {
        return card;
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

// ─────────────────────────────────────────────────────────────
// ACCEPT — LOCAL FIRST + OFFLINE SAFE
// ─────────────────────────────────────────────────────────────
export const acceptDealLocalFirst = async (dispatch_number) => {
  // 1. Local update first (UI instantly changes)
  await setLocalDispatchStatus(dispatch_number, 'accepted');

  const body = {
    id: dispatch_number.toString(),
    status: 'Accepted', // Backend capital letter enum
  };

  // 2. Check network
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (isOnline) {
    // Online → fire in background (non-blocking)
    API.put('/logistic/update-products', body)
      .then(() => {
        console.log('✅ acceptDealLocalFirst: server confirmed', dispatch_number);
      })
      .catch(async (e) => {
        console.warn(
          '⚠️ acceptDealLocalFirst failed, queued:',
          e?.response?.data || e.message
        );
        await enqueueAction({
          method: 'put',
          url: '/logistic/update-products',
          body,
        });
      });
  } else {
    // Offline → just queue, no error
    console.log('📥 Offline — accept queued for', dispatch_number);
    await enqueueAction({
      method: 'put',
      url: '/logistic/update-products',
      body,
    });
  }

  return { localStatus: 'accepted' };
};

// ─────────────────────────────────────────────────────────────
// REMOTE STATUS UPDATES (also offline-safe)
// ─────────────────────────────────────────────────────────────
const UPDATE_SHIPMENT_URL = '/logistic/update-shipment';

const putDispatchStatus = async (body) => {
  const netState = await NetInfo.fetch();
  const isOnline =
    netState.isConnected === true && netState.isInternetReachable !== false;

  if (!isOnline) {
    console.log('📥 Offline — status update queued');
    await enqueueAction({ method: 'put', url: UPDATE_SHIPMENT_URL, body });
    return null;
  }

  try {
    const res = await API.put(UPDATE_SHIPMENT_URL, body);
    return res?.data;
  } catch (e) {
    console.warn('⚠️ putDispatchStatus failed, queued:', e?.response?.data || e.message);
    await enqueueAction({ method: 'put', url: UPDATE_SHIPMENT_URL, body });
    return null;
  }
};

export const updatePackageStatusRemote = (dispatch_number, package_number, status) =>
  putDispatchStatus({ dispatch_number, package_number, status });

export const updateDispatchStatusRemote = (dispatch_number, status) =>
  putDispatchStatus({ dispatch_number, status });
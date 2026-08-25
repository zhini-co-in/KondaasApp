import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import API from '../api/api1';

// ─────────────────────────────────────────────────────────────────────────────
// SYNC QUEUE
// Any backend call that fails (usually because there's no network) gets
// pushed here instead of just being logged and forgotten. The moment NetInfo
// reports the device is back online, everything in the queue gets replayed
// in order. Successful items are removed; failed items stay queued for the
// next retry. This is what makes "accept / scan / pickup / deliver" truly
// offline-first end to end, not just on the happy path.
//
// Queue item shape:
// {
//   id: string,            // unique id (timestamp + random)
//   method: 'put' | 'post', // http method on API (axios instance)
//   url: string,            // e.g. '/logistic/update-products'
//   body: object,           // request payload
//   createdAt: string,
//   attempts: number,
// }
// ─────────────────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'sync_queue:v1';
let isFlushing = false; // prevents overlapping flush runs
let netInfoUnsubscribe = null;

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[syncQueue] getQueue error:', e.message);
    return [];
  }
};

const saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[syncQueue] saveQueue error:', e.message);
  }
};

// Call this instead of just console.warn-ing on a failed API call.
// Usage:
//   API.put(url, body).catch(() => enqueueAction({ method: 'put', url, body }))
export const enqueueAction = async ({ method, url, body }) => {
  const queue = await getQueue();
  queue.push({
    id: genId(),
    method,
    url,
    body,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await saveQueue(queue);
  console.log('📥 [syncQueue] queued action:', method, url, body);
};

export const getQueueLength = async () => (await getQueue()).length;

// Replays every queued action in order. Stops trying an item once it
// succeeds; leaves it in the queue (with attempts incremented) if it fails
// again — so a still-flaky connection doesn't drop work.
export const flushQueue = async () => {
  if (isFlushing) return; // avoid double-flush from overlapping triggers
  isFlushing = true;

  try {
    let queue = await getQueue();
    if (queue.length === 0) return;

    console.log(`🔄 [syncQueue] flushing ${queue.length} queued action(s)...`);
    const remaining = [];

    for (const item of queue) {
      try {
        await API[item.method](item.url, item.body);
        console.log('✅ [syncQueue] synced:', item.method, item.url, item.body);
      } catch (e) {
        console.warn('⚠️ [syncQueue] still failing, will retry later:', item.url, e?.response?.data || e.message);
        remaining.push({ ...item, attempts: (item.attempts || 0) + 1 });
      }
    }

    await saveQueue(remaining);
    if (remaining.length === 0) {
      console.log('✅ [syncQueue] queue fully drained');
    }
  } finally {
    isFlushing = false;
  }
};

// Call ONCE, e.g. in App.js on mount. Wires up:
//  1) A NetInfo listener — the instant the device comes back online, flush.
//  2) An immediate flush attempt on startup (in case items were queued
//     while the app was closed and network is already available).
export const initSyncQueue = () => {
  if (netInfoUnsubscribe) return; // already initialised

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue();
    }
  });

  // Try once on app start too.
  NetInfo.fetch().then((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue();
    }
  });
};

export const teardownSyncQueue = () => {
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
};
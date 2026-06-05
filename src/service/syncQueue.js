// service/syncQueue.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';

const QUEUE_KEY = 'sync:queue';

// ─────────────────────────────────────────────────────────────────
// TYPES
// action: 'STATUS_UPDATE' | 'FORM_SUBMIT' | 'LEAD_EDIT' | 'LEAD_REJECT'
// payload: depends on action
// ─────────────────────────────────────────────────────────────────

const _loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const _saveQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.log('[SyncQueue] save error:', e);
  }
};

/**
 */
export const enqueue = async (id, action, payload) => {
  const queue = await _loadQueue();
  const idx = queue.findIndex((q) => q.id === id);
  const item = { id, action, payload, addedAt: Date.now() };
  if (idx >= 0) {
    queue[idx] = item; // overwrite existing
  } else {
    queue.push(item);
  }
  await _saveQueue(queue);
  console.log(`[SyncQueue] Enqueued: ${action} | id: ${id}`);
};

/**
 */
export const getQueue = async () => {
  return await _loadQueue();
};

/**
 */
export const processSyncQueue = async () => {
  const queue = await _loadQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  console.log(`[SyncQueue] Processing ${queue.length} pending items...`);

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await _executeAction(item);
      synced++;
      console.log(`[SyncQueue] ✓ Synced: ${item.action} | id: ${item.id}`);
    } catch (e) {
      failed++;
      remaining.push(item);
      console.log(`[SyncQueue] ✗ Failed (will retry): ${item.action} | id: ${item.id}`, e?.message);
    }
  }

  await _saveQueue(remaining);
  console.log(`[SyncQueue] Done. Synced: ${synced}, Failed: ${failed}, Remaining: ${remaining.length}`);
  return { synced, failed };
};

/**
 * 
 */
export const getPendingCount = async () => {
  const queue = await _loadQueue();
  return queue.length;
};

/**
 * 
 */
export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

// ─────────────────────────────────────────────────────────────────
// PRIVATE — action-ஐ API call-ஆ execute பண்ணு
// ─────────────────────────────────────────────────────────────────
const _executeAction = async (item) => {
  const { action, payload } = item;

  switch (action) {

    // Lead status update (accepted / inprogress / completed)
    case 'STATUS_UPDATE':
      await API.put('/order/updatestatus', {
        mobile: payload.mobile,
        status: payload.status,
      });
      break;

    // Site observation form submit
    case 'FORM_SUBMIT':
      await API.post('/user/add', payload.formData);
      // Status completed also
      await API.put('/order/updatestatus', {
        mobile: payload.mobile,
        status: 'completed',
      });
      break;

    // Lead field edit
    case 'LEAD_EDIT':
      await API.put('/order/update', payload);
      break;

 // Lead accept (with surveyor number)
    case 'ACCEPT_LEAD':
      await API.post('/order/accept', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      });
      break;

    // Lead reject
    case 'LEAD_REJECT':
      await API.post('/order/reject', {
        mobile: payload.mobile,
        reason: payload.reason,
      });
      break;

      // Lead inprogress (with surveyor number)
    case 'INPROGRESS_LEAD':
      await API.post('/order/inprogress', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      });
      break;

       // Lead completed (with surveyor number)
    case 'COMPLETED_LEAD':
      await API.post('/order/complete', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      });
      break;

    // Notification trigger
    case 'NOTIFICATION':
      await API.post('/notification/trigger', payload);
      break;

    default:
      console.log('[SyncQueue] Unknown action:', action);
  }
};
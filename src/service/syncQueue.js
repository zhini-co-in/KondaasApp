// service/syncQueue.js
// Net இல்லாத போது எல்லா API calls-ஐயும் இங்க save பண்ணு.
// Net வந்தப்போ processSyncQueue() call பண்ணு → எல்லாம் server-க்கு போகும்.

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
 * Offline action-ஐ queue-ல் add பண்ணு.
 * id: unique (leadId + action type combination)
 * Same id-ஐ again add பண்ணினால் overwrite ஆகும் (duplicate இல்லை).
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
 * Queue-ல் உள்ளதை பார்.
 */
export const getQueue = async () => {
  return await _loadQueue();
};

/**
 * Net வந்தப்போ இதை call பண்ணு.
 * Queue-ல் உள்ள எல்லா items-ஐயும் try பண்ணும்.
 * Success ஆனதை remove பண்ணும். Fail ஆனது next time retry ஆகும்.
 * Returns: { synced: number, failed: number }
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
 * Queue count — badge-க்கு use பண்ணலாம்.
 */
export const getPendingCount = async () => {
  const queue = await _loadQueue();
  return queue.length;
};

/**
 * Debug-க்கு மட்டும் — queue-ஐ clear பண்ணு.
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

    // Lead reject
    case 'LEAD_REJECT':
      await API.post('/order/reject', {
        mobile: payload.mobile,
        reason: payload.reason,
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
// service/syncQueue.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { deleteSavedFormData } from './Localleadsstorage';

const QUEUE_KEY = 'sync:queue';

// ─────────────────────────────────────────────────────────────────
// TYPES
// action: 'STATUS_UPDATE' | 'FORM_SUBMIT' | 'FORM_UPDATE' | 'LEAD_EDIT' | 'LEAD_REJECT'
//       | 'ACCEPT_LEAD' | 'INPROGRESS_LEAD' | 'COMPLETED_LEAD'
//       | 'NOTIFICATION' | 'JOB_COORDINATES' | 'FLOWTRIX_SYNC' | 'ORDER_COMPLETE'
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
    case 'FORM_SUBMIT': {
      const fd = new FormData();
      fd.append('data', JSON.stringify(payload.formData));

      // ✅ files-ஐயும் sync path-ல சேர்க்கணும் — இதுதான் missing piece
      const files = payload.filesByField || {};
      Object.entries(files).forEach(([fieldKey, fileList]) => {
        (fileList || []).forEach((file) => {
          fd.append(fieldKey, {
            uri: file.uri,
            name: file.name,
            type: file.type,
          });
        });
      });

      await API.post('/user/add', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Status completed also
      await API.put('/order/updatestatus', {
        mobile: payload.mobile,
        status: 'completed',
      });

      // ✅ Server-ல submit success ஆன உடனே local draft data (formData + files refs) delete
      if (payload.leadId) {
        await deleteSavedFormData(payload.leadId);
      }
      break;
    }

      // Site observation form update (edit mode, offline)
    case 'FORM_UPDATE': {
      const fd = new FormData();
      fd.append('data', JSON.stringify(payload.formData));

      // ✅ files-ஐயும் sync path-ல சேர்க்கணும்
      const files = payload.filesByField || {};
      Object.entries(files).forEach(([fieldKey, fileList]) => {
        (fileList || []).forEach((file) => {
          fd.append(fieldKey, {
            uri: file.uri,
            name: file.name,
            type: file.type,
          });
        });
      });

      await API.put(payload.url || '/user/update', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // ✅ Server-ல update success ஆன உடனே local draft data delete
      if (payload.leadId) {
        await deleteSavedFormData(payload.leadId);
      }
      break;
    }

    // Lead field edit
    case 'LEAD_EDIT':
      await API.put('/order/update', payload);
      break;

    // Lead accept (with surveyor number)
    // ✅ SurveyerScreen.handleAccept / notificationService.handleNotificationAccept
    // ஓட online flow-ஓட same 3 calls — queue-லயும் இதே 3-உம் run ஆகணும்
    case 'ACCEPT_LEAD':
      await API.post('/order/accept', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      });
      if (payload.dealId) {
        await API.put('/order/updatestatus', {
          id: payload.dealId,
          status: 'accepted',
        });
      }
      await API.post('/order/sync-status', {
        customerMobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
        status: 'accepted',
        receivedAt: payload.receivedAt || Date.now(),
      });
      break;

    // Lead reject
    // ✅ SurveyerScreen.confirmReject / notificationService.handleNotificationReject
    // ஓட same fields + dealId இருந்தா delete follow-up-உம் இங்கயே run ஆகணும்
    case 'LEAD_REJECT':
      await API.post('/order/reject', {
        customerMobile: payload.customerMobile || payload.mobile,
        name:           payload.name || '',
        address:        payload.address || '',
        surveyorNumber: payload.surveyorNumber,
        comment:        payload.comment || payload.reason || '',
        receivedAt:     payload.receivedAt || Date.now(),
      });
      if (payload.dealId) {
        await API.delete('/order/delete', { data: { dealId: payload.dealId } });
      }
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

    // 👇 புதுசா சேர்த்தது: Start → Reached exact lat/long pair
    // (Google Maps distance backend-ல calc பண்ண dealId-யோட save ஆகும்)
    case 'JOB_COORDINATES':
      await API.post('/location/distance', {
        dealId:   payload.dealId,
        startLat: payload.startLat,
        startLng: payload.startLng,
        endLat:   payload.endLat,
        endLng:   payload.endLng,
      });
      break;

    // 👇 புதுசா சேர்த்தது: Flowtrix status sync (accepted / inprogress / completed)
    case 'FLOWTRIX_SYNC':
      await API.post('/order/sync-status', payload);
      break;

    // 👇 புதுசா சேர்த்தது: Order completion tracking (admin_complete collection)
    case 'ORDER_COMPLETE':
      await API.post('/order/complete', payload);
      break;

    default:
      console.log('[SyncQueue] Unknown action:', action);
  }
};
// service/syncQueue.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { deleteSavedFormData } from './Localleadsstorage';

const QUEUE_KEY = 'sync:queue';
const DEFAULT_TIMEOUT = 60000; // 👈 all queued network calls get a timeout now

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

export const enqueue = async (id, action, payload) => {
  const queue = await _loadQueue();
  const idx = queue.findIndex((q) => q.id === id);
  const item = { id, action, payload, addedAt: Date.now() };
  if (idx >= 0) {
    queue[idx] = item;
  } else {
    queue.push(item);
  }
  await _saveQueue(queue);
  console.log(`[SyncQueue] Enqueued: ${action} | id: ${id}`);
};

export const getQueue = async () => {
  return await _loadQueue();
};

export const getPendingCount = async () => {
  const queue = await _loadQueue();
  return queue.length;
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

// 👇 புதுசா சேர்த்தது: ஒரு queue item-ன payload-ஐ (partial-progress flags
// உட்பட) update பண்ணி persist பண்ணும் helper. Multi-step actions
// (FORM_SUBMIT / FORM_UPDATE) நடுவுல fail ஆகி retry ஆகும்போது, already
// success ஆன step மறுபடியும் நடக்காம இதுவே தடுக்கும் — இல்லாட்டி
// network drop ஆகும் ஒவ்வொரு தடவையும் duplicate lead record போகும்.
const _persistQueueItemPayload = async (itemId, updatedPayload) => {
  const queue = await _loadQueue();
  const idx = queue.findIndex((q) => q.id === itemId);
  if (idx >= 0) {
    queue[idx].payload = updatedPayload;
    await _saveQueue(queue);
  }
};

// 👇 புதுசா சேர்த்தது: ஒரே நேரத்துல processSyncQueue() 2 தடவை run ஆகாம
// தடுக்க (network listener + periodic retry + manual trigger — மூணும்
// ஒரே நேரத்துல fire ஆகலாம், அப்போ duplicate POST போகக்கூடாது).
let isSyncing = false;

export const processSyncQueue = async () => {
  if (isSyncing) {
    console.log('[SyncQueue] Already syncing, skip this call.');
    return { synced: 0, failed: 0, skipped: true };
  }
  isSyncing = true;

  try {
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
        console.log('[SyncQueue] Failed body:', item.payload);
        console.log('[SyncQueue] Failed response:', e?.response?.data);
      }
    }

    await _saveQueue(remaining);
    console.log(`[SyncQueue] Done. Synced: ${synced}, Failed: ${failed}, Remaining: ${remaining.length}`);
    return { synced, failed };
  } finally {
    isSyncing = false;
  }
};

const _executeAction = async (item) => {
  const { action, payload } = item;

  switch (action) {

    case 'STATUS_UPDATE': {
  const statusId = payload.id || payload.dealId;
  if (!statusId) {
    console.log('[SyncQueue] STATUS_UPDATE dropped — missing id/dealId:', payload);
    break; // don't throw → item won't go into `remaining`, so it's dropped instead of retried forever
  }
  await API.put('/order/updatestatus', {
    id: statusId,
    mobile: payload.mobile,
    status: payload.status,
  }, { timeout: DEFAULT_TIMEOUT });
  break;
}

    // ✅ FIX: idempotent — /user/add already success ஆகி, அடுத்த
    // updatestatus மட்டும் fail ஆகி இருந்தா, retry-ல /user/add மறுபடியும்
    // போகாது (payload._uploadDone flag check). இதுவே duplicate lead
    // record வராம தடுக்கும்.
    case 'FORM_SUBMIT': {
      if (!payload._uploadDone) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload.formData));

        const files = payload.filesByField || {};
        Object.entries(files).forEach(([fieldKey, fileList]) => {
          (fileList || []).forEach((file) => {
            fd.append(fieldKey, { uri: file.uri, name: file.name, type: file.type });
          });
        });

        await API.post('/user/add', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000, // 👈 files இருக்கு, bigger timeout
        });

        // Upload success ஆனதும் odane flag persist பண்ணு — இதுக்கு பிறகு
        // action fail ஆனாலும், retry இந்த block-ஐ skip பண்ணிடும்.
        payload._uploadDone = true;
        await _persistQueueItemPayload(item.id, payload);
      }

      await API.put('/order/updatestatus', {
        id: payload.dealId || payload.deal_id,
        mobile: payload.mobile,
        status: 'completed',
      }, { timeout: DEFAULT_TIMEOUT });

      if (payload.leadId) {
        await deleteSavedFormData(payload.leadId);
      }
      break;
    }

    // ✅ FIX: அதே idempotency guard update-க்கும் — duplicate PUT calls
    // (signature re-processing, file re-upload) தடுக்க.
    case 'FORM_UPDATE': {
      if (!payload._uploadDone) {
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload.formData));

        const files = payload.filesByField || {};
        Object.entries(files).forEach(([fieldKey, fileList]) => {
          (fileList || []).forEach((file) => {
            fd.append(fieldKey, { uri: file.uri, name: file.name, type: file.type });
          });
        });

        await API.put(payload.url || '/user/update', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000,
        });

        payload._uploadDone = true;
        await _persistQueueItemPayload(item.id, payload);
      }

      if (payload.leadId) {
        await deleteSavedFormData(payload.leadId);
      }
      break;
    }

    case 'LEAD_EDIT':
      await API.put('/order/update', payload, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'ACCEPT_LEAD':
      await API.post('/order/accept', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      }, { timeout: DEFAULT_TIMEOUT });
      if (payload.dealId) {
        await API.put('/order/updatestatus', {
          id: payload.dealId,
          status: 'accepted',
        }, { timeout: DEFAULT_TIMEOUT });
      }
      await API.post('/order/sync-status', {
        customerMobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
        status: 'accepted',
        receivedAt: payload.receivedAt || Date.now(),
      }, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'LEAD_REJECT':
      await API.post('/order/reject', {
        customerMobile: payload.customerMobile || payload.mobile,
        name: payload.name || '',
        address: payload.address || '',
        surveyorNumber: payload.surveyorNumber,
        comment: payload.comment || payload.reason || '',
        receivedAt: payload.receivedAt || Date.now(),
      }, { timeout: DEFAULT_TIMEOUT });
      if (payload.dealId) {
        await API.delete('/order/delete', { data: { dealId: payload.dealId }, timeout: DEFAULT_TIMEOUT });
      }
      break;

    case 'INPROGRESS_LEAD':
      await API.post('/order/inprogress', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      }, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'COMPLETED_LEAD':
      await API.post('/order/complete', {
        mobile: payload.mobile,
        surveyorNumber: payload.surveyorNumber,
      }, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'NOTIFICATION':
      await API.post('/notification/trigger', payload, { timeout: DEFAULT_TIMEOUT });
      break;

    // ✅ JOB_COORDINATES — coordinates only
    case 'JOB_COORDINATES':
      await API.post('/location/distance', {
        dealId: payload.dealId,
        startLat: payload.startLat,
        startLng: payload.startLng,
        endLat: payload.endLat,
        endLng: payload.endLng,
      }, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'DEAL_DISTANCE': {
      const body = {
        deal_id:       String(payload.deal_id || payload.dealId || ''),
        deal_name:     String(payload.deal_name || payload.dealName || ''),
        mobile:        String(payload.mobile || ''),
        surveyor_name: String(payload.surveyor_name || payload.surveyorName || 'Surveyor'),
        to_site:       String(payload.to_site || payload.toSite || ''),
      };
      if (payload.to_office || payload.toOffice) {
        body.to_office = String(payload.to_office || payload.toOffice);
      }
      if (payload.to_home || payload.toHome) {
        body.to_home = String(payload.to_home || payload.toHome);
      }

      console.log('[SyncQueue] DEAL_DISTANCE sending:', JSON.stringify(body));

      if (!body.deal_id || !body.deal_name || !body.mobile || !body.to_site) {
        throw new Error('DEAL_DISTANCE missing required fields');
      }

      // Axios skip — direct fetch (same URL curl used → 201)
      const res = await fetch('https://kondaas.atom8itsolutions.com/location/distance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}

      console.log('[SyncQueue] DEAL_DISTANCE fetch result:', res.status, data || text);

      if (res.status === 409 || String(data?.error || '').toLowerCase().includes('already exists')) {
        console.log('[SyncQueue] DEAL_DISTANCE already exists — treating as synced');
        return;
      }

      if (!res.ok) {
        throw new Error(`DEAL_DISTANCE failed ${res.status}: ${text}`);
      }
      break;
    }

    case 'FLOWTRIX_SYNC':
      await API.post('/order/sync-status', payload, { timeout: DEFAULT_TIMEOUT });
      break;

    case 'ORDER_COMPLETE':
      await API.post('/order/complete', payload, { timeout: DEFAULT_TIMEOUT });
      break;

    default:
      console.log('[SyncQueue] Unknown action:', action);
  }
};
// service/syncQueue.js

import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';
import { deleteSavedFormData } from './Localleadsstorage';
import { apiFetch } from '../api/apiClient';
import { onFormSynced, isFormPendingSync } from './deferredNotif';
import { getDistancePoints } from './dealDistancePoints';
const FORM_GATED_PREFIXES = ['status_completed_', 'order_complete_', 'notif_completed_'];
const QUEUE_KEY = 'sync:queue';
const DEFAULT_TIMEOUT = 60000; // 👈 all queued network calls get a timeout now
// Backend returns 400 + "Deal already Done!" when the form is already saved
const isAlreadyExistsError = (e) => {
  const msg = String(
    e?.response?.data?.error || e?.response?.data?.message || e?.message || ''
  ).toLowerCase();
  return (
    e?.response?.status === 409 ||
    msg.includes('already done') ||
    msg.includes('already exists')
  );
};

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
      const prefix = FORM_GATED_PREFIXES.find((p) => item.id.startsWith(p));
if (prefix) {
  const gatedLeadId = item.id.slice(prefix.length);
  if (await isFormPendingSync(gatedLeadId)) {
    remaining.push(item);   // form sync aagura varaikum wait
    continue;
  }
}
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

        const processedIds = new Set(queue.map((q) => q.id));
    const latest = await _loadQueue();
    const newlyAdded = latest.filter((q) => !processedIds.has(q.id));
    await _saveQueue([...remaining, ...newlyAdded]);
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

        try {
  await API.post('/user/add', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });
} catch (e) {
  if (!isAlreadyExistsError(e)) throw e; // vera error na retry
  console.log('[SyncQueue] FORM_SUBMIT already saved on server, treating as uploaded');
}

payload._uploadDone = true;
await _persistQueueItemPayload(item.id, payload);
      }

      try {
        await onFormSynced(payload.leadId);
      } catch (e) {
        console.log('[SyncQueue] onFormSynced failed (non-fatal):', e?.message);
      }

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
  if (payload.dealId) {
    await API.put('/order/updatestatus', {
      id: payload.dealId,
      status: 'Accepted',
    }, { timeout: DEFAULT_TIMEOUT });
  }
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

    case 'Completed_LEAD':
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
  let { start_latitude, start_longitude, site_latitude, site_longitude } = payload;

  // payload-la coordinates illa-na AsyncStorage-la irundhu edu
  if ((start_latitude == null || site_latitude == null) && payload.leadId) {
    const { start, site } = await getDistancePoints(payload.leadId);
    start_latitude  = start_latitude  ?? start?.latitude;
    start_longitude = start_longitude ?? start?.longitude;
    site_latitude   = site_latitude   ?? site?.latitude;
    site_longitude  = site_longitude  ?? site?.longitude;
  }

  const body = {
    deal_id:       String(payload.deal_id || payload.dealId || ''),
    deal_name:     String(payload.deal_name || payload.dealName || ''),
    mobile:        String(payload.mobile || ''),
    surveyor_name: String(payload.surveyor_name || payload.surveyorName || 'Surveyor'),
    start_latitude, start_longitude, site_latitude, site_longitude,
  };
  if (payload.to_office || payload.toOffice) body.to_office = String(payload.to_office || payload.toOffice);
  if (payload.to_home || payload.toHome)     body.to_home   = String(payload.to_home || payload.toHome);

  if (!body.deal_id || !body.deal_name || !body.mobile) {
    throw new Error('DEAL_DISTANCE missing required fields');
  }

  const missingCoords = [start_latitude, start_longitude, site_latitude, site_longitude]
    .some((v) => v === undefined || v === null);
  if (missingCoords) {
    console.log('[SyncQueue] DEAL_DISTANCE dropped, coordinates missing:', body);
    break;
  }

  const res = await apiFetch('/location/distance', { method: 'POST', body });
  const data = res.data;

  console.log('[SyncQueue] DEAL_DISTANCE result:', res.status, data);

  if (res.status === 409 || String(data?.error || '').toLowerCase().includes('already exists')) {
    return;
  }
  if (!res.ok) throw new Error(`DEAL_DISTANCE failed ${res.status}: ${JSON.stringify(data)}`);
  break;
}

    case 'ORDER_COMPLETE':
      await API.post('/order/complete', payload, { timeout: DEFAULT_TIMEOUT });
      break;

    default:
      console.log('[SyncQueue] Unknown action:', action);
  }
};
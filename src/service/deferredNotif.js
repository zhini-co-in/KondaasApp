import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';

const PENDING_FORM      = (id) => `form_pending_sync_${id}`;
const SYNCED_FORM       = (id) => `form_synced_${id}`;
const DEFERRED_N4       = (id) => `deferred_notif4_${id}`;
const DEFERRED_COMPLETE = (id) => `deferred_complete_${id}`;

export const markFormPendingSync = (leadId) =>
  AsyncStorage.setItem(PENDING_FORM(leadId), '1');

export const isFormPendingSync = async (leadId) =>
  (await AsyncStorage.getItem(PENDING_FORM(leadId))) === '1';

export const isFormSynced = async (leadId) =>
  (await AsyncStorage.getItem(SYNCED_FORM(leadId))) === '1';

export const clearFormPending = (leadId) =>
  AsyncStorage.removeItem(PENDING_FORM(leadId));

export const saveDeferredNotif4 = (leadId, payload) =>
  AsyncStorage.setItem(DEFERRED_N4(leadId), JSON.stringify(payload));

export const saveDeferredCompletion = (leadId, data) =>
  AsyncStorage.setItem(DEFERRED_COMPLETE(leadId), JSON.stringify(data));

export const onFormSynced = async (leadId) => {
  if (!leadId) return;
  await AsyncStorage.setItem(SYNCED_FORM(leadId), '1');
  await AsyncStorage.removeItem(PENDING_FORM(leadId));

  const { enqueue } = require('./syncQueue'); // lazy → circular import avoid

  // 1. Hold-la irundha Completed status + order/complete
  const rawC = await AsyncStorage.getItem(DEFERRED_COMPLETE(leadId));
  if (rawC) {
    await AsyncStorage.removeItem(DEFERRED_COMPLETE(leadId));
    const { status, orderComplete } = JSON.parse(rawC);
    try {
      await API.put('/order/updatestatus', status, { timeout: 30000 });
    } catch (e) {
      await enqueue(`status_completed_${leadId}`, 'STATUS_UPDATE', status);
    }
    try {
      await API.post('/order/complete', orderComplete, { timeout: 30000 });
    } catch (e) {
      await enqueue(`order_complete_${leadId}`, 'ORDER_COMPLETE', orderComplete);
    }
  }

  // 2. Hold-la irundha scenario 4
  const raw = await AsyncStorage.getItem(DEFERRED_N4(leadId));
  if (!raw) return;
  const payload = JSON.parse(raw);
  await AsyncStorage.removeItem(DEFERRED_N4(leadId));
  try {
    await API.post('/notification/trigger', payload, { timeout: 30000 });
  } catch (e) {
    await enqueue(`notif_completed_${leadId}`, 'NOTIFICATION', payload);
  }
};
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api1';

const PENDING_FORM = (id) => `form_pending_sync_${id}`;
const DEFERRED_N4  = (id) => `deferred_notif4_${id}`;

export const markFormPendingSync = (leadId) =>
  AsyncStorage.setItem(PENDING_FORM(leadId), '1');

export const isFormPendingSync = async (leadId) =>
  (await AsyncStorage.getItem(PENDING_FORM(leadId))) === '1';

export const saveDeferredNotif4 = (leadId, payload) =>
  AsyncStorage.setItem(DEFERRED_N4(leadId), JSON.stringify(payload));

// Form server-ku poyidichu → flag clear + hold-la irundha scenario 4 fire
export const onFormSynced = async (leadId) => {
  if (!leadId) return;
  await AsyncStorage.removeItem(PENDING_FORM(leadId));
  const raw = await AsyncStorage.getItem(DEFERRED_N4(leadId));
  if (!raw) return;
  const payload = JSON.parse(raw);
  await AsyncStorage.removeItem(DEFERRED_N4(leadId));
  try {
    await API.post('/notification/trigger', payload, { timeout: 30000 });
  } catch (e) {
    const { enqueue } = require('./syncQueue'); // lazy → circular import avoid
    await enqueue(`notif_completed_${leadId}`, 'NOTIFICATION', payload);
  }
};
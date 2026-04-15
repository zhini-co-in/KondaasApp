// localLeadsStorage.js
// Accept பண்ணின leads மட்டும் AsyncStorage-ல save ஆகும்

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCEPTED_KEY = 'leads:accepted';

// ── Accept பண்ணின lead-ஐ save பண்ணு ─────────────────────────────────────
export const saveAcceptedLead = async (item) => {
  try {
    const existing = await getAcceptedLeads();
    const alreadyExists = existing.some((l) => l.id === item.id);
    if (alreadyExists) return existing;

    const updated = [...existing, { ...item, status: 'accepted' }];
    await AsyncStorage.setItem(ACCEPTED_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.log('saveAcceptedLead error:', e);
    return [];
  }
};

// ── Local-ல save ஆன accepted leads-ஐ load பண்ணு ─────────────────────────
export const getAcceptedLeads = async () => {
  try {
    const raw = await AsyncStorage.getItem(ACCEPTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.log('getAcceptedLeads error:', e);
    return [];
  }
};

// ── ஒரு accepted lead-ஓட status-ஐ update பண்ணு (inprogress / completed) ─
export const updateAcceptedLeadStatus = async (leadId, status) => {
  try {
    const existing = await getAcceptedLeads();
    const updated = existing.map((l) =>
      l.id === leadId ? { ...l, status } : l
    );
    await AsyncStorage.setItem(ACCEPTED_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.log('updateAcceptedLeadStatus error:', e);
    return [];
  }
};

// ── Logout-ல clear பண்ணு ─────────────────────────────────────────────────
export const clearAcceptedLeads = async () => {
  await AsyncStorage.removeItem(ACCEPTED_KEY);
};
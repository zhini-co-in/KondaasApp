// service/localLeadsStorage.js
// Lead status + form data-வும் local-ல் save ஆகும்.
// Full offline support.

import AsyncStorage from '@react-native-async-storage/async-storage';

const LEADS_KEY    = 'leads:accepted';   // accepted/inprogress/completed leads
const TEMPLATE_KEY = 'leads:template';   // cached form template
const FORMS_KEY    = 'leads:forms';      // submitted form data (offline)

// ─────────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────────

const _load = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.log(`[Localleads] load error (${key}):`, e);
    return null;
  }
};

const _save = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log(`[Localleads] save error (${key}):`, e);
  }
};

// ─────────────────────────────────────────────────────────────────
// LEADS — accept / status / fields
// ─────────────────────────────────────────────────────────────────

export const getAcceptedLeads = async () => {
  return (await _load(LEADS_KEY)) ?? [];
};

/**
 * Lead-ஐ accept பண்ணி save பண்ணு (duplicate check உள்ளது).
 */
export const saveAcceptedLead = async (item) => {
  const existing = await getAcceptedLeads();
  if (existing.some((l) => l.id === item.id)) return existing;
  const updated = [...existing, { ...item, status: 'accepted' }];
  await _save(LEADS_KEY, updated);
  return updated;
};

/**
 * Lead status மட்டும் update பண்ணு.
 * status: 'accepted' | 'inprogress' | 'completed'
 */
export const updateAcceptedLeadStatus = async (leadId, status) => {
  const existing = await getAcceptedLeads();
  const updated = existing.map((l) =>
    l.id === leadId ? { ...l, status } : l
  );
  await _save(LEADS_KEY, updated);
  return updated;
};

/**
 * Lead fields update பண்ணு (edit modal).
 */
export const updateAcceptedLeadFields = async (leadId, fields) => {
  const existing = await getAcceptedLeads();
  const updated = existing.map((l) =>
    l.id === leadId ? { ...l, ...fields } : l
  );
  await _save(LEADS_KEY, updated);
  return updated;
};

/**
 * Status-வை வச்சு filter.
 */
export const getLeadsByStatus = async (status) => {
  const all = await getAcceptedLeads();
  return all.filter((l) => l.status === status);
};

/**
 * API server leads + local leads merge.
 * Offline-ல் செய்த actions (status changes) போகாது.
 */
export const mergeWithServerLeads = async (serverLeads) => {
  const local = await getAcceptedLeads();

  const localMap = {};
  local.forEach((l) => { localMap[l.id] = l; });

  // Server lead-க்கு local data merge பண்ணு
  const merged = serverLeads.map((sl) => {
    const ll = localMap[sl.id];
    if (!ll) return sl;
    // Local status-ஐ trust பண்ணு (offline action இருக்கலாம்)
    // But server says 'completed' → always trust server
    const finalStatus = sl.status === 'completed' ? 'completed' : ll.status;
    return { ...ll, ...sl, status: finalStatus };
  });

  // Local-only leads (server-ல் இல்லாதது — offline accept)
  const serverIds = new Set(serverLeads.map((s) => s.id));
  const localOnly = local.filter((ll) => !serverIds.has(ll.id));

  const final = [...merged, ...localOnly];
  await _save(LEADS_KEY, final);
  return final;
};

/**
 * Logout-ல் clear பண்ணு.
 */
export const clearAcceptedLeads = async () => {
  await AsyncStorage.removeItem(LEADS_KEY);
};

// ─────────────────────────────────────────────────────────────────
// FORM TEMPLATE — local cache
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch பண்ணிய template-ஐ local-ல் cache பண்ணு.
 * Next time net இல்லாட்டி இதை use பண்ணு.
 */
export const cacheTemplate = async (template) => {
  await _save(TEMPLATE_KEY, { template, cachedAt: Date.now() });
};

/**
 * Cache-ல் இருக்கும் template-ஐ return பண்ணு.
 * இல்லாட்டி null return பண்ணும்.
 */
export const getCachedTemplate = async () => {
  const data = await _load(TEMPLATE_KEY);
  return data?.template ?? null;
};

// ─────────────────────────────────────────────────────────────────
// FORM DATA — offline submit save
// ─────────────────────────────────────────────────────────────────

/**
 * Form submit ஆனதை local-ல் save பண்ணு.
 * Net வந்தப்போ syncQueue process பண்ணும்.
 */
export const saveFormDataLocally = async (leadId, formData) => {
  const existing = (await _load(FORMS_KEY)) ?? {};
  existing[leadId] = {
    formData,
    savedAt: Date.now(),
    synced: false,
  };
  await _save(FORMS_KEY, existing);
};

/**
 * ஒரு lead-ஓட form data synced-ஆ mark பண்ணு.
 */
export const markFormSynced = async (leadId) => {
  const existing = (await _load(FORMS_KEY)) ?? {};
  if (existing[leadId]) {
    existing[leadId].synced = true;
    await _save(FORMS_KEY, existing);
  }
};

/**
 * Unsynced form data-ஐ return பண்ணு.
 * syncQueue.js-ல் இருந்து use ஆகும்.
 */
export const getUnsyncedForms = async () => {
  const all = (await _load(FORMS_KEY)) ?? {};
  return Object.entries(all)
    .filter(([, v]) => !v.synced)
    .map(([leadId, v]) => ({ leadId, ...v }));
};

/**
 * ஒரு lead-ஓட saved form data return பண்ணு (draft restore-க்கு).
 */
export const getSavedFormData = async (leadId) => {
  const all = (await _load(FORMS_KEY)) ?? {};
  return all[leadId]?.formData ?? null;
};
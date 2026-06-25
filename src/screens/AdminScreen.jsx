import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform, FlatList, Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Contacts from 'react-native-contacts';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { useFocusEffect } from '@react-navigation/native';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';

const fmtDate = val => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
};

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

const normaliseGeneral = (raw, index) => {
  const siteStatus = (raw.siteSurveyStatus || '').toLowerCase();
  const fallbackStatus = (raw.status || 'notassigned').toLowerCase();
  const resolvedStatus = siteStatus || fallbackStatus;
  return {
    id:             raw._id || raw.id || String(index),
    zohoId:         raw.deal_id || raw.id || raw._id || null,
    mongoId:        raw._id || null,
    name:           raw.deal_name || raw.name || raw.customerName || '—',
    phone:          raw.mobile || raw.phone || raw.customerMobile || '—',
    city:           raw.city || '—',
    referredBy:     raw.referredBy || raw.referred_by || 'N/A',
    surveyorNumber: raw.assignedTo || raw.surveyorNumber || raw.surveyor || '—',
    comment:        raw.comment || raw.completionReason || raw.reason || raw.rejectReason || '—',
    loanType:       raw.loanType || raw.loan_type || raw.kilovolt || null,
    amount:         raw.amount || null,
    date:           fmtDate(raw.assignedAt || raw.createdAt || raw.date),
    rawDate:        raw.assignedAt || raw.createdAt || raw.date || null,
    status:         resolvedStatus,
    assignedBy:     raw.assignedBy || raw.assigned_by || '',
    logisticAssignee:  raw.logisticAssignee || '',
    installerAssignee: raw.installerAssignee || '',
    deal_id:        raw.deal_id || null,
    address:        raw.address || '—',
    latitude:       raw.latitude || null,
    longitude:      raw.longitude || null,
    whatsappNo:     raw.whatsappNo || null,
    email:          raw.email || null,
  };
};

const normalise = (raw, index) => ({
  id:             raw._id || raw.id || String(index),
  zohoId:         raw.deal_id || raw.id || raw._id || null,
  mongoId:        raw._id || null,
  name:           raw.deal_name || raw.name || raw.customerName || '—',
  phone:          raw.mobile || raw.phone || raw.customerMobile || '—',
  city:           raw.city || '—',
  referredBy:     raw.referredBy || raw.referred_by || 'N/A',
  surveyorNumber: raw.assignedTo || raw.surveyorNumber || raw.surveyor || '—',
  comment:        raw.comment || raw.completionReason || raw.reason || raw.rejectReason || '—',
  loanType:       raw.loanType || raw.loan_type || raw.kilovolt || null,
  amount:         raw.amount || null,
  date:           fmtDate(raw.assignedAt || raw.createdAt || raw.date || raw.time),
  rawDate:        raw.assignedAt || raw.createdAt || raw.date || raw.time || null,
  status:         'completed',
  assignedBy:     raw.assignedBy || raw.assigned_by || '',
  logisticAssignee:  raw.logisticAssignee || '',
  installerAssignee: raw.installerAssignee || '',
  deal_id:        raw.deal_id || null,
});

const styles = StyleSheet.create({
  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: '#C8000A',
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  logoText: { fontSize: 18, fontWeight: '900', color: '#C8000A', letterSpacing: -1 },
  brandName: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  brandSub: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginTop: 1 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statBox: {
  flex: 1, borderRadius: 12, padding: 10,
  alignItems: 'center',
},
  statDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 5 },
  statNum: { fontSize: 18, fontWeight: '800', color: '#fff', lineHeight: 20 },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.2 },
  // ── Filter row inside header ───────────────────────────────────────────────
  headerFilterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  headerFilterBtn: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerFilterBtnActive: {
    backgroundColor: '#fff',
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#C8000A',
  },
  filterBadgeActive: {
    backgroundColor: '#C8000A',
    borderColor: '#fff',
  },
  filterBadgeText: { fontSize: 8, fontWeight: '900', color: '#C8000A' },
  filterBadgeTextActive: { color: '#fff' },
  // ── Active employee bar ────────────────────────────────────────────────────
  activeFilterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3F3',
    paddingHorizontal: 16, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F0CECE',
  },
  activeFilterLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activeFilterText: { fontSize: 12, color: '#A32D2D', fontWeight: '600' },
  clearFilterText: { fontSize: 12, color: '#A32D2D', textDecorationLine: 'underline', fontWeight: '600' },
  // ── Search ─────────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: '#EAEAEA',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 12, color: '#333', backgroundColor: '#F9F9FB',
  },
  // ── Date bar ──────────────────────────────────────────────────────────────
  dateBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#EAEAEA', backgroundColor: '#fff',
  },
  dateChipActive: { backgroundColor: '#C8000A', borderColor: '#C8000A' },
  dateChipText: { fontSize: 11, fontWeight: '600', color: '#888' },
  calBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center', justifyContent: 'center',
  },
  customRange: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  rangeLbl: { fontSize: 11, color: '#aaa' },
  rangeInput: {
    flex: 1, borderWidth: 1, borderColor: '#EAEAEA',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
    fontSize: 12, color: '#333',
  },
  rangeSep: { fontSize: 12, color: '#aaa' },
  applyBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#C8000A', borderRadius: 8 },
  resultBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3F3',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#F0CECE',
  },
  resultTxt: { fontSize: 11, color: '#A32D2D', fontWeight: '600' },
  clearTxt: { fontSize: 11, color: '#A32D2D', textDecorationLine: 'underline' },
  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4, marginBottom: 2,
  },
  cardStripe: { height: 5 },
  cardInner: { padding: 16 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16, gap: 10,
  },
  refTag: {
    backgroundColor: '#FAEEDA', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 0.5, borderColor: '#F0D699', flex: 1,
  },
  refTagText: { fontSize: 10.5, color: '#854F0B', fontWeight: '500' },
  badgeBase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeDone:          { backgroundColor: '#EAF3DE', borderWidth: 1, borderColor: '#D1E9B8' },
  badgeDoneText:      { fontSize: 11, fontWeight: '700', color: '#27500A', letterSpacing: 0.2 },
  badgeRejected:      { backgroundColor: '#FCEBEB', borderWidth: 1, borderColor: '#F5CDCD' },
  badgeRejectedText:  { fontSize: 11, fontWeight: '700', color: '#791F1F', letterSpacing: 0.2 },
  badgeOther:         { backgroundColor: '#E6F1FB', borderWidth: 1, borderColor: '#B5D4F4' },
  badgeOtherText:     { fontSize: 11, fontWeight: '700', color: '#0C447C', letterSpacing: 0.2 },
  badgeInProg:        { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' },
  badgeInProgText:    { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 0.2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  av: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avDone:     { backgroundColor: '#EAF3DE' },
  avRejected: { backgroundColor: '#FCEBEB' },
  avOther:    { backgroundColor: '#E6F1FB' },
  avInProg:   { backgroundColor: '#FEF3C7' },
  avText:     { fontSize: 18, fontWeight: '700' },
  personMeta: { flex: 1 },
  pname: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 6, letterSpacing: -0.2 },
  pmeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  pmetaText: { fontSize: 12, color: '#888', fontWeight: '500' },
  pdatePill: {
    backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 0.5, borderColor: '#EAEAEA',
  },
  pdateText: { fontSize: 10, color: '#999', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 12 },
  infoBlock: { gap: 10 },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoIcon: { marginTop: 2, opacity: 0.6 },
  infoKey: {
    fontSize: 11, color: '#999', fontWeight: '600', width: 75,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#2a2a2a', flex: 1, lineHeight: 18 },
  assignedByBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  assignedByBtnText: { fontSize: 13, fontWeight: '600', color: '#2a2a2a', flex: 1 },
  assignedByBtnPlaceholder: { fontSize: 13, fontWeight: '500', color: '#bbb', flex: 1, fontStyle: 'italic' },
  assignedByChevron: { opacity: 0.5 },
  iconActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  iconActionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconActionTrack:  { backgroundColor: '#E6F1FB', borderColor: '#B5D4F4' },
  iconActionEdit:   { backgroundColor: '#F9F9FB', borderColor: '#EAEAEA' },
  iconActionDelete: { backgroundColor: '#FCEBEB', borderColor: '#F5CDCD' },
  iconActionAssign: { backgroundColor: '#F3E8FF', borderColor: '#E0C3FC' },
  // ── Contacts picker ────────────────────────────────────────────────────────
  contactsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  contactsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, height: '75%', overflow: 'hidden' },
  contactsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  contactsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  contactsTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  contactsClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  contactsSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  contactsSearchInput: { flex: 1, fontSize: 13, color: '#333', paddingVertical: 0 },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#F7F7F7' },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: 16, fontWeight: '700', color: '#0C447C' },
  contactName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  contactPhone: { fontSize: 12, color: '#999', marginTop: 2 },
  contactsLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  contactsEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  contactsEmptyText: { fontSize: 13, color: '#bbb', marginTop: 10 },
  // ── Edit modal ─────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingBottom: 34, paddingTop: 6, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5 },
  fieldInput: { borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1a1a1a', backgroundColor: '#F9F9FB', marginBottom: 14 },
  statusChip: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#EAEAEA', backgroundColor: '#fff', alignItems: 'center' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#999' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#C8000A', alignItems: 'center' },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  // ── FAB (plus only, bottom right) ─────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#C8000A',
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: '#C8000A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10,
  },
});

// ─── Contacts Picker Modal ─────────────────────────────────────────────────
const ContactsPickerModal = ({ visible, onClose, onSelect, title = 'Select Surveyor' }) => {
  const [contacts, setContacts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchQ, setSearchQ]   = useState('');
  const [loadingC, setLoadingC] = useState(false);
  const [permDenied, setPermDenied] = useState(false);

  useEffect(() => { if (visible) { setSearchQ(''); loadContacts(); } }, [visible]);
  useEffect(() => {
    if (!searchQ.trim()) { setFiltered(contacts); return; }
    const q = searchQ.toLowerCase();
    setFiltered(contacts.filter(c =>
      c.displayName?.toLowerCase().includes(q) ||
      c.phoneNumbers?.some(p => p.number?.includes(q))
    ));
  }, [searchQ, contacts]);

  const loadContacts = async () => {
    setLoadingC(true); setPermDenied(false);
    try {
      const perm = Platform.OS === 'android' ? PERMISSIONS.ANDROID.READ_CONTACTS : PERMISSIONS.IOS.CONTACTS;
      let res = await check(perm);
      if (res === RESULTS.DENIED) res = await request(perm);
      if (res !== RESULTS.GRANTED) { setPermDenied(true); setLoadingC(false); return; }
      const all = await Contacts.getAll();
      const sorted = all.filter(c => c.displayName).sort((a, b) => a.displayName.localeCompare(b.displayName));
      setContacts(sorted); setFiltered(sorted);
    } catch (e) { Alert.alert('Error', 'Could not load contacts.'); }
    setLoadingC(false);
  };

  const handleSelect = contact => {
    const rawPhone = contact.phoneNumbers?.[0]?.number || '';
    onSelect({ name: contact.displayName, phone: rawPhone.replace(/[\s\-\(\)]/g, '') });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.contactsOverlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.contactsSheet}>
          <View style={styles.contactsHandle} />
          <View style={styles.contactsHeader}>
            <Text style={styles.contactsTitle}>{title}</Text>
            <TouchableOpacity style={styles.contactsClose} onPress={onClose}>
              <Ionicons name="close" size={17} color="#555" />
            </TouchableOpacity>
          </View>
          <View style={styles.contactsSearch}>
            <Ionicons name="search-outline" size={15} color="#aaa" />
            <TextInput
              style={styles.contactsSearchInput}
              placeholder="Search name or number..."
              placeholderTextColor="#ccc"
              value={searchQ}
              onChangeText={setSearchQ}
            />
            {searchQ.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQ('')}>
                <Ionicons name="close-circle" size={16} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
          {loadingC ? (
            <View style={styles.contactsLoading}>
              <ActivityIndicator size="large" color="#C8000A" />
              <Text style={{ color: '#bbb', fontSize: 12, marginTop: 10 }}>Loading contacts…</Text>
            </View>
          ) : permDenied ? (
            <View style={styles.contactsEmpty}>
              <Ionicons name="lock-closed-outline" size={40} color="#ddd" />
              <Text style={styles.contactsEmptyText}>Contacts permission denied.</Text>
              <TouchableOpacity onPress={loadContacts} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#C8000A', borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.contactsEmpty}>
              <Ionicons name="people-outline" size={40} color="#ddd" />
              <Text style={styles.contactsEmptyText}>No contacts found.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, idx) => item.recordID || String(idx)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.contactItem} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{initial(item.displayName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{item.displayName}</Text>
                    {item.phoneNumbers?.[0]?.number ? <Text style={styles.contactPhone}>{item.phoneNumbers[0].number}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── AssignedByRow ─────────────────────────────────────────────────────────
const AssignedByRow = ({ value, onPress, iconName = 'person-add-outline', iconColor = '#378ADD' }) => (
  <View style={styles.infoLine}>
    <Ionicons name={iconName} size={14} color={iconColor} style={styles.infoIcon} />
    <Text style={styles.infoKey}>Assign To</Text>
    <TouchableOpacity style={styles.assignedByBtn} onPress={onPress} activeOpacity={0.7}>
      {value
        ? <Text style={styles.assignedByBtnText} numberOfLines={1}>{value}</Text>
        : <Text style={styles.assignedByBtnPlaceholder}>Tap to assign surveyor…</Text>
      }
      <Ionicons name="chevron-down" size={13} color="#aaa" style={styles.assignedByChevron} />
    </TouchableOpacity>
  </View>
);

// ─── IconActionsRow ────────────────────────────────────────────────────────
const IconActionsRow = ({ onTrack, onEdit, onDelete, onAssign }) => (
  <View style={styles.iconActionsRow}>
    {onTrack  && <TouchableOpacity style={[styles.iconActionBtn, styles.iconActionTrack]}  onPress={onTrack}  activeOpacity={0.75}><Ionicons name="map-outline"        size={16} color="#0C447C" /></TouchableOpacity>}
    {onAssign && <TouchableOpacity style={[styles.iconActionBtn, styles.iconActionAssign]} onPress={onAssign} activeOpacity={0.75}><Ionicons name="person-add-outline" size={16} color="#7C3AED" /></TouchableOpacity>}
    {onEdit   && <TouchableOpacity style={[styles.iconActionBtn, styles.iconActionEdit]}   onPress={onEdit}   activeOpacity={0.75}><Ionicons name="create-outline"     size={16} color="#444"   /></TouchableOpacity>}
    {onDelete && <TouchableOpacity style={[styles.iconActionBtn, styles.iconActionDelete]} onPress={onDelete} activeOpacity={0.75}><Ionicons name="trash-outline"      size={16} color="#A32D2D" /></TouchableOpacity>}
  </View>
);

// ─── Edit Modal ────────────────────────────────────────────────────────────
const EditModal = ({ visible, item, onClose, onSave }) => {
  const [name, setName]             = useState('');
  const [phone, setPhone]           = useState('');
  const [city, setCity]             = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [status, setStatus]         = useState('');
  const [comment, setComment]       = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name === '—' ? '' : item.name);
      setPhone(item.phone === '—' ? '' : item.phone);
      setCity(item.city === '—' ? '' : item.city);
      setReferredBy(item.referredBy === 'N/A' ? '' : item.referredBy);
      setStatus(item.status);
      setComment(item.comment === '—' ? '' : item.comment);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item?.zohoId) { Alert.alert('Error', 'Deal ID not found.'); return; }
    setSaving(true);
    try {
      await API.put('/order/update', { id: item.zohoId, name, mobile: phone, city, referredBy, status, comment, description: comment });
      onSave(); onClose();
    } catch (e) { Alert.alert('Error', 'Update failed: ' + (e?.message || 'Unknown error')); }
    setSaving(false);
  };

  const statusOptions = [
    { key: 'notassigned', label: 'New',        color: '#0C447C', bg: '#E6F1FB', border: '#B5D4F4' },
    { key: 'accepted',    label: 'Accepted',    color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
    { key: 'inprogress',  label: 'In Progress', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
    { key: 'completed',   label: 'Completed',   color: '#27500A', bg: '#EAF3DE', border: '#97C459' },
    { key: 'rejected',    label: 'Rejected',    color: '#791F1F', bg: '#FCEBEB', border: '#F09595' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Lead</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.fieldInput} value={name} onChangeText={setName} placeholder="Customer name" placeholderTextColor="#ccc" />
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} placeholder="Mobile number" placeholderTextColor="#ccc" keyboardType="phone-pad" />
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput style={styles.fieldInput} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#ccc" />
            <Text style={styles.fieldLabel}>Referred By</Text>
            <TextInput style={styles.fieldInput} value={referredBy} onChangeText={setReferredBy} placeholder="Referrer name" placeholderTextColor="#ccc" />
            <Text style={styles.fieldLabel}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {statusOptions.map(s => (
                  <TouchableOpacity key={s.key} onPress={() => setStatus(s.key)} style={[styles.statusChip, { minWidth: 80 }, status === s.key && { backgroundColor: s.bg, borderColor: s.border }]}>
                    <Text style={[styles.statusChipText, status === s.key && { color: s.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.fieldLabel}>Remarks / Reason</Text>
            <TextInput style={[styles.fieldInput, { height: 80, textAlignVertical: 'top' }]} value={comment} onChangeText={setComment} placeholder="Add remarks..." placeholderTextColor="#ccc" multiline />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Cards ─────────────────────────────────────────────────────────────────
const CompletedCard = ({ item, onEdit, onDelete, onAssign }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#639922', '#97C459']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}><Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text></View>
        <View style={[styles.badgeBase, styles.badgeDone]}><View style={[styles.badgeDot, { backgroundColor: '#639922' }]} /><Text style={styles.badgeDoneText}>✓ Completed</Text></View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avDone]}><Text style={[styles.avText, { color: '#27500A' }]}>{initial(item.name)}</Text></View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}><Ionicons name="person-outline" size={14} color="#999" style={styles.infoIcon} /><Text style={styles.infoKey}>Surveyor</Text><Text style={styles.infoVal}>{item.surveyorNumber}</Text></View>
        {item.logisticAssignee ? <View style={styles.infoLine}><Ionicons name="cube-outline" size={14} color="#7C3AED" style={styles.infoIcon} /><Text style={styles.infoKey}>Logistic</Text><Text style={styles.infoVal}>{item.logisticAssignee}</Text></View> : null}
        {item.installerAssignee ? <View style={styles.infoLine}><Ionicons name="construct-outline" size={14} color="#7C3AED" style={styles.infoIcon} /><Text style={styles.infoKey}>Installer</Text><Text style={styles.infoVal}>{item.installerAssignee}</Text></View> : null}
        <View style={styles.infoLine}><Ionicons name="checkmark-done-outline" size={14} color="#639922" style={styles.infoIcon} /><Text style={styles.infoKey}>Remarks</Text><Text style={styles.infoVal}>{item.comment}</Text></View>
        {item.loanType && <View style={styles.infoLine}><Ionicons name="flash-outline" size={14} color="#999" style={styles.infoIcon} /><Text style={styles.infoKey}>KV / Loan</Text><Text style={styles.infoVal}>{item.loanType}</Text></View>}
        {item.amount && <View style={styles.infoLine}><Ionicons name="cash-outline" size={14} color="#999" style={styles.infoIcon} /><Text style={styles.infoKey}>Amount</Text><Text style={styles.infoVal}>₹{Number(item.amount).toLocaleString('en-IN')}</Text></View>}
      </View>
      <IconActionsRow onAssign={() => onAssign(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
    </View>
  </View>
);

const RejectedCard = ({ item, onEdit, onDelete, onAssign, onViewLocation }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#A32D2D', '#E24B4A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}><Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text></View>
        <View style={[styles.badgeBase, styles.badgeRejected]}><View style={[styles.badgeDot, { backgroundColor: '#E24B4A' }]} /><Text style={styles.badgeRejectedText}>✕ Rejected</Text></View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avRejected]}><Text style={[styles.avText, { color: '#791F1F' }]}>{initial(item.name)}</Text></View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}><Ionicons name="person-remove-outline" size={14} color="#E24B4A" style={styles.infoIcon} /><Text style={styles.infoKey}>Rejected By</Text><Text style={styles.infoVal}>{item.surveyorNumber}</Text></View>
        <AssignedByRow value={item.assignedBy} onPress={() => onAssign(item)} iconName="person-add-outline" iconColor="#A32D2D" />
        <View style={styles.infoLine}><Ionicons name="alert-circle-outline" size={14} color="#A32D2D" style={styles.infoIcon} /><Text style={styles.infoKey}>Reason</Text><Text style={styles.infoVal}>{item.comment}</Text></View>
      </View>
      <IconActionsRow onTrack={() => onViewLocation(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
    </View>
  </View>
);

const InProgressCard = ({ item, onEdit, onDelete }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#D97706', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}><Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text></View>
        <View style={[styles.badgeBase, styles.badgeInProg]}><View style={[styles.badgeDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.badgeInProgText}>⏳ In Progress</Text></View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avInProg]}><Text style={[styles.avText, { color: '#92400E' }]}>{initial(item.name)}</Text></View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}><Ionicons name="person-outline" size={14} color="#999" style={styles.infoIcon} /><Text style={styles.infoKey}>Surveyor</Text><Text style={styles.infoVal}>{item.surveyorNumber}</Text></View>
        <View style={styles.infoLine}><Ionicons name="time-outline" size={14} color="#D97706" style={styles.infoIcon} /><Text style={styles.infoKey}>Remarks</Text><Text style={styles.infoVal}>{item.comment}</Text></View>
      </View>
    </View>
  </View>
);

const OtherCard = ({ item, onEdit, onDelete, onAssign, onViewLocation }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#185FA5', '#378ADD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}><Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text></View>
        <View style={[styles.badgeBase, styles.badgeOther]}><View style={[styles.badgeDot, { backgroundColor: '#378ADD' }]} /><Text style={styles.badgeOtherText}>{item.status === 'notassigned' ? '● New' : `● ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}`}</Text></View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avOther]}><Text style={[styles.avText, { color: '#0C447C' }]}>{initial(item.name)}</Text></View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}><Ionicons name="person-outline" size={14} color="#999" style={styles.infoIcon} /><Text style={styles.infoKey}>Surveyor</Text><Text style={styles.infoVal}>{item.surveyorNumber !== '—' ? item.surveyorNumber : 'Not assigned yet'}</Text></View>
        <AssignedByRow value={item.assignedBy} onPress={() => onAssign(item)} iconName="person-add-outline" iconColor="#378ADD" />
        <View style={styles.infoLine}><Ionicons name="document-text-outline" size={14} color="#185FA5" style={styles.infoIcon} /><Text style={styles.infoKey}>Remarks</Text><Text style={styles.infoVal}>{item.comment}</Text></View>
      </View>
      <IconActionsRow onTrack={() => onViewLocation(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// AdminScreen
// ─────────────────────────────────────────────────────────────────────────────
const AdminScreen = ({ navigation, route }) => {
  const [allLeads, setAllLeads]             = useState([]);
  const [activeFilter, setActiveFilter]     = useState('all');
  const [filterMode, setFilterMode]         = useState('lead');
  const [employeeFilter, setEmployeeFilter] = useState(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [datePreset, setDatePreset]         = useState('all');
  const [fromDate, setFromDate]             = useState('');
  const [toDate, setToDate]                 = useState('');
  const [showCustom, setShowCustom]         = useState(false);
  const [customApplied, setCustomApplied]   = useState(false);
  const [editVisible, setEditVisible]       = useState(false);
  const [selectedItem, setSelectedItem]     = useState(null);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [assignTarget, setAssignTarget]     = useState(null);
  const [assignRole, setAssignRole]         = useState('surveyor');

  // Receive filter back from FilterScreen / EmployeeFilterScreen
  useFocusEffect(
    useCallback(() => {
      const params = route?.params;
      if (!params) return;
      if (params.selectedFilter !== undefined) setActiveFilter(params.selectedFilter);
      if (params.filterMode    !== undefined) setFilterMode(params.filterMode);
      if (params.employeeFilter !== undefined) setEmployeeFilter(params.employeeFilter);
    }, [route?.params])
  );

  const fetchLeads = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [allRes, completedRes, rejectedRes] = await Promise.all([
        API.get('/order/all'),
        API.get('/order/admin-completions'),
        API.get('/order/admin-rejections'),
      ]);
      const rawAll = Array.isArray(allRes.data?.deals) ? allRes.data.deals
        : Array.isArray(allRes.data) ? allRes.data
        : Array.isArray(allRes.data?.data) ? allRes.data.data
        : Array.isArray(allRes.data?.orders) ? allRes.data.orders : [];

      const nonCompletedOrRejected = rawAll
        .filter(r => {
          const s  = (r.siteSurveyStatus || '').toLowerCase();
          const st = (r.status || '').toLowerCase();
          return s !== 'completed' && s !== 'rejected' && st !== 'completed' && st !== 'rejected';
        })
        .map((item, idx) => normaliseGeneral(item, idx));

      const rawCompleted = Array.isArray(completedRes.data?.data) ? completedRes.data.data : Array.isArray(completedRes.data) ? completedRes.data : [];
      const completedNormalised = rawCompleted.map((item, idx) => normalise(item, `c_${idx}`));

      const rawRejected = Array.isArray(rejectedRes.data?.data) ? rejectedRes.data.data : Array.isArray(rejectedRes.data) ? rejectedRes.data : [];
      const rejectedNormalised = rawRejected.map((item, idx) => ({
        id: item._id || `r_${idx}`, zohoId: item.deal_id || item._id || null, mongoId: item._id || null,
        name: item.deal_name || item.name || item.customerName || '—',
        phone: item.mobile || item.customerMobile || item.phone || '—',
        city: item.city || '—', referredBy: item.referredBy || 'N/A',
        surveyorNumber: item.surveyorNumber || item.assignedTo || '—',
        assignedBy: item.assignedBy || item.assigned_by || '',
        comment: item.comment || '—',
        loanType: null, amount: null,
        date: fmtDate(item.assignedAt || item.time || item.createdAt),
        rawDate: item.assignedAt || item.time || item.createdAt || null,
        status: 'rejected', deal_id: item.deal_id || null,
      }));

      setAllLeads([...completedNormalised, ...rejectedNormalised, ...nonCompletedOrRejected]);
    } catch (e) { console.log('[AdminScreen] fetchLeads error:', e?.message); setAllLeads([]); }
    if (isRefresh) setRefreshing(false); else setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: async () => {
        await AsyncStorage.removeItem(USER_DATA);
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
      }},
    ]);
  };

  const handleEdit   = item => { setSelectedItem(item); setEditVisible(true); };
  const handleDelete = item => {
    Alert.alert('Delete Lead', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!item.zohoId) { Alert.alert('Error', 'Deal ID not found.'); return; }
        try {
          await API.delete('/order/delete', { data: { id: item.zohoId } });
          setAllLeads(prev => prev.filter(l => l.id !== item.id));
        } catch (e) { Alert.alert('Error', 'Delete failed: ' + (e?.message || 'Unknown error')); }
      }},
    ]);
  };

  const handleAssign = item => { setAssignRole('surveyor'); setAssignTarget(item); setContactsVisible(true); };
  const handleAssignCompleted = item => {
    Alert.alert('Assign', 'Who do you want to assign this lead to?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logistic',  onPress: () => { setAssignRole('logistic');  setAssignTarget(item); setContactsVisible(true); } },
      { text: 'Installer', onPress: () => { setAssignRole('installer'); setAssignTarget(item); setContactsVisible(true); } },
    ]);
  };

  const handleContactSelected = async ({ name, phone }) => {
    if (!assignTarget) return;
    const role = assignRole;
    if (role === 'logistic')       setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, logisticAssignee: phone } : l));
    else if (role === 'installer') setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, installerAssignee: phone } : l));
    else                           setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, assignedBy: phone } : l));
    try {
      await API.post('/order/assign', {
        id: assignTarget.zohoId, name: assignTarget.name, mobile: assignTarget.phone,
        whatsappNo: assignTarget.whatsappNo || null, email: assignTarget.email || null,
        city: assignTarget.city, address: assignTarget.address || null,
        latitude: assignTarget.latitude || null, longitude: assignTarget.longitude || null,
        comment: assignTarget.comment, role, surveyorNumber: phone,
      });
      Alert.alert('Success', `Lead assigned to ${phone}${role !== 'surveyor' ? ` (${role})` : ''}`);
    } catch (e) {
      Alert.alert('Error', 'Could not assign: ' + (e?.message || 'Unknown error'));
      if (role === 'logistic')       setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, logisticAssignee: assignTarget.logisticAssignee } : l));
      else if (role === 'installer') setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, installerAssignee: assignTarget.installerAssignee } : l));
      else                           setAllLeads(prev => prev.map(l => l.id === assignTarget.id ? { ...l, assignedBy: assignTarget.assignedBy } : l));
    }
    setAssignTarget(null); setAssignRole('surveyor');
  };

  const handleViewLocation = async (item) => {
    const phone = item.assignedBy || item.surveyorNumber;
    if (!phone || phone === '—') { Alert.alert('Not Assigned', 'No surveyor assigned to this lead.'); return; }
    try {
      const res = await API.post('/location/current', { mobiles: [phone] });
      const loc = Array.isArray(res.data) ? res.data[0]?.currentLocation : null;
      if (!loc?.latitude || !loc?.longitude) { Alert.alert('No Location', `Surveyor (${phone}) location not available yet.`); return; }
      const label = encodeURIComponent(`Surveyor: ${phone}`);
      const url = Platform.OS === 'ios'
        ? `maps://?q=${label}&ll=${loc.latitude},${loc.longitude}`
        : `geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}(${label})`;
      const canOpen = await Linking.canOpenURL(url);
      await Linking.openURL(canOpen ? url : `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`);
    } catch (e) { Alert.alert('Error', 'Could not fetch location: ' + (e?.message || 'Unknown error')); }
  };

  // ── Date helpers ───────────────────────────────────────────────────────────
  const parseCardDate = dateStr => {
    if (!dateStr || dateStr === '—') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  };
  const getPresetRange = preset => {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
      case 'today':     return { from: today, to: today };
      case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: y, to: y }; }
      case 'last7':     return { from: new Date(today.getTime() - 6 * 86400000), to: today };
      case 'last30':    return { from: new Date(today.getTime() - 29 * 86400000), to: today };
      case 'thisMonth': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
      default:          return null;
    }
  };
  const parseInputDate = str => {
    if (!str || str.length !== 10) return null;
    const [d, m, y] = str.split('/');
    const dt = new Date(`${y}-${m}-${d}`);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const applyDateFilter = leads => {
    if (datePreset === 'all' && !customApplied) return leads;
    let from, to;
    if (customApplied) {
      from = parseInputDate(fromDate); to = parseInputDate(toDate);
      if (!from || !to) return leads;
      to.setHours(23, 59, 59, 999);
    } else {
      const range = getPresetRange(datePreset);
      if (!range) return leads;
      from = range.from; to = new Date(range.to); to.setHours(23, 59, 59, 999);
    }
    return leads.filter(item => { const d = parseCardDate(item.date); return d && d >= from && d <= to; });
  };
  const clearDateFilter = () => { setDatePreset('all'); setCustomApplied(false); setFromDate(''); setToDate(''); setShowCustom(false); };
  const formatInput = t => {
    const c = t.replace(/\D/g, '');
    if (c.length >= 5) return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
    if (c.length >= 3) return `${c.slice(0, 2)}/${c.slice(2)}`;
    return c;
  };

  // ── Derived lists ──────────────────────────────────────────────────────────
  const completedLeads  = allLeads.filter(i => i.status === 'completed');
  const rejectedLeads   = allLeads.filter(i => i.status === 'rejected');
  const inprogressLeads = allLeads.filter(i => ['inprogress', 'in progress', 'in_progress', 'accepted'].includes(i.status));
  const otherLeads      = allLeads.filter(i => !['completed', 'rejected', 'inprogress', 'in progress', 'in_progress', 'accepted'].includes(i.status));

  const employeeList = React.useMemo(() => {
    const set = new Set();
    allLeads.forEach(l => {
      [l.surveyorNumber, l.assignedBy, l.logisticAssignee, l.installerAssignee].forEach(v => {
        if (v && v !== '—') set.add(v);
      });
    });
    return Array.from(set).sort();
  }, [allLeads]);

  const counts = {
    all: allLeads.length,
    completed: completedLeads.length,
    rejected: rejectedLeads.length,
    inprogress: inprogressLeads.length,
    other: otherLeads.length,
  };

  const statusFiltered =
    activeFilter === 'completed'  ? completedLeads  :
    activeFilter === 'rejected'   ? rejectedLeads   :
    activeFilter === 'inprogress' ? inprogressLeads :
    activeFilter === 'other'      ? otherLeads      : allLeads;

  const modeFiltered = (filterMode === 'employee' && employeeFilter)
    ? allLeads.filter(i => [i.surveyorNumber, i.assignedBy, i.logisticAssignee, i.installerAssignee].includes(employeeFilter))
    : statusFiltered;

  const searchFiltered = searchQuery.trim()
    ? modeFiltered.filter(i => {
        const q = searchQuery.toLowerCase();
        return [i.name, i.phone, i.city, i.referredBy, i.surveyorNumber].some(v => v && v.toLowerCase().includes(q));
      })
    : modeFiltered;

  const filteredLeads  = applyDateFilter(searchFiltered);
  const isDateActive   = datePreset !== 'all' || customApplied;
  const isFilterActive = activeFilter !== 'all' || !!employeeFilter;
  const filterBadgeCount = (activeFilter !== 'all' ? 1 : 0) + (employeeFilter ? 1 : 0) + (isDateActive ? 1 : 0);

  const todayLabel  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const presetLabel = { today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 days', last30: 'Last 30 days', thisMonth: 'This month' }[datePreset] || '';

  const renderCard = item => {
    if (item.status === 'completed')
      return <CompletedCard  key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} onAssign={handleAssignCompleted} />;
    if (item.status === 'rejected')
      return <RejectedCard   key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} onAssign={handleAssign} onViewLocation={handleViewLocation} />;
    if (['inprogress', 'in progress', 'in_progress', 'accepted'].includes(item.status))
      return <InProgressCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />;
    return <OtherCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} onAssign={handleAssign} onViewLocation={handleViewLocation} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <EditModal visible={editVisible} item={selectedItem} onClose={() => setEditVisible(false)} onSave={() => fetchLeads()} />
      <ContactsPickerModal
        visible={contactsVisible}
        onClose={() => { setContactsVisible(false); setAssignTarget(null); setAssignRole('surveyor'); }}
        onSelect={handleContactSelected}
        title={assignRole === 'logistic' ? 'Select Logistic' : assignRole === 'installer' ? 'Select Installer' : 'Select Surveyor'}
      />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Logo row */}
        <View style={styles.headerRow}>
          <View style={styles.logoArea}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Admin Panel</Text>
              <Text style={styles.brandSub}>{todayLabel}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {/* Stats */}
{/* Stats */}
<View style={styles.statsRow}>
  {[
    { num: allLeads.length,        label: 'Total',    bg: '#ffffff',  text: '#C8000A' },
    { num: completedLeads.length,  label: 'Done',     bg: '#97C459',  text: '#1B3A03' },
    { num: rejectedLeads.length,   label: 'Rejected', bg: '#E24B4A',  text: '#ffffff' },
    { num: inprogressLeads.length, label: 'Progress', bg: '#F59E0B',  text: '#5A3300' },
    { num: otherLeads.length,      label: 'New',      bg: '#378ADD',  text: '#ffffff' },
  ].map((s, i) => (
    <View key={i} style={[styles.statBox, { backgroundColor: s.bg }]}>
      <Text style={[styles.statNum, { color: s.text }]}>{s.num}</Text>
      <Text style={[styles.statLabel, { color: s.text, opacity: 0.85 }]}>{s.label}</Text>
    </View>
  ))}
</View>

        {/* Filter button — inside header, right-aligned */}
        <View style={styles.headerFilterRow}>
          <TouchableOpacity
            style={[styles.headerFilterBtn, isFilterActive && styles.headerFilterBtnActive]}
            onPress={() => navigation.navigate('FilterScreen', { counts, activeFilter, employeeList, employeeFilter })}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={19} color={isFilterActive ? '#C8000A' : '#fff'} />
            {filterBadgeCount > 0 && (
              <View style={[styles.filterBadge, isFilterActive && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, isFilterActive && styles.filterBadgeTextActive]}>
                  {filterBadgeCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Active employee bar */}
      {filterMode === 'employee' && employeeFilter && (
        <View style={styles.activeFilterBar}>
          <View style={styles.activeFilterLeft}>
            <Ionicons name="person-circle-outline" size={15} color="#A32D2D" />
            <Text style={styles.activeFilterText}>Employee: {employeeFilter}</Text>
          </View>
          <TouchableOpacity onPress={() => { setEmployeeFilter(null); setFilterMode('lead'); setActiveFilter('all'); }}>
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color="#aaa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, city..."
          placeholderTextColor="#ccc"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Date preset bar */}
      <View style={styles.dateBar}>
        <Ionicons name="calendar-outline" size={15} color="#aaa" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginHorizontal: 6 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
          {[
            { key: 'all',       label: 'All'        },
            { key: 'today',     label: 'Today'      },
            { key: 'yesterday', label: 'Yesterday'  },
            { key: 'last7',     label: 'Last 7 days'},
            { key: 'last30',    label: 'Last 30 days'},
            { key: 'thisMonth', label: 'This month' },
          ].map(p => (
            <TouchableOpacity
              key={p.key}
              onPress={() => { setDatePreset(p.key); setCustomApplied(false); setShowCustom(false); }}
              style={[styles.dateChip, datePreset === p.key && !customApplied && styles.dateChipActive]}
            >
              <Text style={[styles.dateChipText, datePreset === p.key && !customApplied && { color: '#fff' }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.calBtn, showCustom && { backgroundColor: '#FCEBEB', borderColor: '#F09595' }]}
          onPress={() => setShowCustom(v => !v)}
        >
          <Ionicons name="calendar" size={15} color={showCustom ? '#A32D2D' : '#888'} />
        </TouchableOpacity>
      </View>

      {/* Custom range */}
      {showCustom && (
        <View style={styles.customRange}>
          <Text style={styles.rangeLbl}>From</Text>
          <TextInput style={styles.rangeInput} placeholder="DD/MM/YYYY" placeholderTextColor="#ccc" value={fromDate} onChangeText={t => setFromDate(formatInput(t))} keyboardType="numeric" maxLength={10} />
          <Text style={styles.rangeSep}>–</Text>
          <TextInput style={styles.rangeInput} placeholder="DD/MM/YYYY" placeholderTextColor="#ccc" value={toDate} onChangeText={t => setToDate(formatInput(t))} keyboardType="numeric" maxLength={10} />
          <TouchableOpacity
            style={[styles.applyBtn, (!fromDate || !toDate) && { opacity: 0.5 }]}
            disabled={!fromDate || !toDate}
            onPress={() => { if (fromDate && toDate) { setCustomApplied(true); setDatePreset('all'); } }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result bar */}
      {(isDateActive || searchQuery.trim() || employeeFilter || activeFilter !== 'all') && (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            {activeFilter !== 'all' ? `  ·  ${activeFilter}` : ''}
            {employeeFilter ? `  ·  ${employeeFilter}` : ''}
            {customApplied ? `  ·  ${fromDate} – ${toDate}` : presetLabel ? `  ·  ${presetLabel}` : ''}
            {searchQuery.trim() ? `  ·  "${searchQuery}"` : ''}
          </Text>
          <TouchableOpacity onPress={() => { clearDateFilter(); setSearchQuery(''); setEmployeeFilter(null); setFilterMode('lead'); setActiveFilter('all'); }}>
            <Text style={styles.clearTxt}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lead list */}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 100, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(true)} colors={['#C8000A']} />}
      >
        {loading && <ActivityIndicator size="large" color="#C8000A" style={{ marginTop: 40 }} />}
        {!loading && filteredLeads.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="document-outline" size={44} color="#ddd" />
            <Text style={{ color: '#bbb', fontSize: 13, marginTop: 10 }}>No leads found.</Text>
          </View>
        )}
        {!loading && filteredLeads.map(renderCard)}
      </ScrollView>

      {/* ── FAB: plus icon only, bottom right ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate(SCREEN_NAMES.CREATE_LEAD)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default AdminScreen;
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Alert, ScrollView, ActivityIndicator, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#C8000A',
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 18,
  },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  datePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  datePillText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  statDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 6 },
  statNum: { fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 24 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 },

  createLeadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', marginBottom: 14, paddingVertical: 11,
    borderRadius: 10, elevation: 3,
  },
  createLeadBtnText: { fontSize: 13, fontWeight: '700', color: '#C8000A', letterSpacing: 0.2 },

  filterStrip: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  filterChip: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#EAEAEA',
    backgroundColor: '#fff', alignItems: 'center',
  },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#999' },
  chipAll:   { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipDone:  { backgroundColor: '#EAF3DE', borderColor: '#97C459' },
  chipRej:   { backgroundColor: '#FCEBEB', borderColor: '#F09595' },
  chipOther: { backgroundColor: '#E6F1FB', borderColor: '#85B7EB' },

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
    borderRadius: 8, borderWidth: 0.5, borderColor: '#F0D699',
    flex: 1,
  },
  refTagText: { fontSize: 10.5, color: '#854F0B', fontWeight: '500' },
  badgeBase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeDone:  { backgroundColor: '#EAF3DE', borderWidth: 1, borderColor: '#D1E9B8' },
  badgeDoneText:  { fontSize: 11, fontWeight: '700', color: '#27500A', letterSpacing: 0.2 },
  badgeRej:   { backgroundColor: '#FCEBEB', borderWidth: 1, borderColor: '#F5CDCD' },
  badgeRejText:   { fontSize: 11, fontWeight: '700', color: '#791F1F', letterSpacing: 0.2 },
  badgeOther: { backgroundColor: '#E6F1FB', borderWidth: 1, borderColor: '#B5D4F4' },
  badgeOtherText: { fontSize: 11, fontWeight: '700', color: '#0C447C', letterSpacing: 0.2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },

  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  av: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avDone:  { backgroundColor: '#EAF3DE' },
  avRej:   { backgroundColor: '#FCEBEB' },
  avOther: { backgroundColor: '#E6F1FB' },
  avText:  { fontSize: 18, fontWeight: '700' },
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
    fontSize: 11, color: '#999', fontWeight: '600', width: 65,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#2a2a2a', flex: 1, lineHeight: 18 },

  // ── Card action buttons ──
  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 14,
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#EAEAEA', backgroundColor: '#F9F9FB',
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#444' },
  deleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#F5CDCD', backgroundColor: '#FCEBEB',
  },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#A32D2D' },

  // ── Edit Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 18, paddingBottom: 34, paddingTop: 6,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 18 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5 },
  fieldInput: {
    borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#1a1a1a', backgroundColor: '#F9F9FB', marginBottom: 14,
  },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statusChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#EAEAEA',
    backgroundColor: '#fff', alignItems: 'center',
  },
  statusChipText: { fontSize: 12, fontWeight: '600', color: '#999' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  saveBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#C8000A', alignItems: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── helpers ───────────────────────────────────────────────────────────────
const fmtDate = val => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
};

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

const normalise = (raw, index) => ({
  id:             raw._id || raw.id || String(index),
  name:           raw.name || raw.customerName || '—',
  phone:          raw.mobile || raw.phone || raw.customerMobile || '—',
  city:           raw.city || '—',
  referredBy:     raw.referredBy || raw.referred_by || 'N/A',
  surveyorNumber: raw.surveyorNumber || raw.surveyor || '—',
  comment:        raw.comment || raw.completionReason || raw.reason || raw.rejectReason || '—',
  loanType:       raw.loanType || raw.loan_type || null,
  amount:         raw.amount || null,
  date:           fmtDate(raw.createdAt || raw.date),
  rawDate:        raw.createdAt || raw.date || null,
  status:         (raw.status || 'pending').toLowerCase(),
});

// ─── Edit Modal ────────────────────────────────────────────────────────────
const EditModal = ({ visible, item, onClose, onSave }) => {
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [city, setCity]         = useState('');
  const [referredBy, setReferredBy] = useState('');
  const [status, setStatus]     = useState('');
  const [comment, setComment]   = useState('');
  const [saving, setSaving]     = useState(false);

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

  // EditModal-க்கு phone state already இருக்கிறது ✅
// handleSave — mobile அனுப்பவும்
const handleSave = async () => {
  if (!phone.trim()) {
    Alert.alert('Error', 'Mobile number is required to update.');
    return;
  }
  setSaving(true);
  try {
    await API.put('/order/update', {
      mobile: phone,        // ← Zoho search key (mandatory)
      name,
      city,
      referredBy,
      status,
      comment,
      description: comment, // backend description field-க்கும்
    });
    onSave();
    onClose();
  } catch (e) {
    Alert.alert('Error', 'Update failed: ' + (e?.message || 'Unknown error'));
  }
  setSaving(false);
};

  const statusOptions = [
    { key: 'pending',   label: 'Pending',   color: '#0C447C', bg: '#E6F1FB', border: '#B5D4F4' },
    { key: 'completed', label: 'Completed', color: '#27500A', bg: '#EAF3DE', border: '#97C459' },
    { key: 'rejected',  label: 'Rejected',  color: '#791F1F', bg: '#FCEBEB', border: '#F09595' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            <View style={styles.statusRow}>
              {statusOptions.map(s => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setStatus(s.key)}
                  style={[
                    styles.statusChip,
                    status === s.key && { backgroundColor: s.bg, borderColor: s.border },
                  ]}
                >
                  <Text style={[styles.statusChipText, status === s.key && { color: s.color }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Remarks / Reason</Text>
            <TextInput
              style={[styles.fieldInput, { height: 80, textAlignVertical: 'top' }]}
              value={comment} onChangeText={setComment}
              placeholder="Add remarks..." placeholderTextColor="#ccc"
              multiline
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Card Action Row ────────────────────────────────────────────────────────
const CardActions = ({ item, onEdit, onDelete }) => (
  <>
    <View style={styles.divider} />
    <View style={styles.cardActions}>
      <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)} activeOpacity={0.75}>
        <Ionicons name="create-outline" size={15} color="#444" />
        <Text style={styles.editBtnText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.75}>
        <Ionicons name="trash-outline" size={15} color="#A32D2D" />
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  </>
);

// ─── Cards ─────────────────────────────────────────────────────────────────
const CompletedCard = ({ item, onEdit, onDelete }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#639922', '#97C459']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}>
          <Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text>
        </View>
        <View style={[styles.badgeBase, styles.badgeDone]}>
          <View style={[styles.badgeDot, { backgroundColor: '#639922' }]} />
          <Text style={styles.badgeDoneText}>✓ Completed</Text>
        </View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avDone]}>
          <Text style={[styles.avText, { color: '#27500A' }]}>{initial(item.name)}</Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}>
          <Ionicons name="person-outline" size={14} color="#999" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Surveyor</Text>
          <Text style={styles.infoVal}>{item.surveyorNumber}</Text>
        </View>
        <View style={styles.infoLine}>
          <Ionicons name="checkmark-done-outline" size={14} color="#639922" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Remarks</Text>
          <Text style={styles.infoVal}>{item.comment}</Text>
        </View>
        {item.loanType && (
          <View style={styles.infoLine}>
            <Ionicons name="card-outline" size={14} color="#999" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Loan</Text>
            <Text style={styles.infoVal}>{item.loanType}</Text>
          </View>
        )}
        {item.amount && (
          <View style={styles.infoLine}>
            <Ionicons name="cash-outline" size={14} color="#999" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Amount</Text>
            <Text style={styles.infoVal}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
          </View>
        )}
      </View>
      <CardActions item={item} onEdit={onEdit} onDelete={onDelete} />
    </View>
  </View>
);

const RejectedCard = ({ item, onEdit, onDelete }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#A32D2D', '#E24B4A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}>
          <Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text>
        </View>
        <View style={[styles.badgeBase, styles.badgeRej]}>
          <View style={[styles.badgeDot, { backgroundColor: '#E24B4A' }]} />
          <Text style={styles.badgeRejText}>✕ Rejected</Text>
        </View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avRej]}>
          <Text style={[styles.avText, { color: '#791F1F' }]}>{initial(item.name)}</Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}>
          <Ionicons name="person-remove-outline" size={14} color="#E24B4A" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Rejected By</Text>
          <Text style={styles.infoVal}>{item.surveyorNumber}</Text>
        </View>
        <View style={styles.infoLine}>
          <Ionicons name="alert-circle-outline" size={14} color="#A32D2D" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Reason</Text>
          <Text style={styles.infoVal}>{item.comment}</Text>
        </View>
      </View>
      <CardActions item={item} onEdit={onEdit} onDelete={onDelete} />
    </View>
  </View>
);

const OtherCard = ({ item, onEdit, onDelete }) => (
  <View style={styles.card}>
    <LinearGradient colors={['#185FA5', '#378ADD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
    <View style={styles.cardInner}>
      <View style={styles.topRow}>
        <View style={styles.refTag}>
          <Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text>
        </View>
        <View style={[styles.badgeBase, styles.badgeOther]}>
          <View style={[styles.badgeDot, { backgroundColor: '#378ADD' }]} />
          <Text style={styles.badgeOtherText}>● {item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
        </View>
      </View>
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avOther]}>
          <Text style={[styles.avText, { color: '#0C447C' }]}>{initial(item.name)}</Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name}</Text>
          <View style={styles.pmeta}><Ionicons name="call-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.phone}</Text></View>
          <View style={styles.pmeta}><Ionicons name="location-outline" size={13} color="#999" /><Text style={styles.pmetaText}>{item.city}</Text></View>
        </View>
        <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}>
          <Ionicons name="person-outline" size={14} color="#999" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Surveyor</Text>
          <Text style={styles.infoVal}>{item.surveyorNumber}</Text>
        </View>
        <View style={styles.infoLine}>
          <Ionicons name="document-text-outline" size={14} color="#185FA5" style={styles.infoIcon} />
          <Text style={styles.infoKey}>Remarks</Text>
          <Text style={styles.infoVal}>{item.comment}</Text>
        </View>
      </View>
      <CardActions item={item} onEdit={onEdit} onDelete={onDelete} />
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// AdminScreen
// ─────────────────────────────────────────────────────────────────────────────
const AdminScreen = ({ navigation }) => {
  const [allLeads, setAllLeads]           = useState([]);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [datePreset, setDatePreset]       = useState('all');
  const [fromDate, setFromDate]           = useState('');
  const [toDate, setToDate]               = useState('');
  const [showCustom, setShowCustom]       = useState(false);
  const [customApplied, setCustomApplied] = useState(false);

  // Edit modal state
  const [editVisible, setEditVisible]     = useState(false);
  const [selectedItem, setSelectedItem]   = useState(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchLeads = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await API.get('/order/all');
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.orders)
        ? res.data.orders
        : [];
      setAllLeads(raw.map((item, index) => normalise(item, index)));
    } catch (e) {
      console.log('[AdminScreen] error:', e?.message);
      setAllLeads([]);
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes', onPress: async () => {
          await AsyncStorage.removeItem(USER_DATA);
          navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
        },
      },
    ]);
  };

  // ── edit ───────────────────────────────────────────────────────────────────
  const handleEdit = item => {
    setSelectedItem(item);
    setEditVisible(true);
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  // AdminScreen-ல் handleDelete — mobile அனுப்பவும்
const handleDelete = item => {
  Alert.alert(
    'Delete Lead',
    `Are you sure you want to delete "${item.name}"?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!item.phone || item.phone === '—') {
            Alert.alert('Error', 'Mobile number is required to delete this lead.');
            return;
          }
          try {
            await API.delete('/order/delete', {
              data: { mobile: item.phone },
            });
            setAllLeads(prev => prev.filter(l => l.id !== item.id));
          } catch (e) {
            Alert.alert('Error', 'Delete failed: ' + (e?.message || 'Unknown error'));
          }
        },
      },
    ],
  );
};

  // ── date helpers ───────────────────────────────────────────────────────────
  const parseCardDate = dateStr => {
    if (!dateStr || dateStr === '—') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  };

  const getPresetRange = preset => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

  const clearDateFilter = () => {
    setDatePreset('all'); setCustomApplied(false);
    setFromDate(''); setToDate(''); setShowCustom(false);
  };

  const formatInput = t => {
    const clean = t.replace(/\D/g, '');
    if (clean.length >= 5) return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
    if (clean.length >= 3) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    return clean;
  };

  // ── derived lists ──────────────────────────────────────────────────────────
  const completedLeads = allLeads.filter(i => i.status === 'completed');
  const rejectedLeads  = allLeads.filter(i => i.status === 'rejected');
  const otherLeads     = allLeads.filter(i => i.status !== 'completed' && i.status !== 'rejected');

  const statusFiltered =
    activeFilter === 'completed' ? completedLeads :
    activeFilter === 'rejected'  ? rejectedLeads  :
    activeFilter === 'other'     ? otherLeads      :
    allLeads;

  const searchFiltered = searchQuery.trim()
    ? statusFiltered.filter(i => {
        const q = searchQuery.toLowerCase();
        return [i.name, i.phone, i.city, i.referredBy, i.surveyorNumber]
          .some(v => v && v.toLowerCase().includes(q));
      })
    : statusFiltered;

  const filteredLeads = applyDateFilter(searchFiltered);
  const isDateActive  = datePreset !== 'all' || customApplied;

  const todayLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const presetLabel =
    datePreset === 'today'     ? 'Today'       :
    datePreset === 'yesterday' ? 'Yesterday'   :
    datePreset === 'last7'     ? 'Last 7 days' :
    datePreset === 'last30'    ? 'Last 30 days':
    datePreset === 'thisMonth' ? 'This month'  : '';

  const renderCard = item => {
  if (item.status === 'completed')
    return <CompletedCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />;
  if (item.status === 'rejected')
    return <RejectedCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />;
  return <OtherCard key={item.id} item={item} onEdit={handleEdit} onDelete={handleDelete} />;
};

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* EDIT MODAL */}
      <EditModal
        visible={editVisible}
        item={selectedItem}
        onClose={() => setEditVisible(false)}
        onSave={() => fetchLeads()}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{todayLabel}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { num: allLeads.length,       label: 'Total leads', dot: '#fff' },
            { num: completedLeads.length, label: 'Completed',   dot: '#97C459' },
            { num: rejectedLeads.length,  label: 'Rejected',    dot: '#F09595' },
            { num: otherLeads.length,     label: 'Others',      dot: '#85B7EB' },
          ].map((s, i) => (
            <View key={i} style={styles.statBox}>
              <View style={[styles.statDot, { backgroundColor: s.dot }]} />
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.createLeadBtn}
          onPress={() => navigation.navigate(SCREEN_NAMES.CREATE_LEAD)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={18} color="#C8000A" />
          <Text style={styles.createLeadBtnText}>Create New Lead</Text>
        </TouchableOpacity>
      </View>

      {/* STATUS FILTER */}
      <View style={styles.filterStrip}>
        {[
          { key: 'all',       label: `All (${allLeads.length})` },
          { key: 'completed', label: `Done (${completedLeads.length})` },
          { key: 'rejected',  label: `Rej (${rejectedLeads.length})` },
          { key: 'other',     label: `Other (${otherLeads.length})` },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={[
              styles.filterChip,
              activeFilter === f.key && (
                f.key === 'completed' ? styles.chipDone :
                f.key === 'rejected'  ? styles.chipRej  :
                f.key === 'other'     ? styles.chipOther :
                styles.chipAll
              ),
            ]}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === f.key && (
                f.key === 'completed' ? { color: '#27500A' } :
                f.key === 'rejected'  ? { color: '#791F1F' } :
                f.key === 'other'     ? { color: '#0C447C' } :
                { color: '#fff' }
              ),
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SEARCH */}
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

      {/* DATE PRESET BAR */}
      <View style={styles.dateBar}>
        <Ionicons name="calendar-outline" size={15} color="#aaa" />
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={{ flex: 1, marginHorizontal: 6 }}
          contentContainerStyle={{ gap: 6, paddingRight: 4 }}
        >
          {[
            { key: 'all',       label: 'All' },
            { key: 'today',     label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'last7',     label: 'Last 7 days' },
            { key: 'last30',    label: 'Last 30 days' },
            { key: 'thisMonth', label: 'This month' },
          ].map(p => (
            <TouchableOpacity
              key={p.key}
              onPress={() => { setDatePreset(p.key); setCustomApplied(false); setShowCustom(false); }}
              style={[styles.dateChip, datePreset === p.key && !customApplied && styles.dateChipActive]}
            >
              <Text style={[styles.dateChipText, datePreset === p.key && !customApplied && { color: '#fff' }]}>
                {p.label}
              </Text>
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

      {/* CUSTOM DATE RANGE */}
      {showCustom && (
        <View style={styles.customRange}>
          <Text style={styles.rangeLbl}>From</Text>
          <TextInput
            style={styles.rangeInput} placeholder="DD/MM/YYYY" placeholderTextColor="#ccc"
            value={fromDate} onChangeText={t => setFromDate(formatInput(t))}
            keyboardType="numeric" maxLength={10}
          />
          <Text style={styles.rangeSep}>–</Text>
          <TextInput
            style={styles.rangeInput} placeholder="DD/MM/YYYY" placeholderTextColor="#ccc"
            value={toDate} onChangeText={t => setToDate(formatInput(t))}
            keyboardType="numeric" maxLength={10}
          />
          <TouchableOpacity
            style={[styles.applyBtn, (!fromDate || !toDate) && { opacity: 0.5 }]}
            disabled={!fromDate || !toDate}
            onPress={() => { if (fromDate && toDate) { setCustomApplied(true); setDatePreset('all'); } }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RESULT BAR */}
      {(isDateActive || searchQuery.trim()) && (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            {customApplied ? `  ·  ${fromDate} – ${toDate}` : presetLabel ? `  ·  ${presetLabel}` : ''}
            {searchQuery.trim() ? `  ·  "${searchQuery}"` : ''}
          </Text>
          <TouchableOpacity onPress={() => { clearDateFilter(); setSearchQuery(''); }}>
            <Text style={styles.clearTxt}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LEAD LIST */}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 36, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchLeads(true)} colors={['#C8000A']} />
        }
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
    </View>
  );
};

export default AdminScreen;
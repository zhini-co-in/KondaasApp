import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Alert, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';
import { USER_DATA } from '../service/localStorage';
import { SCREEN_NAMES } from '../constants/screenNames';

// ─────────────────────────────────────────────────────────────────────────────
// Premium Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Header ──
  header: {
    backgroundColor: '#C8000A',
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3,
  },
  datePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  datePillText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  statDot:   { width: 7, height: 7, borderRadius: 4, marginBottom: 6 },
  statNum:   { fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 24 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 },

  // ── Status filter ──
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
  chipAll:        { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipDone:       { backgroundColor: '#EAF3DE', borderColor: '#97C459' },
  chipRej:        { backgroundColor: '#FCEBEB', borderColor: '#F09595' },

  // ── Date bar ──
  dateBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#EAEAEA',
    backgroundColor: '#fff',
  },
  dateChipActive: { backgroundColor: '#C8000A', borderColor: '#C8000A' },
  dateChipText:   { fontSize: 11, fontWeight: '600', color: '#888' },
  calBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#EAEAEA',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Custom range ──
  customRange: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#EAEAEA',
  },
  rangeLbl:   { fontSize: 11, color: '#aaa' },
  rangeInput: {
    flex: 1, borderWidth: 1, borderColor: '#EAEAEA',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6,
    fontSize: 12, color: '#333',
  },
  rangeSep:  { fontSize: 12, color: '#aaa' },
  applyBtn:  {
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: '#C8000A', borderRadius: 8,
  },

  // ── Result bar ──
  resultBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3F3',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#F0CECE',
  },
  resultTxt: { fontSize: 11, color: '#A32D2D', fontWeight: '600' },
  clearTxt:  { fontSize: 11, color: '#A32D2D', textDecorationLine: 'underline' },

  // ── PREMIUM CARD STYLES ──
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 2,
  },

  cardStripe: {
    height: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },

  cardInner: {
    padding: 16,
  },

  // ── Top section with badge ──
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 10,
  },

  refTag: {
    backgroundColor: '#FAEEDA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#F0D699',
  },
  refTagText: {
    fontSize: 10.5,
    color: '#854F0B',
    fontWeight: '500',
  },

  // ── Premium Badges ──
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },

  badgeDone: {
    backgroundColor: '#EAF3DE',
    borderWidth: 1,
    borderColor: '#D1E9B8',
  },
  badgeDoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#27500A',
    letterSpacing: 0.2,
  },

  badgeRej: {
    backgroundColor: '#FCEBEB',
    borderWidth: 1,
    borderColor: '#F5CDCD',
  },
  badgeRejText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#791F1F',
    letterSpacing: 0.2,
  },

  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // ── Person section ──
  personRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },

  av: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  avDone: {
    backgroundColor: '#EAF3DE',
  },
  avRej: {
    backgroundColor: '#FCEBEB',
  },
  avText: {
    fontSize: 18,
    fontWeight: '700',
  },

  personMeta: {
    flex: 1,
  },

  pname: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: -0.2,
  },

  pmeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },

  pmetaText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },

  pdatePill: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#EAEAEA',
  },

  pdateText: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 12,
  },

  // ── Info section ──
  infoBlock: {
    gap: 10,
  },

  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  infoIcon: {
    marginTop: 2,
    opacity: 0.6,
  },

  infoKey: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    width: 65,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2a2a2a',
    flex: 1,
    lineHeight: 18,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Premium CompletedCard
// ─────────────────────────────────────────────────────────────────────────────
const CompletedCard = ({ item }) => (
  <View style={styles.card}>
    <LinearGradient
      colors={['#639922', '#97C459']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.cardStripe}
    />
    <View style={styles.cardInner}>
      {/* Top Row - Ref Tag & Badge */}
      <View style={styles.topRow}>
        <View style={styles.refTag}>
          <Text style={styles.refTagText}>
            Referred by —{' '}
            <Text style={{ fontWeight: '700' }}>{item.referredBy || 'N/A'}</Text>
          </Text>
        </View>
        <View style={[styles.badgeBase, styles.badgeDone]}>
          <View style={[styles.badgeDot, { backgroundColor: '#639922' }]} />
          <Text style={styles.badgeDoneText}>✓ Completed</Text>
        </View>
      </View>

      {/* Person Info */}
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avDone]}>
          <Text style={[styles.avText, { color: '#27500A' }]}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name || '—'}</Text>
          <View style={styles.pmeta}>
            <Ionicons name="call-outline" size={13} color="#999" />
            <Text style={styles.pmetaText}>{item.phone || '—'}</Text>
          </View>
          <View style={styles.pmeta}>
            <Ionicons name="location-outline" size={13} color="#999" />
            <Text style={styles.pmetaText}>{item.city || '—'}</Text>
          </View>
        </View>
        <View style={styles.pdatePill}>
          <Text style={styles.pdateText}>{item.date}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Info Block */}
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}>
          <Ionicons
            name="person-outline"
            size={14}
            color="#999"
            style={styles.infoIcon}
          />
          <Text style={styles.infoKey}>Surveyor</Text>
          <Text style={styles.infoVal}>{item.surveyorNumber || '—'}</Text>
        </View>
        <View style={styles.infoLine}>
          <Ionicons
            name="checkmark-done-outline"
            size={14}
            color="#639922"
            style={styles.infoIcon}
          />
          <Text style={styles.infoKey}>Reason</Text>
          <Text style={styles.infoVal}>
            {item.completionReason || 'Survey completed successfully'}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Premium RejectedCard
// ─────────────────────────────────────────────────────────────────────────────
const RejectedCard = ({ item }) => (
  <View style={styles.card}>
    <LinearGradient
      colors={['#A32D2D', '#E24B4A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.cardStripe}
    />
    <View style={styles.cardInner}>
      {/* Top Row - Ref Tag & Badge */}
      <View style={styles.topRow}>
        <View style={styles.refTag}>
          <Text style={styles.refTagText}>
            Referred by —{' '}
            <Text style={{ fontWeight: '700' }}>{item.referredBy || 'N/A'}</Text>
          </Text>
        </View>
        <View style={[styles.badgeBase, styles.badgeRej]}>
          <View style={[styles.badgeDot, { backgroundColor: '#E24B4A' }]} />
          <Text style={styles.badgeRejText}>✕ Rejected</Text>
        </View>
      </View>

      {/* Person Info */}
      <View style={styles.personRow}>
        <View style={[styles.av, styles.avRej]}>
          <Text style={[styles.avText, { color: '#791F1F' }]}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.pname}>{item.name || '—'}</Text>
          <View style={styles.pmeta}>
            <Ionicons name="call-outline" size={13} color="#999" />
            <Text style={styles.pmetaText}>{item.phone || '—'}</Text>
          </View>
          <View style={styles.pmeta}>
            <Ionicons name="location-outline" size={13} color="#999" />
            <Text style={styles.pmetaText}>{item.city || '—'}</Text>
          </View>
        </View>
        <View style={styles.pdatePill}>
          <Text style={styles.pdateText}>{item.date}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Info Block */}
      <View style={styles.infoBlock}>
        <View style={styles.infoLine}>
          <Ionicons
            name="person-remove-outline"
            size={14}
            color="#E24B4A"
            style={styles.infoIcon}
          />
          <Text style={styles.infoKey}>Rejected By</Text>
          <Text style={styles.infoVal}>{item.surveyorNumber || '—'}</Text>
        </View>
        <View style={styles.infoLine}>
          <Ionicons
            name="alert-circle-outline"
            size={14}
            color="#A32D2D"
            style={styles.infoIcon}
          />
          <Text style={styles.infoKey}>Reason</Text>
          <Text style={styles.infoVal}>
            {item.comment || 'Rejected due to survey issues'}
          </Text>
        </View>
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// AdminScreen
// ─────────────────────────────────────────────────────────────────────────────
const AdminScreen = ({ navigation }) => {
  const [activeFilter, setActiveFilter]     = useState('all');
  const [completedLeads, setCompletedLeads] = useState([]);
  const [rejectedLeads, setRejectedLeads]   = useState([]);
  const [loading, setLoading]               = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  // ── Date filter state ──
  const [datePreset, setDatePreset]         = useState('all');
  const [fromDate, setFromDate]             = useState('');
  const [toDate, setToDate]                 = useState('');
  const [showCustom, setShowCustom]         = useState(false);
  const [customApplied, setCustomApplied]   = useState(false);

  // ── Fetch leads ──
  const fetchLeads = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const allRes = await API.get('/order/all');
      const rawAll = Array.isArray(allRes.data)
        ? allRes.data
        : Array.isArray(allRes.data?.data)
        ? allRes.data.data
        : [];

      setCompletedLeads(
        rawAll
          .filter((i) => i.status === 'completed')
          .map((i) => ({
            id:               i._id,
            name:             i.name,
            phone:            i.mobile,
            city:             i.city,
            referredBy:       i.referredBy,
            surveyorNumber:   i.surveyorNumber,
            completionReason: i.completionReason,
            date:             i.createdAt
              ? new Date(i.createdAt).toLocaleDateString('en-IN')
              : '—',
            status: 'completed',
          }))
      );
    } catch (e) {
      console.log('[AdminScreen] /order/all error:', e?.message);
    }

    try {
      const rejRes = await API.get('/order/admin-rejections');
      const rawRej = Array.isArray(rejRes.data)
        ? rejRes.data
        : Array.isArray(rejRes.data?.data)
        ? rejRes.data.data
        : [];

      setRejectedLeads(
        rawRej.map((i) => ({
          id:             i._id,
          name:           i.name           || i.customerName   || '—',
          phone:          i.mobile         || i.customerMobile || i.phone || '—',
          city:           i.city           || '—',
          referredBy:     i.referredBy     || '—',
          surveyorNumber: i.surveyorNumber || '—',
          comment:        i.comment        || i.reason         || i.rejectReason || '—',
          date: (i.time || i.createdAt || i.rejectedAt)
            ? new Date(i.time || i.createdAt || i.rejectedAt).toLocaleDateString('en-IN')
            : '—',
          status: 'rejected',
        }))
      );
    } catch (e) {
      console.log('[AdminScreen] /order/admin-rejections error:', e?.message);
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, []);

  // ── Logout ──
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          await AsyncStorage.removeItem(USER_DATA);
          navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.LOGIN }] });
        },
      },
    ]);
  };

  // ── Date helpers ──
  const parseCardDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  };

  const getPresetRange = (preset) => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (preset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { from: y, to: y };
      }
      case 'last7':
        return { from: new Date(today.getTime() - 6 * 86400000), to: today };
      case 'last30':
        return { from: new Date(today.getTime() - 29 * 86400000), to: today };
      case 'thisMonth':
        return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
      default:
        return null;
    }
  };

  const parseInputDate = (str) => {
    if (!str || str.length !== 10) return null;
    const [d, m, y] = str.split('/');
    const dt = new Date(`${y}-${m}-${d}`);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const applyDateFilter = (leads) => {
    if (datePreset === 'all' && !customApplied) return leads;
    let from, to;
    if (customApplied) {
      from = parseInputDate(fromDate);
      to   = parseInputDate(toDate);
      if (!from || !to) return leads;
      to.setHours(23, 59, 59, 999);
    } else {
      const range = getPresetRange(datePreset);
      if (!range) return leads;
      from = range.from;
      to   = new Date(range.to);
      to.setHours(23, 59, 59, 999);
    }
    return leads.filter((item) => {
      const d = parseCardDate(item.date);
      return d && d >= from && d <= to;
    });
  };

  const clearDateFilter = () => {
    setDatePreset('all');
    setCustomApplied(false);
    setFromDate('');
    setToDate('');
    setShowCustom(false);
  };

  const formatInput = (t) => {
    const clean = t.replace(/\D/g, '');
    if (clean.length >= 5)
      return clean.slice(0, 2) + '/' + clean.slice(2, 4) + '/' + clean.slice(4, 8);
    if (clean.length >= 3)
      return clean.slice(0, 2) + '/' + clean.slice(2);
    return clean;
  };

  // ── Derived lists ──
  const allLeads       = [...completedLeads, ...rejectedLeads];
  const statusFiltered =
    activeFilter === 'completed' ? completedLeads :
    activeFilter === 'rejected'  ? rejectedLeads  :
    allLeads;
  const filteredLeads  = applyDateFilter(statusFiltered);
  const isDateActive   = datePreset !== 'all' || customApplied;

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const presetLabel =
    datePreset === 'today'     ? 'Today'        :
    datePreset === 'yesterday' ? 'Yesterday'    :
    datePreset === 'last7'     ? 'Last 7 days'  :
    datePreset === 'last30'    ? 'Last 30 days' :
    datePreset === 'thisMonth' ? 'This month'   : '';

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── HEADER ── */}
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
          ].map((s, i) => (
            <View key={i} style={styles.statBox}>
              <View style={[styles.statDot, { backgroundColor: s.dot }]} />
              <Text style={styles.statNum}>{s.num}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── STATUS FILTER ── */}
      <View style={styles.filterStrip}>
        {[
          { key: 'all',       label: `All (${allLeads.length})` },
          { key: 'completed', label: `Completed (${completedLeads.length})` },
          { key: 'rejected',  label: `Rejected (${rejectedLeads.length})` },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => {
              setActiveFilter(f.key);
              if (f.key === 'all') fetchLeads();
            }}
            style={[
              styles.filterChip,
              activeFilter === f.key && (
                f.key === 'completed' ? styles.chipDone :
                f.key === 'rejected'  ? styles.chipRej  :
                styles.chipAll
              ),
            ]}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === f.key && (
                f.key === 'completed' ? { color: '#27500A' } :
                f.key === 'rejected'  ? { color: '#791F1F' } :
                { color: '#fff' }
              ),
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── DATE PRESET BAR ── */}
      <View style={styles.dateBar}>
        <Ionicons name="calendar-outline" size={15} color="#aaa" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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
          ].map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => {
                setDatePreset(p.key);
                setCustomApplied(false);
                setShowCustom(false);
              }}
              style={[
                styles.dateChip,
                datePreset === p.key && !customApplied && styles.dateChipActive,
              ]}
            >
              <Text style={[
                styles.dateChipText,
                datePreset === p.key && !customApplied && { color: '#fff' },
              ]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[
            styles.calBtn,
            showCustom && { backgroundColor: '#FCEBEB', borderColor: '#F09595' },
          ]}
          onPress={() => setShowCustom((v) => !v)}
        >
          <Ionicons
            name="calendar"
            size={15}
            color={showCustom ? '#A32D2D' : '#888'}
          />
        </TouchableOpacity>
      </View>

      {/* ── CUSTOM DATE RANGE ── */}
      {showCustom && (
        <View style={styles.customRange}>
          <Text style={styles.rangeLbl}>From</Text>
          <TextInput
            style={styles.rangeInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#ccc"
            value={fromDate}
            onChangeText={(t) => setFromDate(formatInput(t))}
            keyboardType="numeric"
            maxLength={10}
          />
          <Text style={styles.rangeSep}>–</Text>
          <TextInput
            style={styles.rangeInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#ccc"
            value={toDate}
            onChangeText={(t) => setToDate(formatInput(t))}
            keyboardType="numeric"
            maxLength={10}
          />
          <TouchableOpacity
            style={[styles.applyBtn, (!fromDate || !toDate) && { opacity: 0.5 }]}
            disabled={!fromDate || !toDate}
            onPress={() => {
              if (fromDate && toDate) {
                setCustomApplied(true);
                setDatePreset('all');
              }
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              Apply
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── RESULT BAR ── */}
      {isDateActive && (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            {customApplied
              ? `  ·  ${fromDate} – ${toDate}`
              : presetLabel
              ? `  ·  ${presetLabel}`
              : ''}
          </Text>
          <TouchableOpacity onPress={clearDateFilter}>
            <Text style={styles.clearTxt}>Clear filter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── LEAD LIST ── */}
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 36, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchLeads(true)}
            colors={['#C8000A']}
          />
        }
      >
        {loading && (
          <ActivityIndicator size="large" color="#C8000A" style={{ marginTop: 40 }} />
        )}

        {!loading && filteredLeads.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="document-outline" size={44} color="#ddd" />
            <Text style={{ color: '#bbb', fontSize: 13, marginTop: 10 }}>
              No leads found.
            </Text>
          </View>
        )}

        {!loading && filteredLeads.map((item) =>
          item.status === 'completed'
            ? <CompletedCard key={item.id} item={item} />
            : <RejectedCard  key={item.id} item={item} />
        )}
      </ScrollView>
    </View>
  );
};

export default AdminScreen;
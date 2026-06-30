import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';

const fmtDate = val => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
};

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

// Normalise a raw installer_completed / installer_reject document into a
// consistent shape the card UI can render, regardless of which field names
// the backend happened to store the value under.
const normaliseInstallerDoc = (raw, idx) => ({
  id:         raw._id || String(idx),
  name:       raw.deal_name || raw.name || raw.customerName || '—',
  phone:      raw.mobile || raw.phone || raw.customerMobile || '—',
  city:       raw.city || raw.City || '—',
  referredBy: raw.referredBy || raw.referred_by || 'N/A',
  installer:  raw.installer || raw.installerNumber || raw.assignedTo || raw.mobileNumber || '—',
  comment:    raw.comment || raw.completionReason || raw.reason || raw.rejectReason || '—',
  date:       fmtDate(raw.time || raw.createdAt || raw.date || raw.assignedAt),
  rawDate:    raw.time || raw.createdAt || raw.date || raw.assignedAt || null,
  dealId:     raw.deal_id || raw._id || null,
});

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#C8000A',
    paddingTop: 48,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginTop: 1 },

  tabRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  tabBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  tabBtnText: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  tabBtnTextActive: { color: '#C8000A' },

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
    borderRadius: 8, borderWidth: 0.5, borderColor: '#F0D699', flex: 1,
  },
  refTagText: { fontSize: 10.5, color: '#854F0B', fontWeight: '500' },
  badgeBase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeDone:          { backgroundColor: '#EAF3DE', borderWidth: 1, borderColor: '#D1E9B8' },
  badgeDoneText:      { fontSize: 11, fontWeight: '700', color: '#27500A', letterSpacing: 0.2 },
  badgeRejected:      { backgroundColor: '#FCEBEB', borderWidth: 1, borderColor: '#F5CDCD' },
  badgeRejectedText:  { fontSize: 11, fontWeight: '700', color: '#791F1F', letterSpacing: 0.2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  av: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avDone:     { backgroundColor: '#EAF3DE' },
  avRejected: { backgroundColor: '#FCEBEB' },
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
});

const InstallerCard = ({ item, type }) => {
  const isDone = type === 'completed';
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={isDone ? ['#639922', '#97C459'] : ['#A32D2D', '#E24B4A']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.cardStripe}
      />
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <View style={styles.refTag}>
            <Text style={styles.refTagText}>Referred by — <Text style={{ fontWeight: '700' }}>{item.referredBy}</Text></Text>
          </View>
          <View style={[styles.badgeBase, isDone ? styles.badgeDone : styles.badgeRejected]}>
            <View style={[styles.badgeDot, { backgroundColor: isDone ? '#639922' : '#E24B4A' }]} />
            <Text style={isDone ? styles.badgeDoneText : styles.badgeRejectedText}>
              {isDone ? '✓ Completed' : '✕ Rejected'}
            </Text>
          </View>
        </View>

        <View style={styles.personRow}>
          <View style={[styles.av, isDone ? styles.avDone : styles.avRejected]}>
            <Text style={[styles.avText, { color: isDone ? '#27500A' : '#791F1F' }]}>{initial(item.name)}</Text>
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
            <Ionicons name="construct-outline" size={14} color="#D97706" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Installer</Text>
            <Text style={styles.infoVal}>{item.installer}</Text>
          </View>
          <View style={styles.infoLine}>
            <Ionicons name={isDone ? 'checkmark-done-outline' : 'alert-circle-outline'} size={14} color={isDone ? '#639922' : '#A32D2D'} style={styles.infoIcon} />
            <Text style={styles.infoKey}>{isDone ? 'Remarks' : 'Reason'}</Text>
            <Text style={styles.infoVal}>{item.comment}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const InstallerStatusScreen = ({ navigation, route }) => {
  const initialTab = route?.params?.status === 'rejected' ? 'rejected' : 'completed';
  const [tab, setTab]             = useState(initialTab);
  const [completedData, setCompletedData] = useState([]);
  const [rejectedData, setRejectedData]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [completedRes, rejectedRes] = await Promise.all([
        API.get('/admin/installer-completions'),
        API.get('/admin/installer-rejections'),
      ]);

      const rawCompleted = Array.isArray(completedRes.data?.data) ? completedRes.data.data : [];
      const rawRejected  = Array.isArray(rejectedRes.data?.data) ? rejectedRes.data.data : [];

      setCompletedData(rawCompleted.map((item, idx) => normaliseInstallerDoc(item, `ic_${idx}`)));
      setRejectedData(rawRejected.map((item, idx) => normaliseInstallerDoc(item, `ir_${idx}`)));
    } catch (e) {
      console.log('[InstallerStatusScreen] fetch error:', e?.message);
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeData = tab === 'completed' ? completedData : rejectedData;

  const filteredData = searchQuery.trim()
    ? activeData.filter(i => {
        const q = searchQuery.toLowerCase();
        return [i.name, i.phone, i.city, i.referredBy, i.installer].some(v => v && v.toLowerCase().includes(q));
      })
    : activeData;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={19} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Installer Status</Text>
            <Text style={styles.headerSub}>Completed &amp; Rejected leads</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'completed' && styles.tabBtnActive]}
            onPress={() => setTab('completed')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, tab === 'completed' && styles.tabBtnTextActive]}>
              Completed ({completedData.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'rejected' && styles.tabBtnActive]}
            onPress={() => setTab('rejected')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabBtnText, tab === 'rejected' && styles.tabBtnTextActive]}>
              Rejected ({rejectedData.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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

      {searchQuery.trim() ? (
        <View style={styles.resultBar}>
          <Text style={styles.resultTxt}>
            {filteredData.length} lead{filteredData.length !== 1 ? 's' : ''} · "{searchQuery}"
          </Text>
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearTxt}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={['#C8000A']} />}
      >
        {loading && <ActivityIndicator size="large" color="#C8000A" style={{ marginTop: 40 }} />}

        {!loading && filteredData.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="document-outline" size={44} color="#ddd" />
            <Text style={{ color: '#bbb', fontSize: 13, marginTop: 10 }}>No leads found.</Text>
          </View>
        )}

        {!loading && filteredData.map(item => (
          <InstallerCard key={item.id} item={item} type={tab} />
        ))}
      </ScrollView>
    </View>
  );
};

export default InstallerStatusScreen;
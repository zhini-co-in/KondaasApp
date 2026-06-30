import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';

const fmtDate = val => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
};

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

// Normalises a record coming from logistics_completed / logistics_reject collections.
// Field names are guessed from common patterns used elsewhere in the app — adjust
// the raw.* keys below if your collection uses different field names.
const normaliseLogistic = (raw, idx) => ({
  id:          raw._id || String(idx),
  dealId:      raw.deal_id || raw.dealId || null,
  name:        raw.customerName || raw.name || raw.deal_name || '—',
  phone:       raw.mobile || raw.customerMobile || raw.phone || '—',
  city:        raw.city || raw.City || '—',
  address:     raw.address || raw.Street_Address || '—',
  assignee:    raw.logisticAssignee || raw.mobile_logistic || raw.assignedTo || '—',
  productsInfo: Array.isArray(raw.products_info) ? raw.products_info.join(', ') : (raw.products_info || raw.Product_Name || '—'),
  reason:      raw.reason || raw.rejectReason || raw.comment || '—',
  date:        fmtDate(raw.time || raw.createdAt || raw.assignedAt),
  rawDate:     raw.time || raw.createdAt || raw.assignedAt || null,
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
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
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  cardStripe: { height: 5 },
  cardInner: { padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  badgeBase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  personRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  av: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 18, fontWeight: '700' },
  personMeta: { flex: 1 },
  pname: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
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
  infoKey: { fontSize: 11, color: '#999', fontWeight: '600', width: 80, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#2a2a2a', flex: 1, lineHeight: 18 },
});

const LogisticStatusScreen = ({ navigation, route }) => {
  const status = route?.params?.status === 'rejected' ? 'rejected' : 'completed';
  const isCompleted = status === 'completed';

  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const endpoint = isCompleted ? '/admin/logistics-completions' : '/admin/logistics-rejections';
      const res = await API.get(endpoint);
      const raw = Array.isArray(res.data?.data) ? res.data.data : [];
      setRecords(raw.map((item, idx) => normaliseLogistic(item, idx)));
    } catch (e) {
      console.log('[LogisticStatusScreen] fetch error:', e?.message);
      setRecords([]);
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, [isCompleted]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = searchQuery.trim()
    ? records.filter(r => {
        const q = searchQuery.toLowerCase();
        return [r.name, r.phone, r.city, r.assignee, r.dealId].some(v => v && String(v).toLowerCase().includes(q));
      })
    : records;

  const stripeColors = isCompleted ? ['#639922', '#97C459'] : ['#A32D2D', '#E24B4A'];
  const badgeBg   = isCompleted ? '#EAF3DE' : '#FCEBEB';
  const badgeBorder = isCompleted ? '#D1E9B8' : '#F5CDCD';
  const badgeText = isCompleted ? '#27500A' : '#791F1F';
  const dotColor  = isCompleted ? '#639922' : '#E24B4A';
  const avBg      = isCompleted ? '#EAF3DE' : '#FCEBEB';
  const avText    = isCompleted ? '#27500A' : '#791F1F';

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <LinearGradient colors={stripeColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardStripe} />
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <Text style={{ fontSize: 11, color: '#999', fontWeight: '600' }}>
            {item.dealId ? `Deal ID: ${item.dealId}` : ''}
          </Text>
          <View style={[styles.badgeBase, { backgroundColor: badgeBg, borderWidth: 1, borderColor: badgeBorder }]}>
            <View style={[styles.badgeDot, { backgroundColor: dotColor }]} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: badgeText }}>
              {isCompleted ? '✓ Completed' : '✕ Rejected'}
            </Text>
          </View>
        </View>

        <View style={styles.personRow}>
          <View style={[styles.av, { backgroundColor: avBg }]}>
            <Text style={[styles.avText, { color: avText }]}>{initial(item.name)}</Text>
          </View>
          <View style={styles.personMeta}>
            <Text style={styles.pname}>{item.name}</Text>
            <View style={styles.pmeta}>
              <Ionicons name="call-outline" size={13} color="#999" />
              <Text style={styles.pmetaText}>{item.phone}</Text>
            </View>
            <View style={styles.pmeta}>
              <Ionicons name="location-outline" size={13} color="#999" />
              <Text style={styles.pmetaText}>{item.city}</Text>
            </View>
          </View>
          <View style={styles.pdatePill}><Text style={styles.pdateText}>{item.date}</Text></View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoBlock}>
          <View style={styles.infoLine}>
            <Ionicons name="cube-outline" size={14} color="#7C3AED" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Logistic</Text>
            <Text style={styles.infoVal}>{item.assignee}</Text>
          </View>
          <View style={styles.infoLine}>
            <Ionicons name="construct-outline" size={14} color="#999" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Products</Text>
            <Text style={styles.infoVal}>{item.productsInfo}</Text>
          </View>
          <View style={styles.infoLine}>
            <Ionicons name="home-outline" size={14} color="#999" style={styles.infoIcon} />
            <Text style={styles.infoKey}>Address</Text>
            <Text style={styles.infoVal}>{item.address}</Text>
          </View>
          {!isCompleted && (
            <View style={styles.infoLine}>
              <Ionicons name="alert-circle-outline" size={14} color="#A32D2D" style={styles.infoIcon} />
              <Text style={styles.infoKey}>Reason</Text>
              <Text style={styles.infoVal}>{item.reason}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F9F9FB' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={19} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Logistic {isCompleted ? 'Completed' : 'Rejected'}</Text>
            <Text style={styles.headerSub}>{records.length} record{records.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color="#aaa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, city, deal id..."
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
          <Text style={styles.resultTxt}>{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{searchQuery}"</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#C8000A" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={['#C8000A']} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="document-outline" size={44} color="#ddd" />
              <Text style={{ color: '#bbb', fontSize: 13, marginTop: 10 }}>No records found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default LogisticStatusScreen;
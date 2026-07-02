import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, ActivityIndicator, FlatList, Alert, Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

const AVATAR_COLORS = [
  { bg: '#E6F1FB', text: '#0C447C' },
  { bg: '#EAF3DE', text: '#27500A' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#F3E8FF', text: '#6B21A8' },
  { bg: '#FCEBEB', text: '#791F1F' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FB' },

  header: {
    backgroundColor: '#C8000A',
    paddingTop: 52, paddingHorizontal: 18, paddingBottom: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flex: 1 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.4,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8,
  },

  // Employee picker
  empSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  empSearchInput: { flex: 1, fontSize: 13, color: '#333', paddingVertical: 0 },
  empItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#F5F5F5',
  },
  empItemActive: { backgroundColor: '#FEF3F3' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  empName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#C8000A',
    alignItems: 'center', justifyContent: 'center',
  },

  // Selected employee chip
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3F3', marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: '#F0CECE',
  },
  selectedChipText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#A32D2D' },

  // Date row
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 4,
  },
  dateBox: { flex: 1 },
  dateLbl: { fontSize: 10, color: '#999', fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  dateInput: {
    borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  dateSep: { fontSize: 14, color: '#ccc', marginTop: 16 },

  fetchBtn: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    backgroundColor: '#C8000A', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  fetchBtnDisabled: { opacity: 0.5 },
  fetchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Results
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8,
  },
  resultTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  resultCount: { fontSize: 11, color: '#999', fontWeight: '600' },

  // Dashboard stat cards
  dashboardWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  statCard: {
    flexBasis: '47%', flexGrow: 1,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  statCardAccent: {
    backgroundColor: '#C8000A', borderColor: '#C8000A',
  },
  statTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  statIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#FCEBEB',
    alignItems: 'center', justifyContent: 'center',
  },
  statIconWrapAccent: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  statValueAccent: { color: '#fff' },
  statLabel: { fontSize: 11, color: '#999', fontWeight: '600', marginTop: 2 },
  statLabelAccent: { color: 'rgba(255,255,255,0.85)' },
  statSubtext: { fontSize: 10, color: '#bbb', marginTop: 1 },
  statSubtextAccent: { color: 'rgba(255,255,255,0.7)' },

  dayCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9F9FB', paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 0.5, borderBottomColor: '#EFEFEF',
  },
  dayHeaderText: { fontSize: 12.5, fontWeight: '700', color: '#1a1a1a' },
  dayHeaderCount: {
    marginLeft: 'auto', fontSize: 10, fontWeight: '700', color: '#A32D2D',
    backgroundColor: '#FCEBEB', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 0.5, borderBottomColor: '#F7F7F7',
  },
  entryTime: { fontSize: 12, fontWeight: '700', color: '#378ADD', width: 56 },
  entryCoord: { fontSize: 11.5, color: '#666', flex: 1 },

  empty: { alignItems: 'center', paddingTop: 50, paddingBottom: 30 },
  emptyText: { fontSize: 13, color: '#bbb', marginTop: 10, fontWeight: '500' },
});

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatInput = t => {
  const c = t.replace(/\D/g, '');
  if (c.length >= 5) return `${c.slice(0, 2)}/${c.slice(2, 4)}/${c.slice(4, 8)}`;
  if (c.length >= 3) return `${c.slice(0, 2)}/${c.slice(2)}`;
  return c;
};

const ddmmyyyyToISO = str => {
  if (!str || str.length !== 10) return null;
  const [d, m, y] = str.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m}-${d}`;
};

const isoToDateObj = iso => {
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
};

const niceDate = iso => {
  const dt = isoToDateObj(iso);
  if (!dt) return iso;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' });
};

const EmployeeListScreen = ({ navigation, route }) => {
  const { employeeList = [] } = route.params || {};

  const [search, setSearch]               = useState('');
  const [selectedEmp, setSelectedEmp]      = useState(null);
  const [fromDate, setFromDate]            = useState('');
  const [toDate, setToDate]                = useState(todayStr());
  const [loading, setLoading]              = useState(false);
  const [results, setResults]              = useState(null); // [{date, entries}]
  const [hasSearched, setHasSearched]      = useState(false);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employeeList;
    const q = search.toLowerCase();
    return employeeList.filter(e => e.toLowerCase().includes(q));
  }, [search, employeeList]);

  const canFetch = !!selectedEmp && fromDate.length === 10 && toDate.length === 10 && !loading;

  const openLocationOnMap = (lat, lng, label) => {
    const enc = encodeURIComponent(label || 'Location');
    const url = `https://www.google.com/maps?q=${lat},${lng}(${enc})`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open map.'));
  };

  const handleFetch = async () => {
    const fromISO = ddmmyyyyToISO(fromDate);
    const toISO   = ddmmyyyyToISO(toDate);
    if (!fromISO || !toISO) { Alert.alert('Invalid date', 'Please enter dates as DD/MM/YYYY.'); return; }
    const fromD = isoToDateObj(fromISO);
    const toD   = isoToDateObj(toISO);
    if (!fromD || !toD) { Alert.alert('Invalid date', 'Please enter valid dates.'); return; }
    if (fromD > toD) { Alert.alert('Invalid range', 'From date must be before To date.'); return; }

    // Build list of dates in range
    // apiDate  -> format backend expects, e.g. "20260702" (no dashes)
    // isoDate  -> format used internally for display/grouping/sorting, e.g. "2026-07-02"
    const dates = [];
    let cur = new Date(fromD);
    while (cur <= toD) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push({
        apiDate: `${y}${m}${d}`,
        isoDate: `${y}-${m}-${d}`,
      });
      cur.setDate(cur.getDate() + 1);
      if (dates.length > 90) break; // safety cap ~3 months
    }

    setLoading(true);
    setHasSearched(true);
    const collected = [];
    try {
      for (const { apiDate, isoDate } of dates) {
        try {
          const res = await API.post('/location/bytime', {
            mobiles: [selectedEmp],
            date: apiDate,
            startTime: '12:00 AM',
            endTime: '11:59 PM',
          });
          const entries = res.data?.[0]?.entries || [];
          if (entries.length) collected.push({ date: isoDate, entries });
        } catch (e) {
          console.log('[EmployeeListScreen] day fetch error', apiDate, e?.message);
        }
      }
      setResults(collected);
      if (collected.length === 0) {
        Alert.alert('No data', 'No location history found for this employee in the selected range.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not fetch location history: ' + (e?.message || 'Unknown error'));
    }
    setLoading(false);
  };

  const totalEntries = (results || []).reduce((sum, d) => sum + d.entries.length, 0);
  const totalDays     = (results || []).length;
  const avgPerDay     = totalDays ? Math.round(totalEntries / totalDays) : 0;
  const busiestDay    = totalDays
    ? results.reduce((a, b) => (b.entries.length > a.entries.length ? b : a))
    : null;
  const firstDay = totalDays ? results[0] : null;
  const lastDay  = totalDays ? results[totalDays - 1] : null;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check Existing Employee Details</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Employee picker */}
        <Text style={styles.sectionLabel}>1. Select Employee</Text>

        {selectedEmp ? (
          <View style={styles.selectedChip}>
            <Ionicons name="person-circle-outline" size={16} color="#A32D2D" />
            <Text style={styles.selectedChipText}>{selectedEmp}</Text>
            <TouchableOpacity onPress={() => { setSelectedEmp(null); setResults(null); setHasSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#A32D2D" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.empSearchWrap}>
              <Ionicons name="search-outline" size={15} color="#aaa" />
              <TextInput
                style={styles.empSearchInput}
                placeholder="Search employee number..."
                placeholderTextColor="#ccc"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#aaa" />
                </TouchableOpacity>
              )}
            </View>

            {filteredEmployees.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={36} color="#ddd" />
                <Text style={styles.emptyText}>No employees found.</Text>
              </View>
            ) : (
              <FlatList
                data={filteredEmployees}
                keyExtractor={(item, idx) => item + idx}
                scrollEnabled={false}
                renderItem={({ item, index }) => {
                  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                  return (
                    <TouchableOpacity
                      style={styles.empItem}
                      activeOpacity={0.7}
                      onPress={() => { setSelectedEmp(item); setResults(null); setHasSearched(false); }}
                    >
                      <View style={[styles.avatar, { backgroundColor: color.bg }]}>
                        <Text style={[styles.avatarText, { color: color.text }]}>{initial(item)}</Text>
                      </View>
                      <Text style={styles.empName}>{item}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#ccc" />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        )}

        {/* Date range */}
        <Text style={styles.sectionLabel}>2. Select Date Range</Text>
        <View style={styles.dateRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLbl}>From</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#ccc"
              value={fromDate}
              onChangeText={t => setFromDate(formatInput(t))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
          <Text style={styles.dateSep}>–</Text>
          <View style={styles.dateBox}>
            <Text style={styles.dateLbl}>To</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#ccc"
              value={toDate}
              onChangeText={t => setToDate(formatInput(t))}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.fetchBtn, !canFetch && styles.fetchBtnDisabled]}
          disabled={!canFetch}
          onPress={handleFetch}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="navigate-outline" size={16} color="#fff" />}
          <Text style={styles.fetchBtnText}>{loading ? 'Fetching location…' : 'View Location History'}</Text>
        </TouchableOpacity>

        {/* Results */}
        {hasSearched && !loading && (
          <>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Location History</Text>
              <Text style={styles.resultCount}>{totalEntries} point{totalEntries !== 1 ? 's' : ''} · {(results || []).length} day{(results || []).length !== 1 ? 's' : ''}</Text>
            </View>

            {(!results || results.length === 0) ? (
              <View style={styles.empty}>
                <Ionicons name="location-outline" size={40} color="#ddd" />
                <Text style={styles.emptyText}>No location data found for this range.</Text>
              </View>
            ) : (
              <>
                {/* Dashboard summary cards */}
                <View style={styles.dashboardWrap}>
                  <View style={[styles.statCard, styles.statCardAccent]}>
                    <View style={styles.statTopRow}>
                      <View style={[styles.statIconWrap, styles.statIconWrapAccent]}>
                        <Ionicons name="location" size={15} color="#fff" />
                      </View>
                    </View>
                    <Text style={[styles.statValue, styles.statValueAccent]}>{totalEntries}</Text>
                    <Text style={[styles.statLabel, styles.statLabelAccent]}>Total Points</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="calendar" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{totalDays}</Text>
                    <Text style={styles.statLabel}>Days Covered</Text>
                    {firstDay && lastDay && (
                      <Text style={styles.statSubtext} numberOfLines={1}>
                        {niceDate(firstDay.date)} → {niceDate(lastDay.date)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="pulse" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{avgPerDay}</Text>
                    <Text style={styles.statLabel}>Avg Points / Day</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="flame" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{busiestDay?.entries.length ?? 0}</Text>
                    <Text style={styles.statLabel}>Busiest Day</Text>
                    {busiestDay && (
                      <Text style={styles.statSubtext} numberOfLines={1}>{niceDate(busiestDay.date)}</Text>
                    )}
                  </View>
                </View>

                {/* Day-wise breakdown */}
                {results.map(day => (
                  <View key={day.date} style={styles.dayCard}>
                    <View style={styles.dayHeader}>
                      <Ionicons name="calendar-outline" size={14} color="#666" />
                      <Text style={styles.dayHeaderText}>{niceDate(day.date)}</Text>
                      <Text style={styles.dayHeaderCount}>{day.entries.length}</Text>
                    </View>
                    {day.entries.map((entry, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.entryRow}
                        activeOpacity={0.6}
                        onPress={() => entry.latitude && entry.longitude && openLocationOnMap(entry.latitude, entry.longitude, `${selectedEmp} @ ${entry.time}`)}
                      >
                        <Text style={styles.entryTime}>{entry.time || '—'}</Text>
                        <Text style={styles.entryCoord} numberOfLines={1}>
                          {entry.latitude && entry.longitude ? `${entry.latitude}, ${entry.longitude}` : 'No coordinates'}
                        </Text>
                        {entry.latitude && entry.longitude && <Ionicons name="map-outline" size={15} color="#378ADD" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default EmployeeListScreen;
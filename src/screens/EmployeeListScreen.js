import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, ScrollView, ActivityIndicator, FlatList, Alert, Linking, Platform, Modal, PermissionsAndroid,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import API from '../api/api1';

/**
 * Deal distance API — confirmed shape from backend response:
 *   GET /admin/distance → { success, count, data: [...] }
 *   record: {
 *     _id, deal_id, deal_name, mobile,
 *     to_site: number (km), to_office: number (km),
 *     createdAt
 *   }
 * There's no lat/lng or city/surveyor field in the real payload, so the
 * route-bar / "view on map" UI has been removed — the card now shows
 * the two distances (to site, to office) directly.
 *
 * Dependencies needed (if not already installed):
 *   npm install react-native-fs react-native-share
 *   npx pod-install   (iOS)
 */

const initial = name => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

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

  // Mobile number entry
  mobileEntryWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 4,
  },
  mobileInputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA',
  },
  mobileInput: { flex: 1, fontSize: 14, color: '#1a1a1a', paddingVertical: 0 },
  mobileSetBtn: {
    backgroundColor: '#C8000A', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mobileSetBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Selected employee chip
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF3F3', marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#F0CECE',
  },
  selectedChipAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0CECE',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedChipAvatarText: { fontSize: 13, fontWeight: '700', color: '#A32D2D' },
  selectedChipName: { fontSize: 13.5, fontWeight: '700', color: '#A32D2D' },
  selectedChipText: { fontSize: 11.5, fontWeight: '600', color: '#C15656', marginTop: 1 },

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

  // Mode tabs (Location History / Deal Distance)
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#F0F0F0', borderRadius: 12, padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabBtnActive: { backgroundColor: '#fff' },
  tabBtnText: { fontSize: 12.5, fontWeight: '700', color: '#999' },
  tabBtnTextActive: { color: '#C8000A' },

  fetchBtn: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
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

  // Distance card
  distCard: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#F0F0F0', padding: 13,
  },
  distTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  distName: { fontSize: 13.5, fontWeight: '700', color: '#1a1a1a' },
  distSub: { fontSize: 11, color: '#999', marginTop: 2, fontWeight: '500' },
  distPillRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 10 },
  distPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FCEBEB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
  },
  distPillVal: { fontSize: 13, fontWeight: '800', color: '#A32D2D', lineHeight: 16 },
  distPillLbl: { fontSize: 9.5, fontWeight: '600', color: '#A32D2D', opacity: 0.75, marginTop: 1 },
  distFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  distFooterText: { fontSize: 10.5, color: '#999', fontWeight: '600' },

  exportBtn: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 16,
    backgroundColor: '#1a1a1a', borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13.5 },

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

const fmtRecordDate = val => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return val; }
};

// DB stores these as strings like "8878.2 km" — Number() chokes on the
// " km" suffix and returns NaN. Strip anything that isn't a digit/dot/minus
// before parsing.
const parseKm = raw => {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const normaliseDistance = (raw, idx) => ({
  id:         raw._id || String(idx),
  dealId:     raw.deal_id || '—',
  name:       raw.deal_name || '—',
  mobile:     raw.mobile || '—',
  surveyorName: raw.surveyor_name || '—',
  toSite:     parseKm(raw.to_site),
  toOffice:   parseKm(raw.to_office),
  rawDate:    raw.createdAt || null,
  date:       fmtRecordDate(raw.createdAt),
});

const EmployeeListScreen = ({ navigation, route }) => {
  const [mobileInputText, setMobileInputText] = useState('');
  const [selectedEmpName, setSelectedEmpName] = useState(null);
  const [selectedEmp, setSelectedEmp]      = useState(null);
  const [fromDate, setFromDate]            = useState('');
  const [toDate, setToDate]                = useState(todayStr());
  const [loading, setLoading]              = useState(false);
  const [mode, setMode]                    = useState('location'); // 'location' | 'distance'
  const [results, setResults]              = useState(null); // location: [{date, entries}]
  const [distResults, setDistResults]      = useState(null); // distance: [record,...]
  const [hasSearched, setHasSearched]      = useState(false);
  const [exporting, setExporting]          = useState(false);
  const [downloading, setDownloading]      = useState(false);

  const handleSetMobile = () => {
    const cleaned = mobileInputText.replace(/\D/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setSelectedEmp(cleaned.slice(-10));
    setSelectedEmpName(null);
    setResults(null);
    setDistResults(null);
    setHasSearched(false);
  };

  const handleClearMobile = () => {
    setSelectedEmp(null);
    setSelectedEmpName(null);
    setMobileInputText('');
    setResults(null);
    setDistResults(null);
    setHasSearched(false);
  };

  const canFetch = !!selectedEmp && fromDate.length === 10 && toDate.length === 10 && !loading;

  const openLocationOnMap = (lat, lng, label) => {
    const enc = encodeURIComponent(label || 'Location');
    const url = `https://www.google.com/maps?q=${lat},${lng}(${enc})`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open map.'));
  };


  // ── Location history fetch (unchanged behaviour) ──────────────────────────
  const fetchLocationHistory = async () => {
    const fromISO = ddmmyyyyToISO(fromDate);
    const toISO   = ddmmyyyyToISO(toDate);
    const fromD = isoToDateObj(fromISO);
    const toD   = isoToDateObj(toISO);

    const dates = [];
    let cur = new Date(fromD);
    while (cur <= toD) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push({ apiDate: `${y}${m}${d}`, isoDate: `${y}-${m}-${d}` });
      cur.setDate(cur.getDate() + 1);
      if (dates.length > 90) break;
    }

    const collected = [];
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
  };

  // ── Deal distance fetch (new) ──────────────────────────────────────────────
  const fetchDealDistance = async () => {
    const fromISO = ddmmyyyyToISO(fromDate);
    const toISO   = ddmmyyyyToISO(toDate);
    const fromD = isoToDateObj(fromISO);
    const toD   = isoToDateObj(toISO);
    const toEnd = new Date(toD); toEnd.setHours(23, 59, 59, 999);

    try {
      const res = await API.get('/admin/distance');
      const rawList = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const normalised = rawList.map(normaliseDistance);

      const cleanEmp = String(selectedEmp).replace(/\D/g, '').slice(-10);
      const filtered = normalised.filter(r => {
        const matchesEmp = String(r.mobile).replace(/\D/g, '').slice(-10) === cleanEmp;
        if (!matchesEmp) return false;
        if (!r.rawDate) return true;
        const d = new Date(r.rawDate);
        return d >= fromD && d <= toEnd;
      });

      setDistResults(filtered);
      if (filtered.length === 0) {
        Alert.alert('No data', 'No deal distance records found for this employee in the selected range.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not fetch deal distance: ' + (e?.message || 'Unknown error'));
      setDistResults([]);
    }
  };

  const handleFetch = async () => {
    const fromD = ddmmyyyyToISO(fromDate) && isoToDateObj(ddmmyyyyToISO(fromDate));
    const toD   = ddmmyyyyToISO(toDate) && isoToDateObj(ddmmyyyyToISO(toDate));
    if (!fromD || !toD) { Alert.alert('Invalid date', 'Please enter dates as DD/MM/YYYY.'); return; }
    if (fromD > toD) { Alert.alert('Invalid range', 'From date must be before To date.'); return; }

    setLoading(true);
    setHasSearched(true);
    try {
      if (mode === 'location') { setDistResults(null); await fetchLocationHistory(); }
      else { setResults(null); await fetchDealDistance(); }
    } catch (e) {
      Alert.alert('Error', 'Could not fetch data: ' + (e?.message || 'Unknown error'));
    }
    setLoading(false);
  };

  const escapeCsv = val => {
    const s = String(val ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const buildLocationCsv = () => {
    const headers = ['Date', 'Time', 'Latitude', 'Longitude'];
    const rows = [];
    (results || []).forEach(day => {
      day.entries.forEach(entry => {
        rows.push([day.date, entry.time || '', entry.latitude ?? '', entry.longitude ?? '']);
      });
    });
    return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
  };

  const handleDownloadLocationCsv = async () => {
    if (!results || !results.length) { Alert.alert('No data', 'Nothing to download.'); return; }
    setDownloading(true);
    try {
      const csv = buildLocationCsv();
      const fileName = `location-history-${selectedEmp}-${Date.now()}.csv`;

      if (Platform.OS === 'android') {
        const ok = await requestAndroidStoragePermission();
        if (!ok) { Alert.alert('Permission needed', 'Storage permission is required to save the file.'); setDownloading(false); return; }
        const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        await RNFS.writeFile(path, csv, 'utf8');
        Alert.alert('Downloaded', `Saved to Downloads:\n${fileName}`);
      } else {
        const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.writeFile(path, csv, 'utf8');
        await Share.open({
          title: 'Save Location History Report',
          url: path,
          type: 'text/csv',
          filename: fileName,
          saveToFiles: true,
          failOnCancel: false,
        });
      }
    } catch (e) {
      Alert.alert('Download failed', e?.message || 'Could not save CSV.');
    }
    setDownloading(false);
  };

  const handleExportLocationCsv = async () => {
    if (!results || !results.length) { Alert.alert('No data', 'Nothing to export.'); return; }
    setExporting(true);
    try {
      const csv = buildLocationCsv();
      const fileName = `location-history-${selectedEmp}-${Date.now()}.csv`;
      const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, csv, 'utf8');
      await Share.open({
        title: 'Location History Report',
        url: Platform.OS === 'android' ? `file://${path}` : path,
        type: 'text/csv',
        filename: fileName,
        failOnCancel: false,
      });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export failed', e?.message || 'Could not generate CSV.');
      }
    }
    setExporting(false);
  };

  const buildDistanceCsv = () => {
  const headers = ['Deal ID', 'Deal Name', 'Surveyor Name', 'Mobile', 'To Site (km)', 'To Office (km)', 'Date'];
  const rows = distResults.map(r => [
    r.dealId, r.name, r.surveyorName, r.mobile, r.toSite.toFixed(2), r.toOffice.toFixed(2), r.date,
  ]);
  return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
};

  const requestAndroidStoragePermission = async () => {
    if (Platform.OS !== 'android' || Platform.Version >= 29) return true; // scoped storage handles 29+
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        { title: 'Storage permission', message: 'Needed to save the CSV report to your Downloads folder.' }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) { return false; }
  };

  // Saves the file straight into the device's Downloads folder (Android)
  // or the app Documents folder + "Save to Files" prompt (iOS).
  const handleDownloadCsv = async () => {
    if (!distResults || !distResults.length) { Alert.alert('No data', 'Nothing to download.'); return; }
    setDownloading(true);
    try {
      const csv = buildDistanceCsv();
      const fileName = `deal-distance-${selectedEmp}-${Date.now()}.csv`;

      if (Platform.OS === 'android') {
        const ok = await requestAndroidStoragePermission();
        if (!ok) { Alert.alert('Permission needed', 'Storage permission is required to save the file.'); setDownloading(false); return; }
        const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        await RNFS.writeFile(path, csv, 'utf8');
        Alert.alert('Downloaded', `Saved to Downloads:\n${fileName}`);
      } else {
        const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.writeFile(path, csv, 'utf8');
        await Share.open({
          title: 'Save Deal Distance Report',
          url: path,
          type: 'text/csv',
          filename: fileName,
          saveToFiles: true,
          failOnCancel: false,
        });
      }
    } catch (e) {
      Alert.alert('Download failed', e?.message || 'Could not save CSV.');
    }
    setDownloading(false);
  };

  const handleExportDistanceCsv = async () => {
    if (!distResults || !distResults.length) { Alert.alert('No data', 'Nothing to export for the current filter.'); return; }
    setExporting(true);
    try {
      const csv = buildDistanceCsv();
      const fileName = `deal-distance-${selectedEmp}-${Date.now()}.csv`;
      const path = `${RNFS.CachesDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, csv, 'utf8');

      await Share.open({
        title: 'Deal Distance Report',
        url: Platform.OS === 'android' ? `file://${path}` : path,
        type: 'text/csv',
        filename: fileName,
        failOnCancel: false,
      });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export failed', e?.message || 'Could not generate CSV.');
      }
    }
    setExporting(false);
  };

  const totalEntries = (results || []).reduce((sum, d) => sum + d.entries.length, 0);
  const totalDays     = (results || []).length;
  const avgPerDay     = totalDays ? Math.round(totalEntries / totalDays) : 0;
  const busiestDay    = totalDays
    ? results.reduce((a, b) => (b.entries.length > a.entries.length ? b : a))
    : null;
  const firstDay = totalDays ? results[0] : null;
  const lastDay  = totalDays ? results[totalDays - 1] : null;

  const distTotalSite   = (distResults || []).reduce((s, r) => s + r.toSite, 0);
  const distTotalOffice = (distResults || []).reduce((s, r) => s + r.toOffice, 0);
  const distCount       = (distResults || []).length;
  const distAvgSite     = distCount ? distTotalSite / distCount : 0;
  const distTop         = distCount ? distResults.reduce((a, b) => (b.toSite > a.toSite ? b : a)) : null;

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

        {/* Employee entry — type mobile number directly */}
        <Text style={styles.sectionLabel}>1. Enter Employee Mobile Number</Text>

        {selectedEmp ? (
          <View style={styles.selectedChip}>
            <View style={styles.selectedChipAvatar}>
              <Text style={styles.selectedChipAvatarText}>{initial(selectedEmpName || selectedEmp)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedChipName} numberOfLines={1}>{selectedEmpName || 'Employee'}</Text>
              <Text style={styles.selectedChipText}>{selectedEmp}</Text>
            </View>
            <TouchableOpacity onPress={handleClearMobile}>
              <Ionicons name="close-circle" size={20} color="#A32D2D" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mobileEntryWrap}>
            <View style={styles.mobileInputBox}>
              <Ionicons name="call-outline" size={16} color="#aaa" />
              <TextInput
                style={styles.mobileInput}
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor="#ccc"
                value={mobileInputText}
                onChangeText={setMobileInputText}
                keyboardType="phone-pad"
                maxLength={10}
                onSubmitEditing={handleSetMobile}
              />
            </View>
            <TouchableOpacity style={styles.mobileSetBtn} onPress={handleSetMobile} activeOpacity={0.85}>
              <Text style={styles.mobileSetBtnText}>Set</Text>
            </TouchableOpacity>
          </View>
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

        {/* Mode tabs */}
        <Text style={styles.sectionLabel}>3. Choose Report Type</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'location' && styles.tabBtnActive]}
            onPress={() => { setMode('location'); setHasSearched(false); }}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={14} color={mode === 'location' ? '#C8000A' : '#999'} />
            <Text style={[styles.tabBtnText, mode === 'location' && styles.tabBtnTextActive]}>Location History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'distance' && styles.tabBtnActive]}
            onPress={() => { setMode('distance'); setHasSearched(false); }}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={14} color={mode === 'distance' ? '#C8000A' : '#999'} />
            <Text style={[styles.tabBtnText, mode === 'distance' && styles.tabBtnTextActive]}>Deal Distance</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.fetchBtn, !canFetch && styles.fetchBtnDisabled]}
          disabled={!canFetch}
          onPress={handleFetch}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={mode === 'location' ? 'navigate-outline' : 'map-outline'} size={16} color="#fff" />}
          <Text style={styles.fetchBtnText}>
            {loading ? 'Fetching…' : mode === 'location' ? 'View Location History' : 'View Deal Distance'}
          </Text>
        </TouchableOpacity>

        {/* ── LOCATION HISTORY RESULTS ── */}
        {hasSearched && !loading && mode === 'location' && (
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

                <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 4, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[styles.exportBtn, { flex: 1, backgroundColor: '#0E7C7B', marginHorizontal: 0 }, downloading && { opacity: 0.6 }]}
                    onPress={handleDownloadLocationCsv}
                    activeOpacity={0.85}
                    disabled={downloading}
                  >
                    {downloading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="save-outline" size={16} color="#fff" />}
                    <Text style={styles.exportBtnText}>{downloading ? 'Saving…' : 'Download CSV'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.exportBtn, { flex: 1, marginHorizontal: 0 }, exporting && { opacity: 0.6 }]}
                    onPress={handleExportLocationCsv}
                    activeOpacity={0.85}
                    disabled={exporting}
                  >
                    {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="share-social-outline" size={16} color="#fff" />}
                    <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share CSV'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}

        {/* ── DEAL DISTANCE RESULTS ── */}
        {hasSearched && !loading && mode === 'distance' && (
          <>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Deal Distance</Text>
              <Text style={styles.resultCount}>{distCount} deal{distCount !== 1 ? 's' : ''}</Text>
            </View>

            {(!distResults || distResults.length === 0) ? (
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={40} color="#ddd" />
                <Text style={styles.emptyText}>No deal distance data found for this range.</Text>
              </View>
            ) : (
              <>
                <View style={styles.dashboardWrap}>
                  <View style={[styles.statCard, styles.statCardAccent]}>
                    <View style={styles.statTopRow}>
                      <View style={[styles.statIconWrap, styles.statIconWrapAccent]}>
                        <Ionicons name="home" size={15} color="#fff" />
                      </View>
                    </View>
                    <Text style={[styles.statValue, styles.statValueAccent]}>{distTotalSite.toFixed(1)}</Text>
                    <Text style={[styles.statLabel, styles.statLabelAccent]}>Total to site (km)</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="business" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{distTotalOffice.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Total to office (km)</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="briefcase" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{distCount}</Text>
                    <Text style={styles.statLabel}>Deals Covered</Text>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statTopRow}>
                      <View style={styles.statIconWrap}>
                        <Ionicons name="pulse" size={15} color="#C8000A" />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{distAvgSite.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Avg to site (km)</Text>
                    {distTop && <Text style={styles.statSubtext} numberOfLines={1}>Longest: {distTop.name}</Text>}
                  </View>
                </View>

                {distResults.map(item => (
                  <View key={item.id} style={styles.distCard}>
                    <View style={styles.distTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.distName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.distSub} numberOfLines={1}>{item.dealId} · {item.date}</Text>
                      </View>
                    </View>

                    <View style={styles.distPillRow}>
                      <View style={styles.distPill}>
                        <Ionicons name="home-outline" size={13} color="#A32D2D" />
                        <View>
                          <Text style={styles.distPillVal}>{item.toSite.toFixed(2)} km</Text>
                          <Text style={styles.distPillLbl}>To site</Text>
                        </View>
                      </View>
                      <View style={styles.distPill}>
                        <Ionicons name="business-outline" size={13} color="#0C447C" />
                        <View>
                          <Text style={[styles.distPillVal, { color: '#0C447C' }]}>{item.toOffice.toFixed(2)} km</Text>
                          <Text style={styles.distPillLbl}>To office</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.distFooter}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <Ionicons name="person-outline" size={12} color="#999" />
    <Text style={styles.distFooterText}>{item.surveyorName}</Text>
  </View>
  <Text style={styles.distFooterText}>{item.mobile}</Text>
</View>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 4, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[styles.exportBtn, { flex: 1, backgroundColor: '#0E7C7B', marginHorizontal: 0 }, downloading && { opacity: 0.6 }]}
                    onPress={handleDownloadCsv}
                    activeOpacity={0.85}
                    disabled={downloading}
                  >
                    {downloading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="save-outline" size={16} color="#fff" />}
                    <Text style={styles.exportBtnText}>{downloading ? 'Saving…' : 'Download CSV'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.exportBtn, { flex: 1, marginHorizontal: 0 }, exporting && { opacity: 0.6 }]}
                    onPress={handleExportDistanceCsv}
                    activeOpacity={0.85}
                    disabled={exporting}
                  >
                    {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="share-social-outline" size={16} color="#fff" />}
                    <Text style={styles.exportBtnText}>{exporting ? 'Preparing…' : 'Share CSV'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default EmployeeListScreen;
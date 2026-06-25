import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// ─── Filter options ────────────────────────────────────────────────────────
const LEAD_FILTER_OPTIONS = [
  { key: 'all',        label: 'All Leads',   icon: 'list-outline',           dot: '#888',    bg: '#F3F3F3', activeBg: '#F3F3F3',  activeText: '#333' },
  { key: 'completed',  label: 'Completed',   icon: 'checkmark-circle-outline', dot: '#639922', bg: '#EAF3DE', activeBg: '#EAF3DE',  activeText: '#27500A' },
  { key: 'rejected',   label: 'Rejected',    icon: 'close-circle-outline',   dot: '#E24B4A', bg: '#FCEBEB', activeBg: '#FCEBEB',  activeText: '#791F1F' },
  { key: 'inprogress', label: 'In Progress', icon: 'time-outline',           dot: '#F59E0B', bg: '#FEF3C7', activeBg: '#FEF3C7',  activeText: '#92400E' },
  { key: 'other',      label: 'New / Unassigned', icon: 'radio-button-on-outline', dot: '#378ADD', bg: '#E6F1FB', activeBg: '#E6F1FB', activeText: '#0C447C' },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FB' },

  header: {
    backgroundColor: '#C8000A',
    paddingTop: 52,
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3, flex: 1 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
    backgroundColor: '#F5F5F7',
    borderWidth: 1, borderColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#C8000A',
    borderColor: '#A80008',
    elevation: 3, shadowColor: '#C8000A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#888' },
  tabBtnTextActive: { color: '#fff' },

  // ── Lead filter cards ─────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#aaa',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginHorizontal: 18, marginTop: 20, marginBottom: 10,
  },
  filterCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#F0F0F0',
    overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  filterCardInner: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14,
  },
  filterCardActive: {
    borderWidth: 1.5,
  },
  filterIconBox: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  filterCardTexts: { flex: 1 },
  filterCardLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  filterCardLabelActive: {},
  filterCardDesc: { fontSize: 11, color: '#aaa', fontWeight: '500' },
  filterCardDescActive: {},
  filterCardBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, alignItems: 'center',
  },
  filterCardBadgeText: { fontSize: 12, fontWeight: '700' },
  filterCardCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#C8000A', alignItems: 'center', justifyContent: 'center',
  },

  // ── Employee tab CTA ──────────────────────────────────────────────────────
  empCTA: {
    margin: 18,
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#E6F1FB',
    overflow: 'hidden',
    elevation: 3, shadowColor: '#378ADD', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  empCTAGradientBar: { height: 5, backgroundColor: '#378ADD' },
  empCTAInner: { padding: 20, alignItems: 'center', gap: 12 },
  empCTAIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center',
  },
  empCTATitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', letterSpacing: -0.3 },
  empCTADesc: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 19 },
  empCTABtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0C447C', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, marginTop: 4,
  },
  empCTABtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  empInfoRow: {
    flexDirection: 'row', gap: 10, marginHorizontal: 18, marginTop: 4,
  },
  empInfoBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#F0F0F0', alignItems: 'center', gap: 4,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3,
  },
  empInfoNum: { fontSize: 20, fontWeight: '700', color: '#0C447C' },
  empInfoLabel: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});

const LEAD_DESCRIPTIONS = {
  all:        'Show all leads regardless of status',
  completed:  'Site survey done successfully',
  rejected:   'Survey rejected by surveyor',
  inprogress: 'Survey currently underway',
  other:      'Newly created, awaiting assignment',
};

// ─────────────────────────────────────────────────────────────────────────────
const FilterScreen = ({ navigation, route }) => {
  // Receive counts and active filter from AdminScreen via route.params
  const {
    counts = {},
    activeFilter: initFilter = 'all',
    employeeList = [],
    employeeFilter: initEmpFilter = null,
  } = route.params || {};

  const [tab, setTab]               = useState(initEmpFilter ? 'employee' : 'lead');
  const [activeFilter, setActiveFilter] = useState(initFilter);

  const handleLeadFilterSelect = (key) => {
    setActiveFilter(key);
    // Navigate back with the chosen filter
    navigation.navigate('AdminDashboard', {
      selectedFilter: key,
      filterMode: 'lead',
      employeeFilter: null,
    });
  };

  const handleGoToEmployee = () => {
    navigation.navigate('EmployeeFilter', {
      employeeList,
      employeeFilter: initEmpFilter,
    });
  };

  const countFor = (key) => {
    if (key === 'all') return counts.all ?? 0;
    if (key === 'completed') return counts.completed ?? 0;
    if (key === 'rejected') return counts.rejected ?? 0;
    if (key === 'inprogress') return counts.inprogress ?? 0;
    return counts.other ?? 0;
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filter Leads</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'lead' && styles.tabBtnActive]}
          onPress={() => setTab('lead')}
          activeOpacity={0.8}
        >
          <Ionicons name="funnel-outline" size={15} color={tab === 'lead' ? '#fff' : '#888'} />
          <Text style={[styles.tabBtnText, tab === 'lead' && styles.tabBtnTextActive]}>Lead Status</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'employee' && styles.tabBtnActive]}
          onPress={() => { setTab('employee'); }}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={15} color={tab === 'employee' ? '#fff' : '#888'} />
          <Text style={[styles.tabBtnText, tab === 'employee' && styles.tabBtnTextActive]}>Employee</Text>
        </TouchableOpacity>
      </View>

      {tab === 'lead' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.sectionLabel}>Filter by status</Text>
          {LEAD_FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt.key;
            const count = countFor(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterCard,
                  isActive && { borderColor: opt.dot, ...styles.filterCardActive },
                ]}
                onPress={() => handleLeadFilterSelect(opt.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.filterCardInner, isActive && { backgroundColor: opt.activeBg }]}>
                  <View style={[styles.filterIconBox, { backgroundColor: isActive ? opt.dot + '22' : '#F5F5F7' }]}>
                    <Ionicons name={opt.icon} size={22} color={isActive ? opt.dot : '#bbb'} />
                  </View>
                  <View style={styles.filterCardTexts}>
                    <Text style={[styles.filterCardLabel, isActive && { color: opt.activeText }]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.filterCardDesc, isActive && { color: opt.dot }]}>
                      {LEAD_DESCRIPTIONS[opt.key]}
                    </Text>
                  </View>
                  {isActive ? (
                    <View style={styles.filterCardCheck}>
                      <Ionicons name="checkmark" size={13} color="#fff" />
                    </View>
                  ) : (
                    <View style={[styles.filterCardBadge, { backgroundColor: opt.bg }]}>
                      <Text style={[styles.filterCardBadgeText, { color: opt.activeText || '#888' }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Info boxes */}
          <View style={styles.empInfoRow}>
            <View style={styles.empInfoBox}>
              <Text style={styles.empInfoNum}>{employeeList.length}</Text>
              <Text style={styles.empInfoLabel}>Employees</Text>
            </View>
            <View style={styles.empInfoBox}>
              <Text style={styles.empInfoNum}>{counts.all ?? 0}</Text>
              <Text style={styles.empInfoLabel}>Total Leads</Text>
            </View>
            {initEmpFilter ? (
              <View style={[styles.empInfoBox, { borderColor: '#C8000A22' }]}>
                <Ionicons name="checkmark-circle" size={20} color="#C8000A" />
                <Text style={[styles.empInfoLabel, { color: '#C8000A' }]}>Active Filter</Text>
              </View>
            ) : null}
          </View>

          {/* CTA card */}
          <View style={styles.empCTA}>
            <View style={styles.empCTAGradientBar} />
            <View style={styles.empCTAInner}>
              <View style={styles.empCTAIcon}>
                <Ionicons name="people" size={30} color="#0C447C" />
              </View>
              <Text style={styles.empCTATitle}>Filter by Employee</Text>
              <Text style={styles.empCTADesc}>
                View leads assigned to a specific surveyor, logistic, or installer from your team.
              </Text>
              <TouchableOpacity style={styles.empCTABtn} onPress={handleGoToEmployee} activeOpacity={0.85}>
                <Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" />
                <Text style={styles.empCTABtnText}>Choose Employee</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default FilterScreen;
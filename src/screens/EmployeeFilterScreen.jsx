import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, TextInput, FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const initial = name =>
  name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?';

// Soft colors for avatars — cycling by index
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
  headerCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  headerCountText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F5F7', borderRadius: 12, borderWidth: 1,
    borderColor: '#EAEAEA', paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: '#333', paddingVertical: 0,
  },

  // ── Clear filter bar ──────────────────────────────────────────────────────
  activeBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FEF3F3',
    paddingHorizontal: 16, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#F0CECE',
  },
  activeBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeBarText: { fontSize: 12, color: '#A32D2D', fontWeight: '600' },
  clearBtn: { fontSize: 12, color: '#A32D2D', textDecorationLine: 'underline', fontWeight: '600' },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: { paddingVertical: 8, paddingBottom: 40 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#F5F5F5',
  },
  itemActive: { backgroundColor: '#FEF3F3' },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700' },
  itemTexts: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', letterSpacing: -0.2 },
  itemSub: { fontSize: 11, color: '#aaa', marginTop: 3, fontWeight: '500' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#C8000A', alignItems: 'center', justifyContent: 'center',
  },
  chevron: { opacity: 0.3 },

  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { opacity: 0.25, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#bbb', fontWeight: '500' },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#aaa',
    letterSpacing: 0.5, textTransform: 'uppercase',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6,
    backgroundColor: '#F9F9FB',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
const EmployeeFilterScreen = ({ navigation, route }) => {
  const {
    employeeList = [],
    employeeFilter: initFilter = null,
  } = route.params || {};

  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(initFilter);

  const filtered = useMemo(() => {
    if (!search.trim()) return employeeList;
    const q = search.toLowerCase();
    return employeeList.filter(e => e.toLowerCase().includes(q));
  }, [search, employeeList]);

  const handleSelect = (emp) => {
    const next = selected === emp ? null : emp;
    setSelected(next);
    // Navigate back to AdminDashboard with employee filter
    navigation.navigate('AdminDashboard', {
      selectedFilter: 'all',
      filterMode: 'employee',
      employeeFilter: next,
    });
  };

  const handleClear = () => {
    setSelected(null);
    navigation.navigate('AdminDashboard', {
      selectedFilter: 'all',
      filterMode: 'lead',
      employeeFilter: null,
    });
  };

  const renderItem = ({ item, index }) => {
    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const isActive = selected === item;
    return (
      <TouchableOpacity
        style={[styles.item, isActive && styles.itemActive]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: color.bg }]}>
          <Text style={[styles.avatarText, { color: color.text }]}>{initial(item)}</Text>
        </View>
        <View style={styles.itemTexts}>
          <Text style={styles.itemName}>{item}</Text>
          <Text style={styles.itemSub}>Tap to view assigned leads</Text>
        </View>
        {isActive ? (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color="#ccc" style={styles.chevron} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filter by Employee</Text>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>{employeeList.length} employees</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color="#aaa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee name or number..."
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
      </View>

      {/* Active filter banner */}
      {selected && (
        <View style={styles.activeBar}>
          <View style={styles.activeBarLeft}>
            <Ionicons name="person-circle-outline" size={16} color="#A32D2D" />
            <Text style={styles.activeBarText}>Filtering by: {selected}</Text>
          </View>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearBtn}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={50} color="#ccc" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>
            {search.trim() ? 'No employee found.' : 'No employees assigned yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => item + idx}
          renderItem={renderItem}
          ListHeaderComponent={
            <Text style={styles.sectionHeader}>Select an employee to filter</Text>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

export default EmployeeFilterScreen;
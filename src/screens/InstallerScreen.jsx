import React, { useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Switch,
  TouchableOpacity, ScrollView, Image, Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DUMMY_INSTALLER = {
  name: 'Rajan',
  phone: '+91 879865788',
  location: 'Madurai',
  assignedTo: 'Abraham',
};

const InstallerScreen = ({ navigation }) => {
  const [isAvailable, setIsAvailable] = useState(false);

  // ── OFF STATE ──────────────────────────────────────────────────────────────
  if (!isAvailable) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>

          <Text style={styles.pageTitle}>Logistic Dashboard</Text>

          <View style={styles.profileRow}>
            <View style={styles.profileLeft}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={28} color="#888" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.profileName}>Pradeep</Text>
                <Text style={styles.profileRole}>Installer</Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={(val) => setIsAvailable(val)}
              trackColor={{ false: '#ccc', true: '#F00001' }}
              thumbColor="#fff"
            />
          </View>

          <LinearGradient colors={['#F00001', '#B00100']} style={styles.logoBanner}>
            <Image
              source={require('../../assets/images/kondass.png')}
              style={{ width: 160, height: 70 }}
              resizeMode="contain"
            />
          </LinearGradient>

          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome!</Text>
            <Text style={styles.welcomeSub}>Let's get started! Turn on availability!</Text>
          </View>

        </SafeAreaView>
      </View>
    );
  }

  // ── ON STATE ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Logistic Dashboard</Text>
          <View style={styles.profileRowSmall}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={20} color="#888" />
            </View>
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.profileNameSmall}>Pradeep</Text>
              <Text style={styles.profileRoleSmall}>Installer</Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={(val) => setIsAvailable(val)}
              trackColor={{ false: '#ccc', true: '#F00001' }}
              thumbColor="#fff"
              style={{ marginLeft: 12 }}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

          {/* Installer Card */}
          <View style={styles.card}>

            {/* Menu Icon */}
            <View style={[styles.rowBetween, { marginBottom: 16 }]}>
              <View />
              <Ionicons name="menu-outline" size={24} color="#555" />
            </View>

            <View style={styles.installerRow}>

              {/* Avatar */}
              <View style={styles.installerAvatar}>
                <Ionicons name="person-outline" size={28} color="#888" />
              </View>

              {/* Details */}
              <View style={{ flex: 1, marginLeft: 12 }}>

                <Text style={styles.installerName}>{DUMMY_INSTALLER.name}</Text>

                {/* Phone */}
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={14} color="#555" />
                  <Text style={styles.detailText}>{DUMMY_INSTALLER.phone}</Text>
                </View>

                {/* Location */}
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color="#555" />
                  <Text style={styles.detailText}>{DUMMY_INSTALLER.location}</Text>
                </View>

                {/* Icon Actions */}
                <View style={styles.iconRow}>
                  <TouchableOpacity>
                    <Ionicons name="notifications-outline" size={20} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Ionicons name="chatbubble-outline" size={20} color="#555" />
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Ionicons name="mail-outline" size={20} color="#555" />
                  </TouchableOpacity>
                </View>

                {/* Assigned To */}
                <Text style={styles.assignedText}>
                  Assigned to{' '}
                  <Text style={{ fontWeight: '700', color: '#1a1a1a' }}>
                    {DUMMY_INSTALLER.assignedTo}
                  </Text>
                </Text>

                {/* View Product Location */}
                <TouchableOpacity
                  style={styles.locationLink}
                  onPress={() => Linking.openURL('https://maps.google.com')}
                >
                  <Ionicons name="navigate-circle" size={16} color="#F00001" />
                  <Text style={styles.locationLinkText}>
                    Click to view product location details
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#555" />
                </TouchableOpacity>

              </View>

              {/* Call Button */}
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${DUMMY_INSTALLER.phone}`)}
              >
                <Ionicons name="call-outline" size={20} color="#F00001" />
              </TouchableOpacity>

            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default InstallerScreen;

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 14, color: '#888', paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 6, fontWeight: '500',
  },

  // OFF state
  profileRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e8e8e8',
  },
  profileLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd',
  },
  profileName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  profileRole: { fontSize: 13, color: '#888', marginTop: 2 },
  logoBanner: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center' },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  welcomeText: { fontSize: 22, color: '#555', fontWeight: '400', marginBottom: 10 },
  welcomeSub: { fontSize: 14, color: '#F00001', textAlign: 'center', fontWeight: '500' },

  // ON state top bar
  topBar: {
    backgroundColor: '#fff', paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderColor: '#e8e8e8',
  },
  profileRowSmall: { flexDirection: 'row', alignItems: 'center' },
  avatarSmall: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center',
  },
  profileNameSmall: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  profileRoleSmall: { fontSize: 11, color: '#888' },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 14, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Installer
  installerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  installerAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  installerName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 13, color: '#374151' },
  iconRow: { flexDirection: 'row', gap: 14, marginVertical: 8 },
  assignedText: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  locationLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff5f5', padding: 8, borderRadius: 8,
  },
  locationLinkText: { flex: 1, fontSize: 11, color: '#374151' },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff5f5', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#fecaca', marginLeft: 8,
  },
});
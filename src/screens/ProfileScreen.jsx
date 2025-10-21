import React, { useState } from "react";

import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";

const ProfileScreen = ({ navigation }) => {
     const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  // 🔹 Handle logout action
  const handleLogout = () => {
    setShowLogoutPopup(false);
    navigation.replace("Login"); // Redirect to Login screen after logout
  };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#fff" barStyle="dark-content" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back-outline" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                </View>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View>
                        <Text style={styles.userName}>Ram Kumar</Text>
                        <Text style={styles.memberSince}>Member since Aug 2023</Text>
                        <View style={styles.contactRow}>
                            <Ionicons name="call-outline" size={16} color="#555" />
                            <Text style={styles.contactText}> +91 9514583588</Text>
                        </View>
                        <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={16} color="#555" />
                            <Text style={styles.contactText}> john@gmail.com</Text>
                        </View>
                    </View>
                    <MaterialIcons name="verified-user" size={26} color="#f15b5d" />
                </View>

                {/* Solar Anniversary */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🌞 Solar Anniversary with Kondaas</Text>
                    <Text style={styles.labelText}>Your solar journey started on</Text>
                    <Text style={styles.highlightText}>August 15, 2023</Text>
                    <View style={styles.anniversaryRow}>
                        <View style={styles.anniversaryBox}>
                            <Text style={styles.valueText}>2</Text>
                            <Text style={styles.subText}>Years of Clean Energy</Text>
                        </View>
                        <View style={styles.anniversaryBox}>
                            <Text style={styles.valueText}>339</Text>
                            <Text style={styles.subText}>Days to Anniversary</Text>
                        </View>
                    </View>
                </View>

                {/* System Details */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>⚙️ System Details</Text>
                    <View style={styles.systemGrid}>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>⚡ Capacity</Text>
                            <Text style={styles.systemValue}>5.5 kW</Text>
                        </View>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>🔆 Panels</Text>
                            <Text style={styles.systemValue}>20 Units</Text>
                        </View>
                    </View>
                    <View style={styles.systemGrid}>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>🟢 Type</Text>
                            <Text style={styles.systemValue}>On-Grid</Text>
                        </View>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>🕒 Warranty</Text>
                            <Text style={styles.systemValue}>25 Years</Text>
                        </View>
                    </View>
                    <Text style={styles.installationText}>
                        Installation Date: <Text style={styles.boldText}>Aug 15, 2023</Text>
                    </Text>
                    <Text style={styles.installationText}>
                        Installer: <Text style={styles.boldText}>Kondaas Solar Solutions</Text>
                    </Text>
                    <Text style={styles.installationText}>
                        System ID: <Text style={styles.boldText}>KDS-JR-2023-8975</Text>
                    </Text>
                </View>

                {/* Environmental Impact */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🌿 Environmental Impact</Text>
                    <View style={styles.envBox}>
                        <Text style={styles.envValue}>127</Text>
                        <Text style={styles.envLabel}>Trees Equivalent Planted</Text>
                        <Text style={styles.envSubText}>Based on CO₂ reduction of 2.38 Tonne</Text>
                    </View>
                    <View style={styles.envStats}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>12,400</Text>
                            <Text style={styles.statLabel}>kWh Generated</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>2,380 kg</Text>
                            <Text style={styles.statLabel}>CO₂ Saved</Text>
                        </View>
                    </View>
                </View>

                {/* Achievements */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🏅 Achievements</Text>
                    <View style={styles.achievementsRow}>
                        <View style={[styles.achievementBox, { backgroundColor: "#f9f6ff" }]}>
                            <Text style={styles.achievementText}>Solar Champion</Text>
                        </View>
                        <View style={[styles.achievementBox, { backgroundColor: "#eafff2" }]}>
                            <Text style={styles.achievementText}>Eco Warrior</Text>
                        </View>
                    </View>
                    <View style={styles.achievementsRow}>
                        <View style={[styles.achievementBox, { backgroundColor: "#fff9e6" }]}>
                            <Text style={styles.achievementText}>First Bill Paid</Text>
                        </View>
                        <View style={[styles.achievementBox, { backgroundColor: "#f1f1f1" }]}>
                            <Text style={styles.achievementText}>Locked</Text>
                        </View>
                    </View>
                </View>

                {/* Logout Button */}
               <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setShowLogoutPopup(true)}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

            </ScrollView>
             <Modal
        transparent
        visible={showLogoutPopup}
        animationType="fade"
        onRequestClose={() => setShowLogoutPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Ionicons name="log-out-outline" size={45} color="#f15b5d" />
            <Text style={styles.popupText}>Are you sure want to logout?</Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity style={styles.yesButton} onPress={handleLogout}>
                <Text style={styles.yesText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noButton}
                onPress={() => setShowLogoutPopup(false)}
              >
                <Text style={styles.noText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        </SafeAreaView>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: "#eee",
    },
    backButton: { marginRight: 10 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: "#000" },

    profileCard: {
        backgroundColor: "#fff",
        margin: 15,
        padding: 15,
        borderRadius: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 2,
    },
    userName: { fontSize: 18, fontWeight: "700", color: "#000" },
    memberSince: { color: "#777", marginBottom: 8 },
    contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
    contactText: { fontSize: 14, color: "#555" },

    card: {
        backgroundColor: "#fff",
        marginHorizontal: 15,
        marginVertical: 8,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 8 },
    labelText: { fontSize: 13, color: "#666" },
    highlightText: { color: "#f15b5d", fontWeight: "700", marginBottom: 10 },
    anniversaryRow: { flexDirection: "row", justifyContent: "space-between" },
    anniversaryBox: { alignItems: "center", flex: 1 },
    valueText: { fontSize: 20, fontWeight: "700", color: "#333" },
    subText: { fontSize: 12, color: "#888" },

    systemGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 6,
    },
    systemBox: {
        flex: 1,
        backgroundColor: "#f9f9f9",
        margin: 4,
        padding: 10,
        borderRadius: 8,
    },
    systemLabel: { fontSize: 13, color: "#777" },
    systemValue: { fontSize: 15, fontWeight: "700", color: "#000" },
    installationText: { fontSize: 13, color: "#555", marginTop: 4 },
    boldText: { fontWeight: "700", color: "#000" },

    envBox: {
        backgroundColor: "#eafff2",
        padding: 12,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 10,
    },
    envValue: { fontSize: 22, fontWeight: "700", color: "#0a8f4a" },
    envLabel: { fontSize: 14, color: "#333", marginVertical: 4 },
    envSubText: { fontSize: 12, color: "#666" },
    envStats: { flexDirection: "row", justifyContent: "space-between" },
    statBox: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 16, fontWeight: "700", color: "#000" },
    statLabel: { fontSize: 12, color: "#777" },

    achievementsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 6,
    },
    achievementBox: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 4,
        alignItems: "center",
    },
    achievementText: { fontWeight: "600", color: "#333" },

    logoutButton: {
        backgroundColor: "#f15b5d",
        margin: 15,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
    },
    logoutText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    // 🔹 Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: "center",
    elevation: 10,
  },
  popupText: {
    fontSize: 16,
    color: "#333",
    marginVertical: 15,
    textAlign: "center",
  },
  popupButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  yesButton: {
    backgroundColor: "#f15b5d",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  noButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  yesText: { color: "#fff", fontWeight: "700" },
  noText: { color: "#fff", fontWeight: "700" },
});

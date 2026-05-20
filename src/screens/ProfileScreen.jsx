import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import CryptoJS from "crypto-js"; // ← FIX: password hash-க்கு
import Loader from "../components/Loader";
import { getStorageData, storeData, USER_DATA } from "../service/localStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LinearGradient from "react-native-linear-gradient";
import { saveUser, fetchStationList } from "../api/api1"; // ← FIX: saveUser import (fetch + headers already fixed in api1.js)

const ProfileScreen = ({ route, navigation }) => {
  const { stationId } = route.params || {};

  const [showLogoutPopup, setShowLogoutPopup]       = useState(false);
  const [loading, setLoading]                       = useState(true);
  const [userData, setUserData]                     = useState(null);
  const [stationData, setStationData]               = useState(null);
  const [showCredentialPopup, setShowCredentialPopup] = useState(false);
  const [email, setEmail]                           = useState("");
  const [password, setPassword]                     = useState("");
  const [showPassword, setShowPassword]             = useState(false);

  // ─────────────────────────────────────────────────────────────
  // HANDLE UPDATE CREDENTIALS
  // FIX 1: நேரடி fetch → api1.js-ல் உள்ள saveUser() use பண்றோம்
  //         (x-auth-token + x-device-id header auto போகுது)
  // FIX 2: password plain text → CryptoJS SHA256 hash
  // FIX 3: AsyncStorage-லயும் hashed password save பண்றோம்
  // ─────────────────────────────────────────────────────────────
  const handleUpdateCredentials = async () => {
    try {
      if (!email.trim() || !password) {
        Alert.alert("Error", "Please enter both email and password.");
        return;
      }

      const stored = await getStorageData(USER_DATA);
      const parsed = stored ? JSON.parse(stored) : null;
      const phoneNo = parsed?.UserInfo?.phoneNo;

      if (!phoneNo) {
        Alert.alert("Error", "User session expired. Please login again.");
        return;
      }

      // FIX: SHA256 hash — saveMailCredentials-உடன் consistent
      const hashedPassword = CryptoJS.SHA256(password).toString();

      const updatedPayload = {
        ...parsed,
        UserInfo: {
          ...parsed.UserInfo,
          email:    email.trim(),
          password: hashedPassword, // ← FIX: plain text இல்லை
        },
      };

      // FIX: api1.js saveUser → x-auth-token + x-device-id auto header
      const result = await saveUser(updatedPayload);

      if (result?.success) {
        // AsyncStorage-லயும் hashed password save
        await storeData(USER_DATA, JSON.stringify(updatedPayload));
        setUserData(updatedPayload);

        Alert.alert("Success", "Credentials updated successfully!");
        setShowCredentialPopup(false);
        setEmail("");
        setPassword("");
      } else {
        Alert.alert("Error", result?.data?.error || "Update failed. Try again.");
      }
    } catch (e) {
      console.log("❌ Update credentials error:", e.message);
      Alert.alert("Error", "Something went wrong");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LOAD USER DATA
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (data) {
          const parsedData = JSON.parse(data);
          setUserData(parsedData);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    loadUserData();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // LOAD STATIONS
  // மாற்றம் இல்லை — fetchStationList() api1.js-ல் already fixed
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    try {
      setLoading(true);

      // Cache இருந்தா உடனே show
      const stored = await getStorageData(USER_DATA);
      const parsedUser = stored ? JSON.parse(stored) : null;
      const phoneNo = parsedUser?.UserInfo?.phoneNo;
      const STATIONS_KEY = `stations_data_${phoneNo}`;

      const cached = await getStorageData(STATIONS_KEY);
      if (cached) {
        const stationArray = JSON.parse(cached);
        const selected = stationArray.find((st) => st.id === stationId);
        if (selected) setStationData(selected);
      }

      // Offline-ல return
      const net = await NetInfo.fetch();
      if (!net.isConnected) { setLoading(false); return; }

      const response = await fetchStationList();
      const stationArray = Array.isArray(response)
        ? response
        : (response?.stationList || response?.stations || []);
      const selected = stationArray.find((st) => st.id === stationId);
      if (selected) setStationData(selected);

    } catch (error) {
      console.log("❌ Error fetching stations:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // HANDLE LOGOUT
  // மாற்றம் இல்லை
  // ─────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    const data = await getStorageData(USER_DATA);
    const parsed = data ? JSON.parse(data) : null;
    const phoneNo = parsed?.UserInfo?.phoneNo;
    const devicelist = parsed?.devicelist || [];

    await AsyncStorage.removeItem(USER_DATA);

    if (phoneNo) {
      await AsyncStorage.removeItem(`savings_data_${phoneNo}`);
      await AsyncStorage.removeItem(`stations_data_${phoneNo}`);
    }

    for (const device of devicelist) {
      const id = device?.id;
      if (id) {
        await AsyncStorage.removeItem(`today_gen_${id}`);
        await AsyncStorage.removeItem(`lifetime_${id}`);
      }
    }

    setShowLogoutPopup(false);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  // ─────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View>
            <Text style={styles.userName}>
              {userData?.UserInfo?.name || "Guest User"}
            </Text>
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={16} color="#555" />
              <Text style={styles.contactText}>
                {userData?.UserInfo?.phoneNo
                  ? `+91 ${userData.UserInfo.phoneNo}`
                  : "Not available"}
              </Text>
            </View>
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={16} color="#555" />
              <Text style={styles.contactText}>
                {userData?.UserInfo?.email || userData?.email || "Not available"}
              </Text>
            </View>
          </View>
          <MaterialIcons name="verified-user" size={26} color="#ED1C25" />
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
              <Text style={styles.systemValue}>
                {stationData?.installedCapacity
                  ? `${stationData.installedCapacity} kW`
                  : "Not available"}
              </Text>
            </View>
            <View style={styles.systemBox}>
              <Text style={styles.systemLabel}>🟢 Type</Text>
              <Text style={styles.systemValue}>
                {stationData?.type || "Not available"}
              </Text>
            </View>
          </View>
          <Text style={styles.installationText}>
            Installation Date:{" "}
            <Text style={styles.boldText}>
              {stationData?.startOperatingTime
                ? new Date(stationData.startOperatingTime * 1000).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })
                : "Not available"}
            </Text>
          </Text>
          <Text style={styles.installationText}>
            Station ID: <Text style={styles.boldText}>{stationData?.id || "Not available"}</Text>
          </Text>
          <Text style={styles.installationText}>
            Address:{" "}
            <Text style={styles.boldText}>
              {stationData?.locationAddress || "Not available"}
            </Text>
          </Text>
        </View>

        {/* Modify Credentials Button */}
        <TouchableOpacity
          style={styles.modifyButton}
          onPress={() => setShowCredentialPopup(true)}
        >
          <Text style={styles.modifyText}>Modify Credentials</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity onPress={() => setShowLogoutPopup(true)}>
          <LinearGradient
            colors={["#F00001", "#d42f2f"]}
            start={{ x: 0.5, y: 2 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      {/* Logout Modal */}
      <Modal
        transparent
        visible={showLogoutPopup}
        animationType="fade"
        onRequestClose={() => setShowLogoutPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Ionicons name="log-out-outline" size={45} color="#ED1C25" />
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

      {/* Modify Credentials Modal */}
      <Modal
        transparent
        visible={showCredentialPopup}
        animationType="fade"
        onRequestClose={() => setShowCredentialPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Ionicons name="mail-outline" size={40} color="#4A90E2" />
            <Text style={styles.popupTitle}>Modify Credentials</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={18} color="#999" />
              <TextInput
                placeholder="Enter email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={18} color="#999" />
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.popupButtons}>
              <TouchableOpacity
                style={styles.noButton}
                onPress={() => {
                  setShowCredentialPopup(false);
                  setEmail("");
                  setPassword("");
                }}
              >
                <Text style={styles.noText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.yesButton}
                onPress={handleUpdateCredentials}
              >
                <Text style={styles.yesText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && <Loader />}
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#fff" },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  backButton:       { marginRight: 10 },
  headerTitle:      { fontSize: 18, fontWeight: "700", color: "#000" },
  profileCard:      { backgroundColor: "#fff", margin: 15, padding: 15, borderRadius: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 2 },
  userName:         { fontSize: 18, fontWeight: "700", color: "#000" },
  contactRow:       { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  contactText:      { fontSize: 14, color: "#555", marginLeft: 6 },
  card:             { backgroundColor: "#fff", marginHorizontal: 15, marginVertical: 8, padding: 15, borderRadius: 10, elevation: 2 },
  sectionTitle:     { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 8 },
  labelText:        { fontSize: 13, color: "#666" },
  highlightText:    { color: "#ED1C25", fontWeight: "700", marginBottom: 10 },
  anniversaryRow:   { flexDirection: "row", justifyContent: "space-between" },
  anniversaryBox:   { alignItems: "center", flex: 1 },
  valueText:        { fontSize: 20, fontWeight: "700", color: "#333" },
  subText:          { fontSize: 12, color: "#888" },
  systemGrid:       { flexDirection: "row", justifyContent: "space-between", marginVertical: 6 },
  systemBox:        { flex: 1, backgroundColor: "#f9f9f9", margin: 4, padding: 10, borderRadius: 8 },
  systemLabel:      { fontSize: 13, color: "#777" },
  systemValue:      { fontSize: 15, fontWeight: "700", color: "#000" },
  installationText: { fontSize: 13, color: "#555", marginTop: 4 },
  boldText:         { fontWeight: "700", color: "#000" },
  modifyButton:     { marginHorizontal: 15, marginTop: 10, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: "#ED1C25", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  modifyText:       { color: "#ED1C25", fontWeight: "600", fontSize: 16 },
  logoutButton:     { margin: 15, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  logoutText:       { color: "#fff", fontWeight: "700", fontSize: 16, lineHeight: 20 },
  modalOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  popupBox:         { width: "80%", backgroundColor: "#fff", borderRadius: 12, paddingVertical: 25, paddingHorizontal: 20, alignItems: "center", elevation: 10 },
  popupText:        { fontSize: 16, color: "#333", marginVertical: 15, textAlign: "center" },
  popupTitle:       { fontSize: 18, fontWeight: "700", color: "#000", marginVertical: 10 },
  inputContainer:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 10, marginTop: 10, width: "100%", height: 45 },
  input:            { flex: 1, marginLeft: 8, fontSize: 14, color: "#000" },
  popupButtons:     { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 20 },
  yesButton:        { flex: 1, backgroundColor: "#ED1C25", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 5 },
  noButton:         { flex: 1, backgroundColor: "#666", paddingVertical: 12, borderRadius: 8, alignItems: "center", marginHorizontal: 5 },
  yesText:          { color: "#fff", fontWeight: "700", fontSize: 15 },
  noText:           { color: "#fff", fontWeight: "700", fontSize: 15 },
});
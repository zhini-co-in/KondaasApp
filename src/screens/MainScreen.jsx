// src/screens/MainScreen.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, Image, StyleSheet, ImageBackground,
  TouchableOpacity, Modal, ScrollView, Animated,
  PermissionsAndroid, Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "react-native-vector-icons/Ionicons";
import LightBg from "../../assets/images/Lightmode.png";
import DarkBg from "../../assets/images/Darkmode.png";
import ProfileImg from "../../assets/images/Round.png";
import Loader from "../components/Loader";
import NetInfo from "@react-native-community/netinfo";
import { getStorageData, storeData, USER_DATA, getSavingsKey, getStationsKey, getTodayGenKey, getLifetimeKey } from "../service/localStorage";
import { saveStations, getInstallationAmount, fetchHistoricalData, fetchRealTimeData, fetchStationList } from "../api/api1";
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import FontStyles from "../constants/fonts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREEN_NAMES } from "../constants/screenNames";
import { useFocusEffect } from "@react-navigation/native";

function isDaytime() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18;
}

const MainScreen = ({ navigation }) => {
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [isDay, setIsDay] = useState(isDaytime());
  const [visible, setVisible] = useState(false);
  const [stations, setStations] = useState([]);
  const [totalCost, setTotalCost] = useState("₹ Loading...");
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState(0);
  const [todayGeneration, setTodayGeneration] = useState(0);
  const [lifeTimeGeneration, setLifetimeGeneration] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  const [updatedTime, setUpdatedTime] = useState("");
  const [installationAmount, setInstallationAmount] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressColor, setProgressColor] = useState("#f39c12");
  const progressAnim = useRef(new Animated.Value(0)).current;

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  // ─── Progress bar animation ───────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);

// ✅ Merge into one
useEffect(() => {
  if (!selectedStationId) return;
  loadTodayGeneration(selectedStationId);
  getRealTimeGeneration(selectedStationId);
  (async () => {
    const amt = await getInstallationAmount(selectedStationId);
    setInstallationAmount(amt);
  })();
  if (userInfo?.UserInfo?.phoneNo) {
    fetchTotalSavings(userInfo.UserInfo.phoneNo, selectedStationId);
  }
}, [selectedStationId]);

  // ─── Load user on focus ───────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        const data = await getStorageData(USER_DATA);
        if (data) {
          const parsed = JSON.parse(data);
          setUserInfo(parsed);
          console.log("👤 UserInfo phoneNo:", parsed?.UserInfo?.phoneNo);
        }
      };
      loadUser();
    }, [])
  );

  // ─── Notification permission ──────────────────────────────────────────────
  async function requestPermission() {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        return enabled;
      } else {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  useEffect(() => { requestPermission(); }, []);

  // ─── Updated time ─────────────────────────────────────────────────────────
  useEffect(() => {
    const now = new Date();
    const formatted =
      now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " +
      now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    setUpdatedTime(formatted);
  }, []);

  // ─── Notifee channel ──────────────────────────────────────────────────────
  useEffect(() => {
    notifee.createChannel({ id: 'default', name: 'Default Notifications' });
  }, []);

  // ─── Load stations when userInfo ready ───────────────────────────────────
  useEffect(() => {
    if (userInfo?.UserInfo?.phoneNo) {
      loadStations();
      (async () => {
        const stationsList = await fetchStationList();
        await saveStations(stationsList);
      })();
    }
  }, [userInfo?.UserInfo?.phoneNo]);

  useEffect(() => {
    if (userInfo) {
      console.log("📦 devicelist:", JSON.stringify(userInfo?.devicelist));
    }
  }, [userInfo]);

  // ─── Clock update ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setIsDay(isDaytime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const convertUnits = (value) => {
    if (!value) return "0 Units";
    if (value >= 1000) return value.toFixed(0) + " Units";
    return value.toFixed(2) + " Units";
  };

  function calculateCommittedUnits(item) {
    const capacity = item.installedCapacity > 100
      ? item.installedCapacity / 1000
      : item.installedCapacity;
    const startTime = item.startOperatingTime || item.createdDate;
    const startDate = new Date(startTime * 1000);
    const today = new Date();
    const noOfDays = Math.max(1, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)));
    return capacity * 4 * noOfDays;
  }

  function processStations(data) {
    if (!Array.isArray(data) || data.length === 0) return [];
    const withUnits = data.map(item => ({ ...item, committedUnits: calculateCommittedUnits(item) }));
    const maxValue = Math.max(...withUnits.map(x => x.committedUnits || 0));
    return withUnits.map(item => ({
      ...item,
      progressPercent: maxValue ? (item.committedUnits / maxValue) * 100 : 0,
      progressColor: item.committedUnits === maxValue ? "green" : "orange",
    }));
  }

const loadStations = async () => {
  try {
    setLoading(true);
    const phoneNo = userInfo?.UserInfo?.phoneNo;
    const STATIONS_KEY = getStationsKey(phoneNo);

    const cached = await getStorageData(STATIONS_KEY);
    if (cached) {
      const processed = JSON.parse(cached);
      setStations(processed);
      if (processed.length > 0) {
        const first = processed[0];
        setSelectedStation(0);
        setSelectedStationId(first.id);
        setProgressPercent(first.progressPercent || 0);
        setProgressColor(first.progressColor === "green" ? "#2ecc71" : "#f39c12");

        // ✅ Cache-லயே data load பண்ணு
        loadTodayGeneration(first.id);
        getRealTimeGeneration(first.id);
        if (phoneNo) fetchTotalSavings(phoneNo, first.id);
      }
    }

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    const response = await fetchStationList();
    let stationArray = Array.isArray(response) ? response : (response?.stationList || []);
    const processed = processStations(stationArray);
    setStations(processed);

    if (processed.length > 0) {
      const first = processed[0];
      setSelectedStation(0);
      setSelectedStationId(first.id);
      setProgressPercent(first.progressPercent || 0);
      setProgressColor(first.progressColor === "green" ? "#2ecc71" : "#f39c12");

      // ✅ Fresh data load பண்ணு
      loadTodayGeneration(first.id);
      getRealTimeGeneration(first.id);
      if (phoneNo) fetchTotalSavings(phoneNo, first.id);
    }

    await storeData(STATIONS_KEY, JSON.stringify(processed));

  } catch (error) {
    console.log("Error fetching stations:", error);
  } finally {
    setLoading(false);
  }
};

  const loadTodayGeneration = async (stationId) => {
    try {
      const TODAY_KEY = getTodayGenKey(stationId);

      const cached = await getStorageData(TODAY_KEY);
      if (cached) setTodayGeneration(JSON.parse(cached));

      const net = await NetInfo.fetch();
      if (!net.isConnected) return;

      const today = new Date();
      const dateString = today.toISOString().split("T")[0];
      const response = await fetchHistoricalData({
        stationId, timeType: 2,
        startTime: dateString, endTime: dateString,
      });

      if (response?.stationDataItems?.length > 0) {
        console.log("📊 stationDataItem:", JSON.stringify(response.stationDataItems[0]));
        const val = response.stationDataItems[0].generationValue?.toFixed(1) || 0;
        setTodayGeneration(val);
        await storeData(TODAY_KEY, JSON.stringify(val));
      } else {
        setTodayGeneration(0);
      }
    } catch (error) {
      console.error("Error fetching today's generation:", error);
    }
  };

  const getRealTimeGeneration = async (stationId) => {
    try {
      const LIFETIME_KEY = getLifetimeKey(stationId);

      const cached = await getStorageData(LIFETIME_KEY);
      if (cached) setLifetimeGeneration(JSON.parse(cached));

      const net = await NetInfo.fetch();
      if (!net.isConnected) return;

      const response = await fetchRealTimeData({ stationId });
      if (response?.generationTotal !== undefined) {
        setLifetimeGeneration(response.generationTotal);
        await storeData(LIFETIME_KEY, JSON.stringify(response.generationTotal));
      }
    } catch (error) {
      console.error("Error fetching real-time data:", error);
    }
  };

  // ✅ stationId parameter accept பண்றது — stale closure fix
const fetchTotalSavings = async (phoneNo, stationId = selectedStationId) => {
  try {
    const SAVINGS_KEY = getSavingsKey(phoneNo) + `_${stationId}`;

    const userData = await getStorageData(USER_DATA);
    const parsed = JSON.parse(userData);
    const authToken = parsed?.authToken || parsed?.UserInfo?.authToken;
    const deviceId = parsed?.deviceId; // ✅ deviceId எடு

    const cached = await getStorageData(SAVINGS_KEY);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      setTotalCost(`₹ ${parsedCache.totalCost}`);
    }

    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    const res = await fetch("https://board.trisentrix.com/savings/calculate-savings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-token": authToken,
      },
      body: JSON.stringify({ phoneNo, stationId, deviceId }), // ✅ deviceId add பண்ணு
    });

    const data = await res.json();
    console.log("💰 Savings API response:", JSON.stringify(data));

    if (data?.success && data?.data?.monthlyRecords) {
      const records = data.data.monthlyRecords;
      const total = Object.values(records).reduce((sum, rec) => sum + (rec.cost || 0), 0);
      const formatted = total.toLocaleString("en-IN", { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
      setTotalCost(`₹ ${formatted}`);
      await storeData(SAVINGS_KEY, JSON.stringify({ 
        totalCost: formatted, 
        monthlyRecords: records 
      }));
    } else {
      setTotalCost("₹ 0.00");
    }
  } catch (e) {
    console.log("Savings fetch error:", e);
    setTotalCost("₹ 0.00");
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={isDay ? LightBg : DarkBg}
        style={styles.topBackground}
        resizeMode="cover"
      >
        <View style={styles.headerRow}>
          <View style={styles.leftSection}>
            <TouchableOpacity
              onPress={() => navigation.navigate(SCREEN_NAMES.PROFILE, { stationId: selectedStationId })}
            >
              <Image source={ProfileImg} style={styles.profileImg} />
            </TouchableOpacity>
            <View style={styles.nameContainer}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[styles.profileName, { color: isDay ? "#000" : "#fff" }]}>
                  {stations.length > 0 ? stations[selectedStation]?.name : ""}
                </Text>
                <TouchableOpacity onPress={() => setVisible(true)} style={{ marginLeft: 6 }}>
                  <Ionicons name="chevron-forward-circle-outline" size={20} color={isDay ? "#000" : "#fff"} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.bottomContainer}>

          <View style={styles.unitsRow}>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>{todayGeneration ? Math.round(todayGeneration) : 0} Units</Text>
              <Text style={styles.unitLabel}>TODAY</Text>
            </View>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>{convertUnits(lifeTimeGeneration)}</Text>
              <Text style={styles.unitLabel}>LIFETIME</Text>
            </View>
          </View>

          <Text style={styles.updateText}>Updated {updatedTime}</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Your Solar home is <Text style={styles.brandText}>kondaas Assured™</Text>
            </Text>
            <View style={styles.progressBar}>
              <Animated.View style={[styles.progressFill, { width: widthInterpolate, backgroundColor: progressColor }]} />
            </View>
            <View style={styles.progressMarkers}>
              <Text style={styles.markerText}>Kick Off</Text>
              <Text style={styles.markerText}>Solar Freedom</Text>
            </View>
            <Text style={styles.profitText}>{totalCost}</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate(SCREEN_NAMES.KONDAAS_ASSURED, { stationId: selectedStationId })}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.primaryButtonText}>View Insights</Text>
                <Ionicons name="arrow-forward" size={26} color="#fff" style={{ marginLeft: 6 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate(SCREEN_NAMES.SUPPORT, { stationId: selectedStationId })}
            >
              <Text style={styles.secondaryButtonText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.grayButton}
              onPress={() => navigation.navigate(SCREEN_NAMES.REFER_AND_EARN)}
            >
              <Text style={styles.grayButtonText}>Refer & Earn</Text>
            </TouchableOpacity>

            <Text style={styles.bottomText}>Powered by Trisentrix | Version 1.2.26032301</Text>
          </View>

          <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Family List</Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Ionicons name="close-outline" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={16} color="#777" />
                  <Text style={styles.infoText}>Click a name to switch to that household.</Text>
                </View>

                {stations.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.familyItem, selectedStation === index && { backgroundColor: "#e6f0ff" }]}
                    onPress={() => {
                      setSelectedStation(index);
                      setSelectedStationId(item.id);
                      setProgressPercent(item.progressPercent || 0);
                      setProgressColor(item.progressColor === "green" ? "#2ecc71" : "#f39c12");
                      setVisible(false);

                      // ✅ New station-க்கு data reload
                      loadTodayGeneration(item.id);
                      getRealTimeGeneration(item.id);

                      // ✅ Savings new stationId-உடன் fetch
                      const phoneNo = userInfo?.UserInfo?.phoneNo;
                      if (phoneNo) fetchTotalSavings(phoneNo, item.id);
                    }}
                  >
                    <Image source={LightBg} style={styles.familyImg} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.familyName}>{item.name}</Text>
                      <Text style={styles.familyAddress}>{item.locationAddress}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.homeButton} onPress={() => setVisible(false)}>
                  <Ionicons name="settings-outline" size={16} color="#007BFF" />
                  <Text style={styles.homeButtonText}>Home settings</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

        </View>
      </ScrollView>

      {loading && <Loader />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  topBackground: { width: "106%", height: 340, paddingHorizontal: 20, paddingTop: 15, justifyContent: "flex-start" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  leftSection: { flexDirection: "row", alignItems: "center" },
  profileName: { fontSize: 15, fontWeight: "600", color: "#000" },
  profileImg: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  nameContainer: { justifyContent: "center" },
  bottomContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -25, paddingTop: 25, paddingBottom: 30 },
  unitsRow: { flexDirection: "row", justifyContent: "space-evenly", marginTop: 10 },
  unitBlock: { alignItems: "center" },
  unitValue: { fontSize: 20, fontWeight: "700", color: "#000" },
  unitLabel: { fontSize: 13, color: "#999" },
  updateText: { textAlign: "center", fontSize: 12, marginTop: 6, color: "#6c757d" },
  card: { borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 25, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 4 },
  cardTitle: { textAlign: "center", fontSize: 18, fontWeight: "500", color: "#333", flexWrap: "nowrap" },
  brandText: { color: "#ED1C25", fontWeight: "900" },
  progressBar: { marginTop: 16, height: 5, backgroundColor: "#eee", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#ED1C25" },
  progressMarkers: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  markerText: { fontSize: 10, color: "#999" },
  profitText: { textAlign: "center", fontSize: 22, fontWeight: "700", marginTop: 10, color: "#000" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#000" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  infoText: { fontSize: 13, color: "#666", flex: 1, marginLeft: 4 },
  familyItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, padding: 10, marginVertical: 5 },
  familyImg: { width: 50, height: 50, marginRight: 10, borderRadius: 10 },
  familyName: { fontSize: 15, fontWeight: "600", color: "#000" },
  familyAddress: { fontSize: 12, color: "#555" },
  homeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#007BFF", borderRadius: 8, marginTop: 15, paddingVertical: 10 },
  homeButtonText: { marginLeft: 6, fontSize: 14, fontWeight: "600", color: "#007BFF" },
  buttonContainer: { alignItems: "center", marginTop: 25 },
  primaryButton: { backgroundColor: "#ED1C25", paddingVertical: 12, borderRadius: 8, width: "85%", alignItems: "center", marginBottom: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondaryButton: { borderWidth: 1, borderColor: "#ED1C25", borderRadius: 8, width: "85%", alignItems: "center", paddingVertical: 12, marginBottom: 10 },
  secondaryButtonText: { color: "#ED1C25", fontWeight: "700", fontSize: 15 },
  grayButton: { backgroundColor: "#eee", borderRadius: 8, width: "85%", alignItems: "center", paddingVertical: 12 },
  grayButtonText: { color: "#333", fontWeight: "600", fontSize: 14 },
  bottomText: { color: '#0b0a0aff', fontSize: 10, fontFamily: FontStyles.POPPINS500, fontWeight: '400', padding: 15 },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});

export default MainScreen;
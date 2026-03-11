import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "react-native-vector-icons/Ionicons";
import LightBg from "../../assets/images/Lightmode.png";
import DarkBg from "../../assets/images/Darkmode.png";
import ProfileImg from "../../assets/images/Round.png";
import Loader from "../components/Loader";
import { getStorageData, USER_DATA } from "../service/localStorage";
import { fetchHistoricalData, fetchRealTimeData, fetchStationList } from "../api/api";
import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from "react-native";
import notifee from '@notifee/react-native';
import FontStyles from "../constants/fonts";
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated } from "react-native";
import { SCREEN_NAMES } from "../constants/screenNames";
import MonthlyDataManager from '../utils/MonthlyDataManager';
import SlabsSyncManager from '../utils/SlabsSyncManager';
import { saveStationId } from "../utils/stationId";
import SolarParseUtil from '../utils/SolarParseUtil';
import { useMonthlyData } from '../hooks/useMonthlyData';
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

const MainScreen = ({ navigation }) => {
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [isDay, setIsDay] = useState(isDaytime());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [visible, setVisible] = useState(false);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState(0);
  const [todayGeneration, setTodayGeneration] = useState(0);
  const [lifeTimeGeneration, setLifetimeGeneration] = useState(0);
  // const [totalCost, setTotalCost] = useState('---');
  const [refreshKey, setRefreshKey] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  const { monthlyData, monthlyDataLoading } =
  useMonthlyData(selectedStationId, userInfo?.phoneNo, refreshKey);
  const [updatedTime, setUpdatedTime] = useState("");
  const [installationAmount, setInstallationAmount] = useState(0);
  const [todaySavings, setTodaySavings] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
const [progressColor, setProgressColor] = useState("#f39c12");
  const progressAnim = useRef(new Animated.Value(0)).current;
let totalCost = "₹ Loading...";

if (!monthlyDataLoading && monthlyData?.cumulativeCost) {
  const costValue = Number(monthlyData.cumulativeCost);

  totalCost = `₹ ${costValue.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

console.log("MonthlyData:", monthlyData);

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });
  useEffect(() => {
  // Non-blocking initial full sync
    SlabsSyncManager.syncAllFromFirestore().catch(console.error);
  }, []);
  useEffect(() => {
    if (selectedStationId) {
      loadTodayGeneration(selectedStationId);
      getRealTimeGeneration(selectedStationId);
      getInstallationAmountFromFirebase(selectedStationId);
    }
  }, [selectedStationId]);
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progressPercent]);
  function calculateCommittedUnits(item) {
  const capacity =
    item.installedCapacity > 100
      ? item.installedCapacity / 1000
      : item.installedCapacity;

  const startTime = item.startOperatingTime || item.createdDate;

  const startDate = new Date(startTime * 1000);
  const today = new Date();

  const diffTime = today - startDate;
  const noOfDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  return capacity * 4 * noOfDays;
}

function processStations(data) {
  if (!Array.isArray(data) || data.length === 0) return [];

  const withUnits = data.map(item => {
    const units = calculateCommittedUnits(item);

    console.log("CALC →", item.name, units);

    return {
      ...item,
      committedUnits: units
    };
  });

  const maxValue = Math.max(...withUnits.map(x => x.committedUnits || 0));

  console.log("MAX VALUE:", maxValue);

  return withUnits.map(item => {
    const percent = maxValue ? (item.committedUnits / maxValue) * 100 : 0;

    console.log("PERCENT →", item.name, percent);

    return {
      ...item,
      progressPercent: percent,
      progressColor:
        item.committedUnits === maxValue ? "green" : "orange"
    };
  });
}
useFocusEffect(
  useCallback(() => {
    setRefreshKey(prev => prev + 1); // refresh rupees

    if (selectedStationId) {
      loadTodayGeneration(selectedStationId);
      getRealTimeGeneration(selectedStationId);
    }
  }, [selectedStationId])
);
  useFocusEffect(
  useCallback(() => {
    setRefreshKey(prev => prev + 1); // 👈 force refresh

    const loadUser = async () => {
      const data = await getStorageData(USER_DATA);

      if (data) {
        const parsed = JSON.parse(data);

        setStations([]);
        setSelectedStationId(null);
        setSelectedStation(0);

        setUserInfo(parsed);

        setTimeout(() => {
          loadStations();
        }, 100);
      }
    };

    loadUser();
  }, [])
);
  async function requestPermission() {
try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('iOS Push Permission Granted');
        return true;
      }
      return false;
    } else {
      // Android 13+ requires runtime permission
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Android Push Permission Granted');
          return true;
        }
        return false;
      }
      // Android 12 and below - no runtime permission needed
      return true;
    }
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
  }
  useEffect(() => {
    requestPermission();
  }, []);

  useEffect(() => {
    const now = new Date();

    const formatted =
      now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

    setUpdatedTime(formatted);
  }, []);

  
  useEffect(() => {
    notifee.createChannel({
      id: 'default',
      name: 'Default Notifications',
    });
  }, []);

    
  const unitRate = parseFloat(userInfo?.UserInfo?.unitsrupees || 0);
  const totalSavings = (lifeTimeGeneration * unitRate).toFixed(2);


  function isDaytime() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }
  const saveStationsToFirestore = async () => {
    try {
      const storedData = await AsyncStorage.getItem(USER_DATA);
      const parsedData = storedData ? JSON.parse(storedData) : null;
      const phoneNo = parsedData?.UserInfo?.phoneNo;
      if (!phoneNo) return;

      const stations = await fetchStationList();
      if (!stations || stations.length === 0) return;

      const docRef = firestore()
        .collection("userDetails")
        .doc(phoneNo.toString());

      const docSnap = await docRef.get();

      let existingList = [];
      if (docSnap.exists) {
        existingList = docSnap.data()?.devicelist || [];
      }

      const stationArray = stations.map(item => {
        const old = existingList.find(d => d.id === item.id);

        return {
          id: item.id,
          name: item.name,
          installationAmount: old?.installationAmount ?? "",
          // OLD VALUE irundha adha use pannum
        };
      });

      await docRef.set(
        {
          UserInfo: { phoneNo },
          devicelist: stationArray,
        },
        { merge: true }
      );

      console.log("Installation amount safe ✔");
    } catch (error) {
      console.error("Error:", error);
    }
  };
  const getInstallationAmountFromFirebase = async (stationId) => {
    try {
      const storedData = await AsyncStorage.getItem(USER_DATA);
      const parsedData = storedData ? JSON.parse(storedData) : null;
      const phoneNo = parsedData?.UserInfo?.phoneNo;

      if (!phoneNo) return;

      const doc = await firestore()
        .collection("userDetails")
        .doc(phoneNo.toString())
        .get();

      if (doc.exists) {
        const data = doc.data();
        const device = data?.devicelist?.find(d => d.id === stationId);

        if (device) {
          const amt = Number(device.installationAmount || 0);
          setInstallationAmount(amt);
          console.log("💰 Installation Amount:", amt);
        }
      }
    } catch (e) {
      console.log("Install amount error:", e);
    }
  };
  const loadTodayGeneration = async (stationId) => {
    try {
      const today = new Date();
      const dateString = today.toISOString().split("T")[0];

      const payload = {
        stationId: stationId,
        timeType: 2,
        startTime: dateString,
        endTime: dateString,
      };
      console.log("Today Gen Payload:", payload);
      const response = await fetchHistoricalData(payload);
      console.log(" Response:", response);

      if (
        response &&
        response.stationDataItems &&
        response.stationDataItems.length > 0
      ) {
        const generationValue = response.stationDataItems[0].generationValue || 0;
        setTodayGeneration(generationValue.toFixed(1));
      } else {
        setTodayGeneration(0);
      }
    } catch (error) {
      console.error("Error fetching today's generation:", error);
    }
  };

  const getRealTimeGeneration = async (stationId) => {
    try {
      console.log(" Fetching real-time data for station:", stationId);
      const response = await fetchRealTimeData({ stationId });
      console.log(" Real-time response:", response);

      if (response?.generationTotal !== undefined) {
        setLifetimeGeneration(response.generationTotal);
      } else {
        console.warn(" No generationTotal in response");
      }
    } catch (error) {
      console.error(" Error fetching real-time data:", error);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setIsDay(isDaytime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  if (userInfo?.UserInfo?.phoneNo) {
    loadStations();
    saveStationsToFirestore();
  }
}, [userInfo?.UserInfo?.phoneNo]);

  const convertUnits = (value) => {
    if (!value) return "0 Units";
    if (value >= 1_000_000) {
      return (value).toFixed(0) + " Units";
    } else if (value >= 1000) {
      return (value).toFixed(0) + " Units";
    } else {
      return value.toFixed(2) + " Units";
    }
  };
  const loadStations = async () => {
    try {
      console.log(" Fetching station list...");
      setLoading(true);
      const response = await fetchStationList();
      console.log(" Full API Response:", JSON.stringify(response, null, 2));
      let stationArray = [];
      if (Array.isArray(response)) {
        stationArray = response;
        console.log(" Response is an array. Stations:", stationArray.length);
      }
      else if (response && response.stationList) {
        stationArray = response.stationList;
        console.log(" Response has stationList. Stations:", stationArray.length);
      }
      else {
        console.log(" No valid station list found in response");
      }

      const processed = processStations(stationArray);
      console.log("Processed Stations:", processed);
      processed.forEach(s => {
  console.log(
    "Station:", s.name,
    "Units:", s.committedUnits,
    "Percent:", s.progressPercent,
    "Color:", s.progressColor
  );
});
setStations(processed);

if (processed.length > 0) {
  setSelectedStation(0);
  setSelectedStationId(processed[0].id);

  await saveStationId(processed[0].id);

  setProgressPercent(processed[0].progressPercent || 0);
  setProgressColor(
    processed[0].progressColor === "green" ? "#2ecc71" : "#f39c12"
  );
}
      if (stationArray.length > 0) {
        const firstStation = stationArray[0];
        setSelectedStation(0);
        setSelectedStationId(firstStation.id);
        await SolarParseUtil.clear();
        const parsed = SolarParseUtil.parseAndSave(firstStation);
      }
    } catch (error) {
      console.log(" Error fetching stations:", error);
    } finally {
      setLoading(false);
      console.log(" Station loading complete.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={isDay ? LightBg : DarkBg}
        style={styles.topBackground}
        resizeMode="cover"
      >
        {/* 🔹 Header */}
        <View style={styles.headerRow}>
          <View style={styles.leftSection}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(SCREEN_NAMES.PROFILE, {
                  stationId: selectedStationId,
                })
              }
            >
              <Image source={ProfileImg} style={styles.profileImg} />
            </TouchableOpacity>
            <View style={styles.nameContainer}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[
                    styles.profileName,
                    { color: isDay ? "#000" : "#fff" },
                  ]}
                >
                  {stations.length > 0
                    ? stations[selectedStation]?.name
                    : ""}
                </Text>

                <TouchableOpacity
                  onPress={() =>

                    setVisible(true)}
                  style={{ marginLeft: 6 }}
                >
                  <Ionicons
                    name="chevron-forward-circle-outline"
                    size={20}
                    color={isDay ? "#000" : "#fff"}
                  />
                </TouchableOpacity>
              </View>


            </View>
          </View>
        </View>

      </ImageBackground>

      {/* 🔹 Scrollable Content */}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.bottomContainer}>
          {/* Units Row */}
          <View style={styles.unitsRow}>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>
                {todayGeneration ? Math.round(todayGeneration) : 0} Units
              </Text>
              <Text style={styles.unitLabel}>TODAY</Text>
            </View>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>{convertUnits(lifeTimeGeneration)}</Text>
              <Text style={styles.unitLabel}>LIFETIME</Text>
            </View>
          </View>
          <Text style={styles.updateText}>Updated {updatedTime}</Text>
          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Your Solar home is{" "}
              <Text style={styles.brandText}>kondaas Assured™</Text>
            </Text>
            <View style={styles.progressBar}>
              <Animated.View
  style={[
    styles.progressFill,
    {
      width: widthInterpolate,
      backgroundColor: progressColor,
    },
  ]}
/>
            </View>
            <View style={styles.progressMarkers}>
              {/* <Text style={styles.markerText}>Invested</Text> */}
              <Text style={styles.markerText}>Kick Off</Text>
              <Text style={styles.markerText}>Solar Freedom</Text>
            </View>
            <Text style={styles.profitText}>{totalCost}
            </Text>
          </View>
          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                console.log(" Selected Station ID:", selectedStationId);
                navigation.navigate(SCREEN_NAMES.KONDAAS_ASSURED, {
                  stationId: selectedStationId,
                });
              }}
            >
              <View style={styles.buttonContent}>
                <Text style={styles.primaryButtonText}>View Insights</Text>
                 <Ionicons
      name="arrow-forward"
      size={26}   
      color="#fff"
      style={{ marginLeft: 6 }}
    />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>
                navigation.navigate(SCREEN_NAMES.SUPPORT, {
                  stationId: selectedStationId,
                })
              }
            >
              <Text style={styles.secondaryButtonText}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.grayButton}
              onPress={() =>
                navigation.navigate(SCREEN_NAMES.REFER_AND_EARN, {
                  // stationId: selectedStationId, 
                })
              }
            >
              <Text style={styles.grayButtonText}>Refer & Earn</Text>
            </TouchableOpacity>
            <Text style={styles.bottomText}>Powered by Trisentrix | Version 1.0</Text>

          </View>

          {/* 🔹 Modal */}
          <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => setVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Family List</Text>
                  <TouchableOpacity onPress={() => setVisible(false)}>
                    <Ionicons name="close-outline" size={24} color="#000" />
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#777"
                  />
                  <Text style={styles.infoText}>
                    Click a name to switch to that household.
                  </Text>
                </View>
                {stations.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.familyItem,
                      selectedStation === index && { backgroundColor: "#e6f0ff" },
                    ]}
                   onPress={async () => {
                    
  await SolarParseUtil.clear?.();

  setSelectedStation(index);
  setSelectedStationId(item.id);
  await saveStationId(item.id);

  setProgressPercent(item.progressPercent || 0);
  setProgressColor(item.progressColor === "green" ? "#2ecc71" : "#f39c12");

  setVisible(false);
}}
                  >
                    <Image source={LightBg} style={styles.familyImg} />
                    <View style={styles.container}>
                      <Text style={styles.familyName}>{item.name}</Text>
                      <Text style={styles.familyAddress}>{item.locationAddress}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.homeButton}
                  onPress={() => setVisible(false)}
                >
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

  topBackground: {
    width: "106%",
    height: 340,
    paddingHorizontal: 20,
    paddingTop: 15,
    justifyContent: "flex-start",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },
  
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)", // subtle gray background like screenshot
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  profileImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  nameContainer: {
    justifyContent: "center",
  },
  locationText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    paddingHorizontal: 15,
  },
  weatherText: {
    fontSize: 12,
    color: "#ddd",
    textAlign: "center",
  },
  bottomContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -25,
    paddingTop: 25,
    paddingBottom: 30,
  },
  unitsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 10,
  },
  unitBlock: { alignItems: "center" },
  unitValue: { fontSize: 20, fontWeight: "700", color: "#000" },
  unitLabel: { fontSize: 13, color: "#999" },
  updateText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 6,
    color: "#6c757d",
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 25,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  cardTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
    color: "#333",
  },
  brandText: { color: "#ED1C25", fontWeight: "900" },
  progressBar: {
    marginTop: 16,
    height: 5,
    backgroundColor: "#eee",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", width: "80%", backgroundColor: "#ED1C25" },
  progressMarkers: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  markerText: { fontSize: 10, color: "#999" },
  profitText: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 10,
    color: "#000",
  },
  descText: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
    color: "#444",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#000" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  infoText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
    marginLeft: 4,
  },
  familyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
  },
  activeFamily: { backgroundColor: "#E7F1FF" },
  familyImg: { width: 50, height: 50, marginRight: 10, borderRadius: 10 },
  familyName: { fontSize: 15, fontWeight: "600", color: "#000" },
  familyNameActive: { fontSize: 15, fontWeight: "700", color: "#007BFF" },
  familyAddress: { fontSize: 12, color: "#555" },
  homeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#007BFF",
    borderRadius: 8,
    marginTop: 15,
    paddingVertical: 10,
  },
  homeButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#007BFF",
  },
  buttonContainer: { alignItems: "center", marginTop: 25 },
  primaryButton: {
    backgroundColor: "#ED1C25",
    paddingVertical: 12,
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#ED1C25",
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 10,
  },
  secondaryButtonText: { color: "#ED1C25", fontWeight: "700", fontSize: 15 },
  grayButton: {
    backgroundColor: "#eee",
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    paddingVertical: 12,
  },
  bottomText: {
    color: '#0b0a0aff',
    fontSize: 10,
    fontFamily: FontStyles.POPPINS500,
    fontWeight: '400',
    padding: 15,

  },
  buttonContent: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
},
  grayButtonText: { color: "#333", fontWeight: "600", fontSize: 14 },
});

export default MainScreen;

import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import LightBg from "../../assets/images/Lightmode.png";
import DarkBg from "../../assets/images/Darkmode.png";
import ProfileImg from "../../assets/images/Round.png";
import Loader from "../components/Loader";
import { getStorageData, USER_DATA } from "../service/localStorage";
import { fetchHistoricalData, fetchRealTimeData, fetchStationList } from "../api/api";

const MainScreen = ({ navigation }) => {
  const [isDay, setIsDay] = useState(isDaytime());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [visible, setVisible] = useState(false);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStation, setSelectedStation] = useState(0);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [todayGeneration, setTodayGeneration] = useState(0);
  const [lifetimeGeneration, setLifetimeGeneration] = useState(0);
  const [userInfo, setUserInfo] = useState(null);
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (data) {
          const parsed = JSON.parse(data);
          setUserInfo(parsed);
          console.log(" Loaded User Info:", parsed);
        } else {
          console.warn(" No User Info found in storage");
        }
      } catch (err) {
        console.error(" Error loading user info:", err);
      }
    };

    fetchUserInfo();
  }, []);

  const unitRate = parseFloat(userInfo?.UserInfo?.unitsrupees || 0);
  const totalSavings = (lifetimeGeneration * unitRate).toFixed(2);

  function isDaytime() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }
  useEffect(() => {
    if (selectedStationId) {
      loadTodayGeneration(selectedStationId);
      getRealTimeGeneration(selectedStationId);

    }
  }, [selectedStationId]);
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
      console.log("🌞 Response:", response);

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
      console.log("⚡ Fetching real-time data for station:", stationId);
      const response = await fetchRealTimeData({ stationId });
      console.log("📦 Real-time response:", response);

      if (response?.generationTotal !== undefined) {
        setLifetimeGeneration(response.generationTotal);
      } else {
        console.warn("⚠️ No generationTotal in response");
      }
    } catch (error) {
      console.error("🚨 Error fetching real-time data:", error);
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
    loadStations();
  }, []);

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

      setStations(stationArray);
      if (stationArray.length > 0) {
        const firstStation = stationArray[0];
        console.log("Default Station ID:", firstStation.id);
        console.log("Default Station Name:", firstStation.name);
        setSelectedStation(0);
        setSelectedStationId(firstStation.id);
      }
    } catch (error) {
      console.log(" Error fetching stations:", error);
    } finally {
      setLoading(false);
      console.log(" Station loading complete.");
    }
  };

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedTemp = "";
  const formattedCity = "";

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
                navigation.navigate("ProfileScreen", {
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

              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="time-outline" size={14} color={isDay ? "#444" : "#fff"} />
          <Text style={[styles.locationText, { color: isDay ? "#444" : "#fff" }]}>
            {` ${formattedTime} · ${formattedTemp} · ${formattedCity}`}
          </Text>
        </View>

        {/* 🔹 Weather Info */}
        {/* <View style={styles.weatherRow}>
          <Ionicons
            name="warning-outline"
            size={16}
            color={isDay ? "#e67e22" : "#f6b93b"}
          />
          <Text style={[styles.weatherText, { color: isDay ? "#333" : "#fff" }]}>
            Rainy weather might not give optimum generation
          </Text>
        </View> */}
      </ImageBackground>

      {/* 🔹 Scrollable Content */}
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.bottomContainer}>
          {/* Units Row */}
          <View style={styles.unitsRow}>
            {/* <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>
                {todayGeneration} kWh
              </Text>
              <Text style={styles.unitLabel}>TODAY</Text>
            </View> */}
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>
                {todayGeneration ? Math.round(todayGeneration) : 0} kWh
              </Text>
              <Text style={styles.unitLabel}>TODAY</Text>
            </View>

            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>
                {lifetimeGeneration
                  ? (lifetimeGeneration / 1000).toFixed(2)
                  : 0}{" "}
                Units
              </Text>
              <Text style={styles.unitLabel}>LIFETIME</Text>
            </View>


          </View>
          <Text style={styles.updateText}>Updated 15 mins ago</Text>
          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Your Solar home is{" "}
              <Text style={styles.brandText}>kondaas</Text> Assured™
            </Text>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            <View style={styles.progressMarkers}>
              <Text style={styles.markerText}>Invested</Text>
              <Text style={styles.markerText}>Break-even</Text>
              <Text style={styles.markerText}>ROI Achieved</Text>
            </View>
            <Text style={styles.profitText}>₹ {totalSavings}
            </Text>
            {/* <Text style={styles.descText}>
              Billings: from ₹7,000 → to just ₹500 last month.{"\n"}That’s Solar
              Freedom!
            </Text> */}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                console.log(" Selected Station ID:", selectedStationId);
                navigation.navigate("KondaasAssuredScreen", {
                  stationId: selectedStationId,
                });
              }}
            >
              <Text style={styles.primaryButtonText}>View Insights →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("SupportScreen")}
            >
              <Text style={styles.secondaryButtonText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.grayButton}
              onPress={() =>
                navigation.navigate("ReferandEarnScreen", {
                  // stationId: selectedStationId, 
                })
              }
            >
              <Text style={styles.grayButtonText}>Refer & Earn</Text>
            </TouchableOpacity>
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
                    onPress={() => {
                      setSelectedStation(index);
                      setSelectedStationId(item.id);
                      setVisible(false);
                      console.log("🟢 Station clicked:");
                      console.log("➡️ Index:", index);
                      console.log("🏠 Name:", item.name);
                      console.log("🆔 ID:", item.id);
                    }}
                  >
                    <Image source={LightBg} style={styles.familyImg} />
                    <View>
                      <Text style={styles.familyName}>{item.name}</Text>
                      <Text style={styles.familyAddress}>{item.locationAddress}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.homeButton}>
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
  container: { flex: 1, backgroundColor: "#f5f5f5" },

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
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2ecc71",
    marginRight: 5,
  },
  liveText: {
    color: "#2ecc71",
    fontSize: 12,
    fontWeight: "500",
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
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  brandText: { color: "#e60000", fontWeight: "700" },
  progressBar: {
    marginTop: 16,
    height: 5,
    backgroundColor: "#eee",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", width: "80%", backgroundColor: "#e60000" },
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
    backgroundColor: "#e60000",
    paddingVertical: 12,
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#e60000",
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 10,
  },
  secondaryButtonText: { color: "#e60000", fontWeight: "700", fontSize: 15 },
  grayButton: {
    backgroundColor: "#eee",
    borderRadius: 8,
    width: "85%",
    alignItems: "center",
    paddingVertical: 12,
  },
  grayButtonText: { color: "#333", fontWeight: "600", fontSize: 14 },
});

export default MainScreen;

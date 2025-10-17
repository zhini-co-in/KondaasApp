import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Image,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import LightBg from "../../assets/images/Lightmode.png";
import DarkBg from "../../assets/images/Darkmode.png";
import ProfileImg from "../../assets/images/Round.png";
const MainScreen = ({ navigation }) => {
  const [isDay, setIsDay] = useState(isDaytime());
  const [currentTime, setCurrentTime] = useState(new Date());

  function isDaytime() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18;
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      setIsDay(isDaytime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedTemp = "32°C";
  const formattedCity = "Madurai";

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={isDay ? LightBg : DarkBg}
        style={styles.topBackground}
        resizeMode="cover"
      >
        {/* Header Row */}
        {/* --- Header Row --- */}
        <View style={styles.headerRow}>
          {/* Left Side: Profile + Text */}
          <View style={styles.leftSection}>
            <Image source={ProfileImg} style={styles.profileImg} />

            <View style={styles.nameContainer}>
              <Text
                style={[
                  styles.profileName,
                  { color: isDay ? "#000" : "#fff" },
                ]}
              >
                Ram kumar
              </Text>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            </View>
          </View>

          {/* Right Side Icons */}
          <View style={styles.iconRow}>
            <TouchableOpacity style={styles.iconBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={isDay ? "#000" : "#fff"}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBox}>
              <Ionicons
                name="document-text-outline"
                size={18}
                color={isDay ? "#000" : "#fff"}
              />
            </TouchableOpacity>
          </View>
        </View>


        {/* Time, Temp, City */}
        <View style={styles.locationRow}>
          <Ionicons
            name="time-outline"
            size={14}
            color={isDay ? "#444" : "#fff"}
          />
          <Text
            style={[
              styles.locationText,
              { color: isDay ? "#444" : "#fff" },
            ]}
          >
            {` ${formattedTime} · ${formattedTemp} · ${formattedCity}`}
          </Text>
        </View>

        {/* Weather Info */}
        <View style={styles.weatherRow}>
          <Ionicons
            name="warning-outline"
            size={16}
            color={isDay ? "#e67e22" : "#f6b93b"}
          />
          <Text
            style={[
              styles.weatherText,
              { color: isDay ? "#333" : "#fff" },
            ]}
          >
            Rainy weather might not give optimum generation
          </Text>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.bottomContainer}>
          {/* Units Row */}
          <View style={styles.unitsRow}>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>15 Units</Text>
              <Text style={styles.unitLabel}>TODAY</Text>
            </View>
            <View style={styles.unitBlock}>
              <Text style={styles.unitValue}>3170 Units</Text>
              <Text style={styles.unitLabel}>LIFETIME</Text>
            </View>
          </View>

          <Text style={styles.updateText}>Updated 15 mins ago</Text>

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

            <Text style={styles.profitText}>₹ 34,124.56</Text>
            <Text style={styles.descText}>
              Billings: from ₹7,000 → to just ₹500 last month.{"\n"}That’s Solar
              Freedom!
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("KondaasAssuredScreen")}>
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
              onPress={() => navigation.navigate("ProductsHomeScreen")}
            >
              <Text style={styles.grayButtonText}>View All Our Products</Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
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

  // --- Buttons ---
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

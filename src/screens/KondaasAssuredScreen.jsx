import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MultiLineChart from "../components/MultiLineChart";
import { fetchHistoricalData } from "../api/api";
import Loader from "../components/Loader";
import { getStorageData, USER_DATA } from "../service/localStorage";

const KondaasAssuredScreen = ({ navigation, route }) => {
  const { stationId } = route.params || {};
  console.log(" Received Station ID:", stationId);
  const [chartData, setChartData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ generated: 0, committed: 0 });
const [UserInfo, setUserInfo] = useState(null);

  const loadData = async () => {
    try {

      setLoading(true);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const startTime = `${year}-${month}-01`;
      const endTime = `${year}-${month}-${day}`;
      const body = {
        stationId,
        timeType: 2,
        startTime,
        endTime,
      };
      console.log(" Request Body:", JSON.stringify(body, null, 2));
      const data = await fetchHistoricalData(body);
      console.log(" Full API Response:", data);

      if (data?.success && Array.isArray(data.stationDataItems)) {
        const values = data.stationDataItems.map((item) =>
          parseFloat(item.generationValue || 0)
        );

        const labels = data.stationDataItems.map((item) =>
          item.day?.toString() || ""
        );

        const committedValues = values.map((v) => v * 0.9);
        const totalGenerated = values.reduce((sum, v) => sum + v, 0);
        const totalCommitted = committedValues.reduce((sum, v) => sum + v, 0);
        setTotals({
          generated: totalGenerated.toFixed(0),
          committed: totalCommitted.toFixed(0),
        });
        setChartData([
          { label: "Generated (kWh)", values, color: "#EF4444" },
          { label: "Committed (kWh)", values: committedValues, color: "#FECACA" },
        ]);

        setLabels(labels);

        console.log(" Labels (Days):", labels);
        console.log(" Generated Values:", values);
      } else {
        console.log(" Unexpected API format:", data);
      }
    } catch (err) {
      console.error(" Failed to fetch historical data:", err);
    } finally {
      setLoading(false);
    }
  };
useEffect(() => {
  const fetchUserInfo = async () => {
    try {
      const data = await getStorageData(USER_DATA);
      if (data) {
        const parsed = JSON.parse(data);
        console.log("✅ Loaded User Info Raw:", parsed);
        setUserInfo(parsed.UserInfo || parsed);
      } else {
        console.warn("⚠️ No User Info found in storage");
      }
    } catch (err) {
      console.error("❌ Error loading user info:", err);
    }
  };

  fetchUserInfo();
  loadData();
}, []);

const unitsRupees = parseFloat(UserInfo?.unitsrupees || 0);
console.log("⚡ Units Rupees:", unitsRupees);

const totalGenerated = parseFloat(totals.generated || 0);
const totalSavings = (totalGenerated * unitsRupees).toFixed(0);

// Debug logs
console.log("🔹 UserInfo:", UserInfo);
console.log("🔹 Units Rupees:", unitsRupees);
console.log("🔹 Total Generated:", totalGenerated);
console.log("💰 Total Savings (₹):", totalSavings);



  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const currentDate = new Date().getDate();
      if (currentDate !== new Date().getDate()) {
        loadData();
      }
    }, 3600000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kondaas Assured</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Showing generation until{" "}
          {new Date().toLocaleString("en-US", { month: "short", year: "numeric" })}
        </Text>

        <View style={styles.unitsRow}>
          <View style={styles.unitBox}>
            <Text style={styles.unitLabel}>GENERATED</Text>
            <Text style={styles.unitValue}>{totals.generated} Units</Text>
          </View>

          <View style={styles.unitBox}>
            <Text style={styles.unitLabel}>COMMITTED</Text>
            <Text style={styles.unitValue}>{totals.committed} Units</Text>
          </View>
        </View>

        <View style={styles.chartContainer}>
          {chartData.length > 0 ? (
            <MultiLineChart datasets={chartData} labels={labels} />
          ) : (
            <Text style={{ textAlign: "center", color: "#888" }}>No data available</Text>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: "#E6F9EF" }]}>
          <View style={styles.iconCircleGreen}>
            <Ionicons name="arrow-up-outline" size={18} color="#22C55E" />
          </View>
          <Text style={styles.infoText}>
            Your Solar home has generated{" "}
            <Text style={{ fontWeight: "700" }}>5.4%</Text> above{" "}
            <Text style={{ fontWeight: "700" }}>Kondaas Assured™</Text> target!
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: "#FFF4F4" }]}>
          <View style={styles.iconCircleRed}>
            <Ionicons name="wallet-outline" size={18} color="#E60000" />
          </View>
          <Text style={styles.infoText}>
            Your Solar home has saved{" "}
            {/* <Text style={{ fontWeight: "700" }}>₹34,125</Text> until{" "} */}
                      <Text style={{ fontWeight: "700" }}>₹{totalSavings}</Text> until{" "}

            {new Date().toLocaleString("en-US", { month: "short", year: "numeric" })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("PowerGenerationScreen", { stationId })}
        >
          <Text style={styles.footerLink}>
            Know more about <Text style={{ fontWeight: "700" }}>Kondaas Assured™ →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {loading && <Loader />}
    </SafeAreaView>
  );
};

export default KondaasAssuredScreen;


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

  scroll: { padding: 16, paddingBottom: 40 },

  subtitle: {
    textAlign: "center",
    color: "#666",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 20,
  },
  unitsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 10,
  },
  unitBox: {
    alignItems: "center",
  },
  unitLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#555",
  },
  unitValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  chartContainer: {
    alignItems: "center",
    marginBottom: 15,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  iconCircleGreen: {
    backgroundColor: "#C8F3D8",
    borderRadius: 20,
    padding: 6,
    marginRight: 10,
  },
  iconCircleRed: {
    backgroundColor: "#FFD6D6",
    borderRadius: 20,
    padding: 6,
    marginRight: 10,
  },
  infoText: { flex: 1, fontSize: 13, color: "#333" },

  footerLink: {
    color: "#E60000",
    marginTop: 10,
    fontSize: 13,
    width: "100%",
  },
});

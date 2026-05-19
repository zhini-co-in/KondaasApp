import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import MultiLineChart from "../components/MultiLineChart";
import { fetchHistoricalData } from "../api/api1";
import Loader from "../components/Loader";
import { getStorageData, storeData, USER_DATA, getSavingsKey } from "../service/localStorage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
import { SCREEN_NAMES } from "../constants/screenNames";

const KondaasAssuredScreen = ({ navigation, route }) => {
  const { stationId } = route.params || {};

  // ✅ முதல்ல எல்லா useState
  const [chartData, setChartData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ generated: 0, committed: 0 });
  const [UserInfo, setUserInfo] = useState(null);
  const [percentAbove, setPercentAbove] = useState(0);
  const [committedUnits, setCommittedUnits] = useState(0);
  const [currentMonthSavings, setCurrentMonthSavings] = useState(0);

  // ✅ useState-க்கு கீழே மட்டும் இதை வை
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = now.toLocaleString("en-US", { month: "short", year: "numeric" });

  // ─── Load user info + savings ─────────────────────────────────────────────
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (!data) return;

        const parsed = JSON.parse(data);
        console.log("Loaded User Info Raw:", parsed);
        setUserInfo(parsed.UserInfo || parsed);

        const phoneNo = parsed?.UserInfo?.phoneNo || parsed?.phoneNo;
        const deviceId = parsed?.deviceId;
        const authToken = parsed?.authToken || parsed?.UserInfo?.authToken;

        if (phoneNo) {
          await fetchCurrentMonthSavings(phoneNo, stationId, deviceId, authToken);
        }
      } catch (err) {
        console.error("Error loading user info:", err);
      }
    };

    fetchUserInfo();
    loadData();
  }, []);

  // ─── Interval refresh ─────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 3600000);
    return () => clearInterval(interval);
  }, []);

  // ─── Fetch current month savings from cache or API ────────────────────────
  const fetchCurrentMonthSavings = async (phoneNo, stationId, deviceId, authToken) => {
    try {
      // ✅ Cache key — stationId per station
      const SAVINGS_KEY = `${getSavingsKey(phoneNo)}_${stationId}`;
      const cached = await getStorageData(SAVINGS_KEY);

      if (cached) {
        const parsedCache = JSON.parse(cached);
        const monthlyRecords = parsedCache.monthlyRecords || {};
        const thisMonthCost = monthlyRecords[currentMonthKey]?.cost || 0;
        console.log("💰 Cache savings for", currentMonthKey, ":", thisMonthCost);
        setCurrentMonthSavings(thisMonthCost);
        return; // ✅ Cache hit — API call வேண்டாம்
      }

      // ✅ Cache miss — API call
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;

      const res = await fetch("https://board.trisentrix.com/savings/calculate-savings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({ phoneNo, stationId, deviceId }), // ✅ deviceId add
      });

      const data = await res.json();
      console.log("💰 Savings API:", JSON.stringify(data));

      if (data?.success && data?.data?.monthlyRecords) {
        const monthlyRecords = data.data.monthlyRecords;

        // ✅ Current month cost மட்டும் எடு
        const thisMonthCost = monthlyRecords[currentMonthKey]?.cost || 0;
        setCurrentMonthSavings(thisMonthCost);

        // ✅ Cache save
        const totalCost = Object.values(monthlyRecords)
          .reduce((sum, rec) => sum + (rec.cost || 0), 0)
          .toLocaleString("en-IN", { minimumFractionDigits: 2 });

        await storeData(
          SAVINGS_KEY,
          JSON.stringify({ totalCost, monthlyRecords })
        );
      }
    } catch (e) {
      console.log("Savings fetch error:", e);
    }
  };

  // ─── Load chart data ──────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      const CACHE_KEY = `kondaas_${stationId}_${year}_${month}`;

      // ✅ Cache இருந்தா உடனே show
      const cached = await getStorageData(CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        setTotals(c.totals);
        setChartData(c.chartData);
        setLabels(c.labels);
        setPercentAbove(c.percentAbove);
      }

      // ✅ Offline-ல return
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        setLoading(false);
        return;
      }

      const startTime = `${year}-${month}-01`;
      const endTime = `${year}-${month}-${day}`;
      const data = await fetchHistoricalData({ stationId, timeType: 2, startTime, endTime });

      if (data?.stationDataItems && Array.isArray(data.stationDataItems)) {
        const values = data.stationDataItems.map((item) =>
          parseFloat(item.generationValue || 0)
        );
        const newLabels = data.stationDataItems.map(
          (item) => item.day?.toString() || ""
        );
        const committedValues = values.map((v) => v * 0.9);
        const totalGenerated = values.reduce((sum, v) => sum + v, 0);
        const totalCommitted = committedValues.reduce((sum, v) => sum + v, 0);

        const newTotals = {
          generated: totalGenerated.toFixed(0),
          committed: totalCommitted.toFixed(0),
        };
        const newChartData = [
          { label: "Generated (kWh)", values, color: "#EF4444" },
          { label: "Committed (kWh)", values: committedValues, color: "#FF8A80" },
        ];

        setTotals(newTotals);
        setChartData(newChartData);
        setLabels(newLabels);

        await loadCommitted(totalGenerated.toFixed(0));

        // ✅ percent calculate பண்ணி cache save
        const committed = committedUnits > 0 ? committedUnits : 1;
        const percent = ((totalGenerated / committed) * 100).toFixed(1);

        await storeData(
          CACHE_KEY,
          JSON.stringify({
            totals: newTotals,
            chartData: newChartData,
            labels: newLabels,
            percentAbove: percent,
          })
        );
      } else {
        console.log("Unexpected API format:", data);
      }
    } catch (err) {
      console.error("Failed to fetch historical data:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Load committed units from Firestore ──────────────────────────────────
  const loadCommitted = async (generatedUnits) => {
    try {
      const snapshot = await firestore().collection("comittedUnits").get();

      let committed = 0;
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          committed = Number(doc.data().Comitted);
        });
      }

      setCommittedUnits(committed);

      const percent =
        committed > 0
          ? ((generatedUnits / committed) * 100).toFixed(1)
          : 0;

      console.log("⚡ Generated units:", generatedUnits);
      console.log("📊 Percentage Above:", percent, "%");

      setPercentAbove(percent);
    } catch (error) {
      console.log("🔥 Error fetching committed units:", error);
    }
  };

  // ─── Display savings (current month only) ────────────────────────────────
  const totalSavings = currentMonthSavings.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insights</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Showing generation for {monthLabel}
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
            <Text style={{ textAlign: "center", color: "#888" }}>
              No data available
            </Text>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: "#E6F9EF" }]}>
          <View style={styles.iconCircleGreen}>
            <Ionicons name="arrow-up-outline" size={18} color="#22C55E" />
          </View>
          <Text style={styles.infoText}>
            Your Solar home has generated{" "}
            <Text style={{ fontWeight: "900" }}>{percentAbove}%</Text> above{" "}
            <Text style={{ fontWeight: "900" }}>Kondaas Assured™</Text> target!
          </Text>
        </View>

        {/* ✅ Current month savings மட்டும் காட்டுது */}
        <View style={[styles.infoCard, { backgroundColor: "#FFF4F4" }]}>
          <View style={styles.iconCircleRed}>
            <Ionicons name="wallet-outline" size={18} color="#E60000" />
          </View>
          <Text style={styles.infoText}>
            Your Solar home has saved{" "}
            <Text style={{ fontWeight: "700" }}>₹{totalSavings}</Text>{" "}
            in <Text style={{ fontWeight: "700" }}>{monthLabel}</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={styles.reachUsButton}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate(SCREEN_NAMES.POWER_GENERATION, { stationId })
          }
        >
          <Text style={styles.reachUsText}>
            View More Insights{" "}
            <Text style={styles.bigArrow}>→</Text>
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
  unitBox: { alignItems: "center" },
  unitLabel: { fontSize: 10, fontWeight: "600", color: "#555" },
  unitValue: { fontSize: 16, fontWeight: "700", color: "#111" },
  chartContainer: { alignItems: "center", marginTop: 10, marginBottom: 15 },
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
  reachUsButton: {
    flexDirection: "row",
    marginTop: 12,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 56,
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  reachUsText: { color: "#E60000", fontSize: 16, fontWeight: "600" },
  bigArrow: { fontSize: 20, fontWeight: "700" },
});
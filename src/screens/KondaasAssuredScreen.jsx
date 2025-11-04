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
import Loader from '../components/Loader';
const KondaasAssuredScreen = ({ navigation }) => {
  const [chartData, setChartData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = "817f88303a0f82f933ee6497a33c2ae44223d98a82aee035";

  const loadData = async () => {
    try {
      setLoading(true);
      const body = {
        deviceId: 200203179,
        deviceSn: "dev1800078101",
        timeType: 4,
        startTime: "2019-01-01",
        endTime: "2019-05-05",
      };

      const data = await fetchHistoricalData(body, token);

      if (data?.success && data?.dataList) {
        const values = data.dataList.map((item) => parseFloat(item.value));
        const dates = data.dataList.map((item) => item.time);

        setChartData([
          { label: "Generated", values: values, color: "#EF4444" },
          { label: "Committed", values: values.map((v) => v * 0.9), color: "#FECACA" },
        ]);
        setLabels(dates);
      } else {
        console.log("API returned unexpected data:", data);
      }
    } catch (err) {
      console.error("Failed to fetch historical data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
          <Text style={styles.subtitle}>Showing for generation until Nov 2025</Text>

          <View style={styles.unitsRow}>
            <View style={styles.unitBox}>
              <Text style={styles.unitLabel}>GENERATED</Text>
              <Text style={styles.unitValue}>3170 Units</Text>
            </View>

            <View style={styles.unitBox}>
              <Text style={styles.unitLabel}>COMMITTED</Text>
              <Text style={styles.unitValue}>3000 Units</Text>
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
              <Text style={{ fontWeight: "700" }}>₹34,125</Text> until Aug 2025
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("PowerGenerationScreen")}>
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
        justifyContent: "space-between", // one left, one right
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

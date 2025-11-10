import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import api, { fetchHistoricalData } from "../api/api";
import { setAuthToken } from "../api/api";

const screenWidth = Dimensions.get("window").width;

const PowerGenerationScreen = ({ navigation, route }) => {
  const { stationId } = route.params || {};
  const [selectedTab, setSelectedTab] = useState("Day");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [totalGenerated, setTotalGenerated] = useState(0);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const getDateRange = (tab) => {
    const today = new Date();
    let start, end;
    if (tab === "Day") {
      start = formatDate(today);
      end = formatDate(today);
    }
    else if (tab === "Week") {
      const day = today.getDay();
      const diffToSunday = today.getDate() - day;
      const sunday = new Date(today.setDate(diffToSunday));
      const monday = new Date(sunday);
      monday.setDate(sunday.getDate() + 6);
      start = formatDate(sunday);
      end = formatDate(monday);
    } else if (tab === "Month") {

      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      start = `${y}-${m}`;
      end = `${y}-${m}`;
    } else if (tab === "Year") {

      const y = today.getFullYear();
      start = `${y}`;
      end = `${y}`;
    }

    return { start, end };
  };

  const fetchGenerationData = async (tab) => {
    setLoading(true);
    try {
      await setAuthToken();

      const { start, end } = getDateRange(tab);
      const timeType =
        tab === "Day" ? 2 :
          tab === "Week" ? 2 :
            tab === "Month" ? 3 :
              tab === "Year" ? 4 : null;

      const payload = {
        stationId,
        timeType,
        startTime: start,
        endTime: end,
      };

      console.log("📤 Payload:", payload);
      const data = await fetchHistoricalData(payload);

      const items = data.stationDataItems || [];
      const labels = [];
      const dataPoints = [];

      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];

      items.forEach((item, index) => {
        if (tab === "Day") {
          labels.push(item.hour?.toString() || `${index + 1}`);
        } else if (tab === "Week" || tab === "Month") {
          labels.push(item.day?.toString() || `${index + 1}`);
        } else if (tab === "Year") {
          labels.push(monthNames[item.month - 1] || `M${index + 1}`);
        }

        dataPoints.push(Number(item.generationValue ?? 0));
      });

      const total = dataPoints.reduce((sum, val) => sum + val, 0);
      setTotalGenerated(total.toFixed(1));

      setChartData({
        labels,
        datasets: [{ data: dataPoints }],
      });

      setSelectedDate(`${start}`);
    } catch (error) {
      console.error(" API Error:", error);
      console.log("Response:", error?.response?.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stationId) fetchGenerationData(selectedTab);
  }, [selectedTab]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Power Generation</Text>
        </View>
        <View style={styles.tabContainer}>
          {["Day", "Week", "Month", "Year"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                selectedTab === tab && styles.activeTabButton,
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.dateSelector}>
          <Text style={styles.dateText}>{selectedDate}</Text>
        </View>
        {loading && (
          <ActivityIndicator
            size="large"
            color="#FF6B6B"
            style={{ marginTop: 20 }}
          />
        )}

        {!loading && chartData && (
          <BarChart
            data={chartData}
            width={screenWidth - 30}
            height={240} 
            yAxisSuffix=" kWh"
             
  withVerticalLabels={false}   
            fromZero
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0, 102, 204, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
              barPercentage: 0.6,
              style: { borderRadius: 12 },
              propsForLabels: {
                fontSize: 10,
                paddingRight: 10,
              },
            }}
            style={{
              marginVertical: 10,
              borderRadius: 12,
              alignSelf: "center",
              paddingRight: 100,
              paddingLeft: 100,
              paddingBottom: 15,
            }}
          />
        )}
        {/* Summary Box */}
        <View style={styles.energyBox}>
          <Ionicons
            name="sunny"
            size={20}
            color="#E60000"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.energyText}>
            Your solar home generated{" "}
            <Text style={styles.highlight}>80%</Text> of the potential energy
            for today
          </Text>
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalGenerated} Units</Text>
            <Text style={styles.summaryLabel}>Total Generated</Text>
          </View>
          {/* <View style={styles.summaryBox}>
  <Text style={styles.summaryTitle}>
    {selectedTab === "Month" ? "Monthly Production:" : "Total Production:"}
  </Text>
  <Text style={styles.summaryValue}>{totalGenerated} kWh</Text>
</View> */}

          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              ₹{(totalGenerated * 10).toFixed(0)}
            </Text>
            <Text style={styles.summaryLabel}>Money Saved</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate("KondaaAboutScreen")}
        >
          <Text style={styles.footerLink}>
            Know more about{" "}
            <Text style={{ fontWeight: "700" }}>Kondaas Assured™ →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
export default PowerGenerationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F6F6" },
  header: { flexDirection: "row", alignItems: "center", padding: 15 },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 10 },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 15,
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
    padding: 5,
  },

  tabButton: { flex: 1, alignItems: "center", paddingVertical: 8 },
  activeTabButton: { backgroundColor: "#FF6B6B", borderRadius: 6 },
  tabText: { color: "#444", fontSize: 14, fontWeight: "500" },
  activeTabText: { color: "#fff" },
  dateSelector: {
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 15,
  },
  dateText: { fontSize: 15, fontWeight: "500" },

  energyBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 10,
    padding: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  energyText: { flex: 1, fontSize: 14, color: "#333" },
  highlight: { color: "#FF6B6B", fontWeight: "700" },

  summaryContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 30,
    marginTop: 15,
  },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#000" },
  summaryLabel: { fontSize: 13, color: "#666", marginTop: 4 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 10,
    padding: 10,
    marginTop: 20,
  },
  infoText: { fontSize: 13, color: "#333", marginLeft: 6, flex: 1 },
  footerLink: { color: "#E60000", textAlign: "left", marginTop: 10, fontSize: 13 },
});

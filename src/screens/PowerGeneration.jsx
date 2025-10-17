import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as GiftedCharts from "react-native-gifted-charts"; 
const { AreaChart, LineChart } = GiftedCharts; 

const PowerGeneration = ({ navigation }) => {
  const [selectedTab, setSelectedTab] = useState("Day");

  // Chart Data
  const dayData = [
    { value: 0, label: "8am" },
    { value: 2, label: "10am" },
    { value: 4, label: "12pm" },
    { value: 6, label: "2pm" },
    { value: 3, label: "4pm" },
    { value: 1, label: "6pm" },
    { value: 0, label: "8pm" },
  ];

  const weekData = [
    { value: 3, label: "Mon" },
    { value: 5, label: "Tue" },
    { value: 2, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 6, label: "Fri" },
    { value: 7, label: "Sat" },
    { value: 5, label: "Sun" },
  ];

  const monthData = [
    { value: 10, label: "1" },
    { value: 14, label: "5" },
    { value: 12, label: "10" },
    { value: 15, label: "15" },
    { value: 18, label: "20" },
    { value: 20, label: "25" },
    { value: 17, label: "30" },
  ];

  const yearData = [
    { value: 100, label: "Jan" },
    { value: 130, label: "Mar" },
    { value: 140, label: "May" },
    { value: 120, label: "Jul" },
    { value: 160, label: "Sep" },
    { value: 180, label: "Nov" },
    { value: 150, label: "Dec" },
  ];

  const chartData = { Day: dayData, Week: weekData, Month: monthData, Year: yearData };
  const data = chartData[selectedTab];
  const screenWidth = Dimensions.get("window").width - 40;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Ionicons
          name="arrow-back"
          size={22}
          color="#000"
          onPress={() => navigation.goBack?.()}
        />
        <Text style={styles.headerTitle}>Power Generation</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {["Day", "Week", "Month", "Year"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, selectedTab === tab && styles.tabButtonActive]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Row */}
      <View style={styles.dateRow}>
        <Ionicons name="chevron-back-outline" size={20} color="#000" />
        <Text style={styles.dateText}>Today, 7 Aug 2025</Text>
        <Ionicons name="chevron-forward-outline" size={20} color="#000" />
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>TOTAL GENERATED</Text>
          <Text style={styles.summaryValue}>13.3 Units</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.summaryLabel}>MONEY SAVED</Text>
          <Text style={styles.summaryValue}>₹133</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={{ marginTop: 25, alignItems: "center" }}>
       {AreaChart ? (
  <AreaChart
    data={data}
    height={180}
    width={screenWidth}
    showVerticalLines
    startFillColor="#EF4444"
    endFillColor="#FECACA"
    startOpacity={1}
    endOpacity={0.2}
    color="#EF4444"
    thickness={3}
    noOfSections={6}
    yAxisTextStyle={{ color: "#777", fontSize: 11 }}
    xAxisLabelTextStyle={{ color: "#777", fontSize: 11 }}
    hideRules
    curved
    initialSpacing={25}         // ✅ Add left padding so 1st label visible
    spacing={40}  
    endSpacing={20}               // ✅ Keep even spacing
    xAxisLabelShift={10}        // ✅ Adjust label alignment under point
    yAxisLabelWidth={40}        // ✅ Prevent overlap of Y labels
  />
) : (
  <LineChart
    data={data}
    height={180}
    width={screenWidth}
    areaChart
    startFillColor="#EF4444"
    endFillColor="#FECACA"
    startOpacity={1}
    endOpacity={0.2}
    color="#EF4444"
    thickness={3}
    noOfSections={6}
    yAxisTextStyle={{ color: "#777", fontSize: 11 }}
    xAxisLabelTextStyle={{ color: "#777", fontSize: 11 }}
    hideRules
    curved
    initialSpacing={25}         // ✅ Same fix for LineChart
    spacing={40}
    xAxisLabelShift={10}
    yAxisLabelWidth={40}
  />
)}


        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>Recorded</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FECACA" }]} />
            <Text style={styles.legendText}>Unrecorded</Text>
          </View>
        </View>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Ionicons name="sunny-outline" size={18} color="#E60000" />
        <Text style={styles.infoText}>
          Your Solar home generated{" "}
          <Text style={{ fontWeight: "bold" }}>80%</Text> of the potential energy
          for today
        </Text>
      </View>
<TouchableOpacity onPress={() => navigation.navigate("KondaaAboutScreen")} > <Text style={styles.footerLink}> Know more about <Text style={{ fontWeight: "700" }}>Kondaas Assured™ →</Text> </Text> </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 10 },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginTop: 15,
    padding: 4,
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 6 },
  tabButtonActive: { backgroundColor: "#E60000" },
  tabText: { fontSize: 14, color: "#555" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  dateText: { fontSize: 14, fontWeight: "500", color: "#333" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  summaryLabel: { fontSize: 12, color: "#777" },
  summaryValue: { fontSize: 18, fontWeight: "600", color: "#000" },
  legendRow: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 },
  legendText: { fontSize: 12, color: "#555" },
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

export default PowerGeneration;

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


const PowerGeneration = ({ navigation }) => {
  const [selectedTab, setSelectedTab] = useState("Day");

  // Chart data
  const chartData = {
    Day: [0, 2, 4, 6, 3, 1],
    Week: [3, 5, 2, 4, 6, 7, 5],
    Month: [10, 14, 12, 15, 18, 20, 17],
    Year: [100, 130, 140, 120, 160, 180, 150],
  };

  const data = chartData[selectedTab];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Ionicons
          name="arrow-back"
          size={20}
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
            style={[
              styles.tabButton,
              selectedTab === tab && styles.tabButtonActive,
            ]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab && styles.tabTextActive,
              ]}
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
      <View style={{ marginTop: 20 }}>
        {/* <LineChart
          data={{
            labels: ["8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm"],
            datasets: [
              {
                data: data,
                color: () => "#EF4444",
                strokeWidth: 2,
              },
            ],
          }}
          width={Dimensions.get("window").width - 40}
          height={180}
          yAxisLabel=""
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: {
              r: "3",
              strokeWidth: "2",
              stroke: "#fff",
            },
          }}
          bezier
          style={{
            borderRadius: 10,
          }}
        /> */}

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
          <Text style={{ fontWeight: "bold" }}>80%</Text> of the potential
          energy for today
        </Text>
      </View>

      {/* Footer Link */}
      <TouchableOpacity
        onPress={() => navigation.navigate("PowerGenerationScreen")}
      >
        <Text style={styles.footerLink}>
          Know more about{" "}
          <Text style={{ fontWeight: "700" }}>Kondaas Assured™ →</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginTop: 15,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: "#E60000",
  },
  tabText: {
    fontSize: 14,
    color: "#555",
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#777",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#555",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 10,
    padding: 10,
    marginTop: 20,
  },
  infoText: {
    fontSize: 13,
    color: "#333",
    marginLeft: 6,
    flex: 1,
  },
  footerLink: {
    color: "#E60000",
    textAlign: "left",
    marginTop: 10,
    fontSize: 13,
  },
});

export default PowerGeneration;

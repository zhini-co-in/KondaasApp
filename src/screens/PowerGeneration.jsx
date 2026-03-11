import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart,LineChart  } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { setAuthToken, fetchHistoricalData } from "../api/api";
import NetInfo from '@react-native-community/netinfo';
import MonthlyDataManager from "../utils/MonthlyDataManager";
import { getStationId } from "../utils/stationId";
import { USER_DATA, getStorageData } from "../service/localStorage";
import firestore from "@react-native-firebase/firestore";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from '../constants/screenNames';
const screenWidth = Dimensions.get("window").width;

const PowerGenerationScreen = ({ navigation, route }) => {
  const { stationId } = route.params || {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalInstalledCapacity, setTotalInstalledCapacity] = useState(0);
  const [potentialUnits, setPotentialUnits] = useState(0);
  const [statusColor, setStatusColor] = useState("#FF9800"); // default orange
  const [selectedTab, setSelectedTab] = useState("Day");
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [weekStart, setWeekStart] = useState("");
const [globalStationId, setGlobalStationId] = useState(null); 
  const [weekEnd, setWeekEnd] = useState("");
  const [userData, setUserData] = useState(null);
  const [committedUnits, setCommittedUnits] = useState(0);
  const [percentGenerated, setPercentGenerated] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSaved, setTotalSaved] = useState(0);
  const rate = Number(userData?.unitsrupees || 0);  
  const calculateCommittedUnits = (installedCapacity, selectedTab, currentDate) => {
  const capacityInKW = installedCapacity > 100 ? installedCapacity / 1000 : installedCapacity;
  const noOfDays = getNumberOfDaysInPeriod(selectedTab, currentDate);
  const dailyKwhPerKw = 4; // South India average — can change later if needed
  return Number((capacityInKW * dailyKwhPerKw * noOfDays).toFixed(1));
};

const getNumberOfDaysInPeriod = (tab, currentDate) => {
  // today is now available from outer scope
  // today.setHours(0,0,0,0);   ← if you didn't do it above, do it here once

  const selected = new Date(currentDate);
  selected.setHours(0, 0, 0, 0);

  if (tab === "Day") return 1;

  if (tab === "Week") {
    const dayOfWeek = selected.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - diffToMonday);

    const endOfWeek = new Date(monday);
    endOfWeek.setDate(monday.getDate() + 6);

    if (endOfWeek > today) {
      return Math.floor((today - monday) / 86400000) + 1;
    }
    return 7;
  }


  if (tab === "Month") {
    const y = selected.getFullYear();
    const m = selected.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();

    if (y === today.getFullYear() && m === today.getMonth()) {
      return today.getDate();
    }
    return lastDay;
  }

  if (tab === "Year") {
    const y = selected.getFullYear();
    if (y === today.getFullYear()) {
      const start = new Date(y, 0, 1);
      return Math.floor((today - start) / 86400000) + 1;
    }
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return isLeap ? 366 : 365;
  }

  return 0;
};
useEffect(() => {
  const loadInstalledCapacity = async () => {
    try {
      await setAuthToken();
      const totalCapacity = 18.8; 

      setTotalInstalledCapacity(totalCapacity);
      console.log(`Station ID: ${stationId} → Installed Capacity: ${totalCapacity}`);

    } catch (err) {
      console.warn("Capacity load fail:", err.message);
      setTotalInstalledCapacity(18.8); // fallback
    }
  };

  if (stationId) {   
    loadInstalledCapacity();
  }
}, [stationId]);   
  

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (data) {
          const parsed = JSON.parse(data);
          console.log(" Loaded User Data:", parsed);
          setUserData(parsed.UserInfo || parsed);
        } else {
          console.warn(" No user data found in storage");
        }
      } catch (err) {
        console.error(" Error loading user data:", err);
      }
    };

    fetchUserData();
  }, []);


  console.log(" Units:", totalGenerated);
  console.log(" Per Unit Rate:", rate);
  console.log(" Total Saved:", totalSaved);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const formatDisplayDate = (date) => {
    return `Today, ${date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  };

  const changeDate = (direction) => {
    if (direction === 1 && isFutureDisabled()) return;

    const newDate = new Date(currentDate);

    if (selectedTab === "Day") newDate.setDate(newDate.getDate() + direction);
    else if (selectedTab === "Week") newDate.setDate(newDate.getDate() + direction * 7);
    else if (selectedTab === "Month") newDate.setMonth(newDate.getMonth() + direction);
    else if (selectedTab === "Year") newDate.setFullYear(newDate.getFullYear() + direction);

    setCurrentDate(newDate);
  };

  const isFutureDisabled = () => {
    const tempDate = new Date(currentDate);

    if (selectedTab === "Day") {
      tempDate.setDate(tempDate.getDate() + 1);
      return tempDate > today;
    }

    if (selectedTab === "Week") {
      tempDate.setDate(tempDate.getDate() + 7);
      return tempDate > today;
    }

    if (selectedTab === "Month") {
      tempDate.setMonth(tempDate.getMonth() + 1);
      return (
        tempDate.getFullYear() > today.getFullYear() ||
        (tempDate.getFullYear() === today.getFullYear() &&
          tempDate.getMonth() > today.getMonth())
      );
    }

    if (selectedTab === "Year") {
      return tempDate.getFullYear() + 1 > today.getFullYear();
    }

    return false;
  };
  const formatMonthYear = (date) => {
    return date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  };

  const formatYearOnly = (date) => {
    return date.getFullYear().toString();
  };

  const onTabChange = (tab) => {
    setSelectedTab(tab);
    setCurrentDate(new Date());
  };

  const getDateRange = (tab) => {
    let start, end;
    const baseDate = new Date(currentDate);

    if (tab === "Day") {
      start = formatDate(baseDate);
      end = formatDate(baseDate);
    }
   else if (tab === "Week") {
  const day = baseDate.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - diffToMonday);

  let sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // 🔥 IMPORTANT FIX
  if (sunday > today) {
    sunday = today;
  }

  start = formatDate(monday);
  end = formatDate(sunday);
}

    else if (tab === "Month") {
      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, "0");
      start = `${y}-${m}`;
      end = `${y}-${m}`;
    }
    else if (tab === "Year") {
      const y = baseDate.getFullYear();
      start = `${y}`;
      end = `${y}`;
    }

    return { start, end };
  };

  const loadCommittedUnits = (generated) => {
  if (totalInstalledCapacity <= 0) {
    console.warn("Installed capacity not set yet");
    setPotentialUnits(0);
    setPercentGenerated(0);
    return;
  }

  const potential = calculateCommittedUnits(
    totalInstalledCapacity,
    selectedTab,
    currentDate
  );

  setPotentialUnits(potential);

  const percent = potential > 0
    ? Number(((generated / potential) * 100).toFixed(1))
    : 0;

  setPercentGenerated(percent);

  const color = "#4CAF50";
  setStatusColor(color);
};

  const fetchGenerationData = async (tab) => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
  alert("No network connection available");
  return;
}

  setLoading(true);
  try {

    // ✅ MONTH TAB → AsyncStorage ONLY
    // ✅ MONTH + YEAR → AsyncStorage ONLY
// ================= MONTH TAB =================
// ================= MONTH TAB =================
if (tab === "Month") {
  await setAuthToken();

  const year  = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");

  const todayObj = new Date();
  const isCurrentMonth = (
    year === todayObj.getFullYear() &&
    Number(month) === todayObj.getMonth() + 1
  );

  let lastDay = new Date(year, Number(month), 0).getDate();
  if (isCurrentMonth) {
    lastDay = todayObj.getDate();           // ← up to today
  }

  const payload = {
    stationId,
    timeType: 2, // daily
    startTime: `${year}-${month}-01`,
    endTime:   `${year}-${month}-${lastDay.toString().padStart(2,"0")}`,
  };

  let apiData;
  try {
    apiData = await fetchHistoricalData(payload);
    console.log("Month API response:", apiData); // ← very important log
  } catch (err) {
    console.error("Month fetch failed:", err);
    apiData = { stationDataItems: [] };
  }

  const items = apiData?.stationDataItems || [];

  // Create map: day number → generation
  const dayMap = {};
  items.forEach(item => {
    const d = Number(item.day);
    if (d >= 1 && d <= lastDay) {
      dayMap[d] = Number(item.generationValue) || 0;
    }
  });

  // Build chart data — fill missing days with 0
  const labels = [];
  const dataPoints = [];

  for (let d = 1; d <= lastDay; d++) {
    labels.push(d.toString());
    dataPoints.push(dayMap[d] ?? 0);
  }

  const totalThisMonth = dataPoints.reduce((sum, v) => sum + v, 0);
  setTotalGenerated(Number(totalThisMonth.toFixed(1)));

  // ── Money saved ──
  let savedMoney = 0;
  const localData = await MonthlyDataManager.getAll(stationId);
  const monthKey = `${year}-${month}`;
  const stored = localData?.monthlyRecords?.[monthKey];

  if (stored?.cost != null) {
    savedMoney = stored.cost;
  } else {
    savedMoney = totalThisMonth * Number(userData?.unitsrupees || 0);
  }
  setTotalSaved(Number(savedMoney.toFixed(0)));

  // ── Potential & percentage ──
  let potential = calculateCommittedUnits(
    totalInstalledCapacity,
    selectedTab,
    currentDate
  );

  // Optional: make today pro-rated (realistic UX)
  // if (isCurrentMonth) {
  //   const hoursSoFar = todayObj.getHours() + todayObj.getMinutes()/60;
  //   const todayFraction = hoursSoFar / 24;
  //   const lastDayPotential = (totalInstalledCapacity / 1000) * 4 * todayFraction;
  //   potential = potential - ((totalInstalledCapacity / 1000) * 4) + lastDayPotential;
  // }

  setPotentialUnits(Number(potential.toFixed(1)));

  const percent = potential > 0
    ? Number((totalThisMonth / potential * 100).toFixed(1))
    : 0;
  setPercentGenerated(percent);

  setStatusColor(totalThisMonth >= potential * 0.9 ? "#4CAF50" : "#4CAF50");

  // ── Chart ──
  const maxVal = dataPoints.length ? Math.max(...dataPoints) : 0;
  const maxIdx = dataPoints.indexOf(maxVal);

  setChartData({
    labels,
    datasets: [{
      data: dataPoints,
      colors: dataPoints.map((_, i) => () =>
        i === maxIdx ? "#1F4FFF" : "#B8C7FF"
      ),
    }],
  });

  setLoading(false);
  return; // ← prevent falling into day/week code
}


// ================= YEAR TAB =================
if (tab === "Year") {
  const localData = await MonthlyDataManager.getAll(stationId);
  const records = localData?.monthlyRecords || {};

  const selectedYear = currentDate.getFullYear();
  const labels = [];
  const dataPoints = [];

  let totalUnits = 0;
  let totalCost = 0;

  Object.keys(records)
  .filter(key => key.startsWith(selectedYear.toString()))
  .sort((a, b) => new Date(a + "-01") - new Date(b + "-01"))
  .forEach(key => {
    const rec = records[key] || {};
    const units = rec.units || 0;
    const saved = rec.cost || 0; // ✅ use cost, not saved

    labels.push(new Date(key + "-01").toLocaleString("en", { month: "short" }));
    dataPoints.push(units);

    totalUnits += units;
    totalCost += saved; // ✅ now it accumulates correctly
  });

  setTotalGenerated(Number(totalUnits.toFixed(1)));
  setTotalSaved(Number(totalCost.toFixed(0)));

  await loadCommittedUnits(totalUnits);

  const maxValue = Math.max(...dataPoints);
const maxIndex = dataPoints.indexOf(maxValue);

setChartData({
  labels,
  datasets: [
    {
      data: dataPoints,
      colors: dataPoints.map((v, i) => () =>
        i === maxIndex ? "#1F4FFF" : "#B8C7FF"
      ),
    },
  ],
})

  setLoading(false);
  return;
}


    // ================= API FLOW FOR DAY / WEEK / YEAR ==================
    await setAuthToken();

    const { start, end } = getDateRange(tab);
    setWeekStart(start);
    setWeekEnd(end);

    const timeType =
      tab === "Day" ? 1 :
      tab === "Week" ? 2 :
      tab === "Year" ? 4 : null;

    const payload = {
      stationId,
      timeType,
      startTime: start,
      endTime: end,
    };

    const data = await fetchHistoricalData(payload);
    const items = data.stationDataItems || [];

    const labels = [];
    const dataPoints = [];

    if (tab === "Day") {

  // 🔹 1️⃣ Get hourly graph data
  const hourlyPayload = {
    stationId,
    timeType: 1,  // hourly
    startTime: start,
    endTime: end,
  };

  const hourlyData = await fetchHistoricalData(hourlyPayload);
  const hourlyItems = hourlyData.stationDataItems || [];

  const hourMap = {};
  const labels = [];
  const dataPoints = [];

  const INTERVAL_MINUTES = 5; // 🔥 change if API interval different

hourlyItems.forEach((item) => {
  if (item.dateTime && item.generationPower != null) {

    const date = new Date(item.dateTime * 1000);
    const hour = date.getHours();

    if (!hourMap[hour]) {
      hourMap[hour] = 0;
    }

    // 🔥 Convert W → kWh
    const units =
      (Number(item.generationPower) * INTERVAL_MINUTES) / (60 * 1000);

    hourMap[hour] += units;
  }
});

  for (let i = 0; i < 24; i++) {

  // Convert to 12 hour format
  const hour12 = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? "AM" : "PM";

  // Make 2 digit format (01, 02, 03...)
  const hourLabel = hour12.toString().padStart(2, "0");

  // Show label every 2 hours
  if (i % 2 === 0) {
    labels.push(`${hourLabel} ${ampm}`);
  } else {
    labels.push("");
  }

  dataPoints.push(hourMap[i] || 0);
}

  // 🔹 2️⃣ Get total generated (daily total)
  const totalPayload = {
    stationId,
    timeType: 2,  // daily total
    startTime: start,
    endTime: end,
  };

  const totalData = await fetchHistoricalData(totalPayload);
  const totalItems = totalData.stationDataItems || [];

  let totalUnits = 0;

  totalItems.forEach((item) => {
    totalUnits += Number(item.generationValue) || 0;
  });

  setTotalGenerated(Number(totalUnits.toFixed(1)));
  setTotalSaved(Number((totalUnits * rate).toFixed(0)));

  setChartData({
    labels,
    datasets: [{ data: dataPoints }],
  });

  return;
} else {

  items.forEach((item, index) => {
    labels.push(item.day || index + 1);
    dataPoints.push(Number(item.generationValue) || 0);
  });

  const total = dataPoints.reduce((a, b) => a + b, 0);

  setTotalGenerated(Number(total.toFixed(1)));
  setTotalSaved(Number((total * rate).toFixed(0)));
}

const loadPotentialAndPercent = (generatedUnits) => {
  if (totalInstalledCapacity <= 0) {
    console.warn("Installed capacity not loaded yet");
    setPotentialUnits(0);
    setPercentGenerated(0);
    setStatusColor("#FF9800");
    return;
  }

  const potential = calculateCommittedUnits(
    totalInstalledCapacity,
    selectedTab,
    currentDate
  );

  setPotentialUnits(potential);
  setCommittedUnits(potential);

  const percent = potential > 0
    ? Number(((generatedUnits / potential) * 100).toFixed(1))
    : 0;

  setPercentGenerated(percent);

  const color = "#4CAF50";
  setStatusColor(color);
};

    const maxValue = dataPoints.length ? Math.max(...dataPoints) : 0;
const maxIndex = dataPoints.length ? dataPoints.indexOf(maxValue) : -1;

setChartData({
  labels,
  datasets: [
    {
      data: dataPoints,
      colors: dataPoints.map((v, i) => () =>
        i === maxIndex ? "#1F4FFF" : "#B8C7FF"
      ),
    },
  ],
});

  } catch (err) {
    console.log("Error:", err);
  } finally {
    setLoading(false);
  }
};
useEffect(() => {
  const loadStation = async () => {
    const id = await getStationId();
    console.log("GLOBAL Station ID:", id);
    setGlobalStationId(id);
  };
  loadStation();
}, []);

  useEffect(() => {
    if (stationId) fetchGenerationData(selectedTab);
  }, [selectedTab, currentDate]);

  const hasValidData =
  
  chartData &&
  chartData.datasets &&
  chartData.datasets[0] &&
  chartData.datasets[0].data &&
  chartData.datasets[0].data.length > 0;
  return (
    <SafeAreaView style={styles.container}>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 0 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>More Insights</Text>
        </View>
        <View style={styles.tabContainer}>
          {["Day", "Week", "Month", "Year"].map((tab) => {
            const isActive = selectedTab === tab;

            return (
              <TouchableOpacity
                key={tab}
                style={styles.tabButton}
                onPress={() => onTabChange(tab)}
                activeOpacity={0.8}
              >

                {isActive ? (
                  <LinearGradient
                    colors={["#F00001", "#B00100"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.activeTabButton}
                  >
                    <Text style={styles.activeTabText}>{tab}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.tabText}>{tab}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => changeDate(-1)}>
            <Ionicons name="chevron-back" size={22} color="#000" />
          </TouchableOpacity>

          <Text style={styles.dateNavText}>
            {selectedTab === "Day" && formatDisplayDate(currentDate)}

            {selectedTab === "Week" && `${weekStart} - ${weekEnd}`}

            {selectedTab === "Month" && formatMonthYear(currentDate)}

            {selectedTab === "Year" && formatYearOnly(currentDate)}
          </Text>


          {!isFutureDisabled() ? (
            <TouchableOpacity onPress={() => changeDate(1)}>
              <Ionicons name="chevron-forward" size={22} color="#000" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>


        {loading && (
          <ActivityIndicator
            size="large"
            color="#ED1C25"
            style={{ marginTop: 20 }}
          />
        )}

         {!loading && hasValidData && chartData.labels.length > 0 && (
  <View style={{ alignItems: "center" }}>

    {selectedTab === "Day" ? (

      // 🔥 DAY GRAPH (CRYPTO STYLE)
      <LineChart
        data={{
          labels: chartData.labels,
          datasets: [
            {
              data: chartData.datasets[0].data,
            },
          ],
        }}
        width={screenWidth - 20}
        height={220}
        fromZero
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        withShadow={true}
        bezier
        verticalLabelRotation={270}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",

          decimalPlaces: 1,

          color: (opacity = 1) => `rgba(31,79,255,${opacity})`,
          labelColor: () => "#888",

          fillShadowGradient: "#1F4FFF",
          fillShadowGradientOpacity: 0.8,

          propsForBackgroundLines: {
            stroke: "transparent",
          },
        }}
        style={{
          borderRadius: 16,
        }}

  xLabelsOffset={12}
  segments={2}
      />

    ) : (

      // 🔹 OTHER TABS → BAR CHART (UNCHANGED)
      <BarChart
        data={chartData}
        width={
          selectedTab === "Month"
            ? screenWidth
            : Math.max(screenWidth - 1, (chartData?.labels?.length || 1) * 28)
        }
        height={selectedTab === "Year" ? 300 : 220}
        fromZero
        withInnerLines={false}
        withOuterLines={false}
        flatColor
        withCustomBarColorFromData
        verticalLabelRotation={270}    
  xLabelsOffset={-3}      
  yLabelsOffset={10}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          barPercentage: 0.3,
          color: (opacity = 1) =>
            `rgba(184,199,255,${opacity})`,
          labelColor: () => "#444",
          propsForBackgroundLines: {
            stroke: "transparent",
          },
        }}
        style={{ borderRadius: 12 }}
      />
    )}

  </View>
)}

        {/* Summary Box */}
        <View style={styles.energyBox}>
          <Ionicons
            name="sunny"
            size={20}
            color="#ED1C25"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.energyText}>
  Your solar home generated{" "}
  <Text style={[styles.highlight, { color: statusColor }]}>
    {percentGenerated}%
  </Text>{" "}
  of the potential energy
</Text>
        </View>
        <View style={styles.summaryContainer}>
  <View style={styles.summaryItem}>
    <Text style={styles.summaryValue}>{totalGenerated} Units</Text>
    <Text style={styles.summaryLabel}>Total Generated</Text>
  </View>

  {(selectedTab === "Month" || selectedTab === "Year") && (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>₹{totalSaved}</Text>
      <Text style={styles.summaryLabel}>Money Saved</Text>
    </View>
  )}
</View>

        <TouchableOpacity
          onPress={() => navigation.navigate(SCREEN_NAMES.KONDA_ABOUT)}
        >
          <Text style={styles.footerLink}>
  Know more about{" "}
  <Text style={{ fontWeight: "900" }}>
    Kondaas Assured™{" "}
    <Text style={{ fontSize: 22, fontWeight: "900" }}>→</Text>
  </Text>
</Text>

        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
export default PowerGenerationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F6F6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 10 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
  },

  tabButton: {
    flex: 1,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  activeTabButton: {
  width: "100%",
  height: "100%",        // 🔥 important
  borderRadius: 6,
  justifyContent: "center",
  alignItems: "center",
},

  tabText: { 
  color: "#444", 
  fontSize: 14, 
  fontWeight: "500",
  lineHeight: 18
},

activeTabText: { 
  color: "#fff",
  fontSize: 14,
  fontWeight: "600",
  lineHeight: 18
},
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
  highlight: { color: "#ED1C25", fontWeight: "700" },

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
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ED1C25",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },

  dateNavText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },

  infoText: { fontSize: 13, color: "#333", marginLeft: 6, flex: 1 },
  footerLink: { color: "#ED1C25", textAlign: "left", marginTop: 10, fontSize: 15, marginLeft: 20, },
});

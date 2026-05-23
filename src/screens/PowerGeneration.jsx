// src/screens/PowerGenerationScreen.js
import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart, LineChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import NetInfo from "@react-native-community/netinfo";
import { USER_DATA, getStorageData, storeData, getSavingsKey, getHistoryKey } from "../service/localStorage";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from "../constants/screenNames";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getHistory } from "../api/api1";

const screenWidth = Dimensions.get("window").width;

const today = new Date();
today.setHours(0, 0, 0, 0);

const PowerGenerationScreen = ({ navigation, route }) => {
  const { stationId } = route.params || {};

  const [totalInstalledCapacity, setTotalInstalledCapacity] = useState(0);
  const [potentialUnits, setPotentialUnits] = useState(0);
  const [statusColor, setStatusColor] = useState("#FF9800");
  const [selectedTab, setSelectedTab] = useState("Day");
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [userData, setUserData] = useState(null);
  const [percentGenerated, setPercentGenerated] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [totalSaved, setTotalSaved] = useState(0);
  const [rate, setRate] = useState(6.5);
  const [monthlyRecords, setMonthlyRecords] = useState({});

  const calculateCommittedUnits = (installedCapacity, tab, date) => {
    const capacityInKW = installedCapacity > 100 ? installedCapacity / 1000 : installedCapacity;
    const noOfDays = getNumberOfDaysInPeriod(tab, date);
    return Number((capacityInKW * 4 * noOfDays).toFixed(1));
  };

  const getNumberOfDaysInPeriod = (tab, date) => {
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    if (tab === "Day") return 1;
    if (tab === "Week") {
      const diffToMonday = selected.getDay() === 0 ? 6 : selected.getDay() - 1;
      const monday = new Date(selected);
      monday.setDate(selected.getDate() - diffToMonday);
      const endOfWeek = new Date(monday);
      endOfWeek.setDate(monday.getDate() + 6);
      if (endOfWeek > today) return Math.floor((today - monday) / 86400000) + 1;
      return 7;
    }
    if (tab === "Month") {
      const y = selected.getFullYear(), m = selected.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      if (y === today.getFullYear() && m === today.getMonth()) return today.getDate();
      return lastDay;
    }
    if (tab === "Year") {
      const y = selected.getFullYear();
      if (y === today.getFullYear()) return Math.floor((today - new Date(y, 0, 1)) / 86400000) + 1;
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    }
    return 0;
  };

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDate = (date) =>
    `Today, ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const formatMonthYear = (date) =>
    date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const formatYearOnly = (date) => date.getFullYear().toString();

  // ─── Load installed capacity from stations cache ──────────────────────────
  useEffect(() => {
    const loadCapacity = async () => {
      try {
        const stored = await getStorageData(USER_DATA);
        const parsed = stored ? JSON.parse(stored) : null;
        const phoneNo = parsed?.UserInfo?.phoneNo;
        if (!phoneNo) return;
        const STATIONS_KEY = `stations_data_${phoneNo}`;
        const cached = await getStorageData(STATIONS_KEY);
        if (cached) {
          const stationList = JSON.parse(cached);
          const found = stationList.find(s => String(s.id) === String(stationId));
          if (found?.installedCapacity) {
            setTotalInstalledCapacity(found.installedCapacity);
          }
        }
      } catch (e) {
        console.log("Capacity load error:", e.message);
      }
    };
    if (stationId) loadCapacity();
  }, [stationId]);

  // ─── Load user data & monthly savings ────────────────────────────────────
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (!data || data === "undefined" || data === "null") return;
        let parsed;
        try { parsed = JSON.parse(data); }
        catch (parseErr) {
          console.warn("Corrupt USER_DATA, clearing:", parseErr);
          await AsyncStorage.removeItem(USER_DATA);
          return;
        }
        setUserData(parsed.UserInfo || parsed);
        const phoneNo = parsed?.UserInfo?.phoneNo || parsed?.phoneNo;
        if (phoneNo) {
          const SAVINGS_KEY = getSavingsKey(phoneNo) + `_${stationId}`;
          const cached = await getStorageData(SAVINGS_KEY);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            setMonthlyRecords(parsedCache.monthlyRecords || {});
          } else {
            const authToken = parsed?.authToken || parsed?.UserInfo?.authToken;
            const res = await fetch("https://board.trisentrix.com/savings/calculate-savings", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-auth-token": authToken },
              body: JSON.stringify({ phoneNo, stationId }),
            });
            const savingsData = await res.json();
            if (savingsData?.success && savingsData?.data?.monthlyRecords) {
              setMonthlyRecords(savingsData.data.monthlyRecords);
              const total = Object.values(savingsData.data.monthlyRecords)
                .reduce((sum, rec) => sum + (rec.cost || 0), 0);
              const formatted = total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              await storeData(SAVINGS_KEY, JSON.stringify({
  totalCost: formatted,
  monthlyRecords: savingsData.data.monthlyRecords,
  cumulativeUnits: savingsData.data.cumulativeUnits || 0, // ✅ add
}));
            }
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      }
    };
    fetchUserData();
  }, []);

  const isFutureDisabled = () => {
    const tempDate = new Date(currentDate);
    if (selectedTab === "Day") { tempDate.setDate(tempDate.getDate() + 1); return tempDate > today; }
    if (selectedTab === "Week") { tempDate.setDate(tempDate.getDate() + 7); return tempDate > today; }
    if (selectedTab === "Month") {
      tempDate.setMonth(tempDate.getMonth() + 1);
      return tempDate.getFullYear() > today.getFullYear() ||
        (tempDate.getFullYear() === today.getFullYear() && tempDate.getMonth() > today.getMonth());
    }
    if (selectedTab === "Year") return tempDate.getFullYear() + 1 > today.getFullYear();
    return false;
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

  const onTabChange = (tab) => { setSelectedTab(tab); setCurrentDate(new Date()); };

  const getDateRange = (tab) => {
    const baseDate = new Date(currentDate);
    if (tab === "Day") {
      const s = formatDate(baseDate);
      return { start: s, end: s };
    }
    if (tab === "Week") {
      const diffToMonday = (baseDate.getDay() + 6) % 7;
      const monday = new Date(baseDate);
      monday.setDate(baseDate.getDate() - diffToMonday);
      let sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      if (sunday > today) sunday = today;
      return { start: formatDate(monday), end: formatDate(sunday) };
    }
    if (tab === "Month") {
      const y = baseDate.getFullYear();
      const m = String(baseDate.getMonth() + 1).padStart(2, "0");
      return { start: `${y}-${m}`, end: `${y}-${m}` };
    }
    if (tab === "Year") {
      const y = baseDate.getFullYear();
      return { start: `${y}-01`, end: `${y}-12` };
    }
  };

  const fetchGenerationData = async (tab) => {
    const dateKey = tab === "Day" ? formatDate(currentDate)
      : tab === "Week" ? formatDate(currentDate)
      : tab === "Month" ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      : currentDate.getFullYear().toString();

    const HISTORY_KEY = getHistoryKey(stationId, tab, dateKey);

    // ─── Show cache first for non-Day tabs ───────────────────────────────
    if (tab !== "Day") {
      const cached = await getStorageData(HISTORY_KEY);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        const cachedChart = parsedCache.chartData;
        if (cachedChart?.datasets?.[0]?.data) {
          const data = cachedChart.datasets[0].data;
          const maxVal = Math.max(...data);
          const maxIdx = data.indexOf(maxVal);
          cachedChart.datasets[0].colors = data.map((_, i) => () => i === maxIdx ? "#1F4FFF" : "#B8C7FF");
        }
        setChartData(cachedChart);
        setTotalGenerated(parsedCache.totalGenerated);
        setTotalSaved(parsedCache.totalSaved);
        setPotentialUnits(parsedCache.potentialUnits || 0);
        setPercentGenerated(parsedCache.percentGenerated || 0);
      }
    }

    const net = await NetInfo.fetch();
const isOffline = net.isConnected === false || net.isInternetReachable === false;
if (isOffline) return;
    if (!net.isConnected) return;

    setLoading(true);

    try {

      // ════════════════════════════════════════════════
      // DAY TAB — Live data, no cache
      // api1.js getHistory() returns { stationDataItems: [...] }
      // timeType:1 = Day → backend always fetches fresh from Solarman
      // ════════════════════════════════════════════════
      if (tab === "Day") {
        const { start, end } = getDateRange(tab);
        setWeekStart(start);
        setWeekEnd(end);

        const response = await getHistory({
          stationId,
          timeType: 1,
          startTime: start,
          endTime: end,
        });

        // getHistory() always wraps result as { stationDataItems: [...] }
        const items = response?.stationDataItems || [];

        console.log("📊 DAY items count:", items.length);
        if (items.length > 0) console.log("📊 DAY sample:", JSON.stringify(items[0]));

        // Build 24-hour chart from 5-min Watt readings
        const INTERVAL_MINUTES = 5;
        const hourMap = {};
        let totalKwh = 0;

        items.forEach(item => {
          if (item.dateTime != null && item.generationPower != null) {
            const hour = new Date(item.dateTime * 1000).getHours();
            if (!hourMap[hour]) hourMap[hour] = 0;
            // Solarman returns generationPower in Watts
            // kWh = (Watts × 5min) / (60 min/hr × 1000 W/kW)
            const kwh = (Number(item.generationPower) * INTERVAL_MINUTES) / (60 * 1000);
            hourMap[hour] += kwh;
            totalKwh += kwh;
          }
        });

        const labels = [], dataPoints = [];
        for (let i = 0; i < 24; i++) {
          const hour12 = i % 12 === 0 ? 12 : i % 12;
          const ampm = i < 12 ? "AM" : "PM";
          labels.push(i % 2 === 0 ? `${hour12.toString().padStart(2, "0")} ${ampm}` : "");
          dataPoints.push(hourMap[i] || 0);
        }

        const val = parseFloat(totalKwh.toFixed(1));
        const saved = Number((totalKwh * rate).toFixed(0));

        setTotalGenerated(val);
        setTotalSaved(saved);

        const potential = calculateCommittedUnits(totalInstalledCapacity, tab, currentDate);
        setPotentialUnits(Number(potential.toFixed(1)));
        const percent = potential > 0 ? Number((totalKwh / potential * 100).toFixed(1)) : 0;
        setPercentGenerated(percent);
        setStatusColor("#4CAF50");

        setChartData({ labels, datasets: [{ data: dataPoints }] });
        return;
      }

      // ════════════════════════════════════════════════
      // WEEK TAB
      // ════════════════════════════════════════════════
      if (tab === "Week") {
        const { start, end } = getDateRange(tab);
        setWeekStart(start);
        setWeekEnd(end);

        const response = await getHistory({ stationId, timeType: 2, startTime: start, endTime: end });
        const items = response?.stationDataItems || [];

        const labels = [], dataPoints = [];
        items.forEach((item, index) => {
          labels.push(item.day || String(index + 1));
          dataPoints.push(Number(item.generationValue) || 0);
        });

        const total = dataPoints.reduce((a, b) => a + b, 0);
        const saved = Number((total * rate).toFixed(0));
        setTotalGenerated(Number(total.toFixed(1)));
        setTotalSaved(saved);

        const potential = calculateCommittedUnits(totalInstalledCapacity, tab, currentDate);
        const percent = potential > 0 ? Number(((total / potential) * 100).toFixed(1)) : 0;
        setPotentialUnits(potential);
        setPercentGenerated(percent);
        setStatusColor("#4CAF50");

        const maxValue = dataPoints.length ? Math.max(...dataPoints) : 0;
        const maxIndex = dataPoints.indexOf(maxValue);
        const newChartData = {
          labels,
          datasets: [{ data: dataPoints, colors: dataPoints.map((_, i) => () => i === maxIndex ? "#1F4FFF" : "#B8C7FF") }],
        };
        setChartData(newChartData);

        await storeData(HISTORY_KEY, JSON.stringify({
          chartData: newChartData,
          totalGenerated: Number(total.toFixed(1)),
          totalSaved: saved,
          potentialUnits: potential,
          percentGenerated: percent,
        }));
        return;
      }

      // ════════════════════════════════════════════════
      // MONTH TAB
      // ════════════════════════════════════════════════
      if (tab === "Month") {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const isCurrentMonth = year === new Date().getFullYear() && Number(month) === new Date().getMonth() + 1;
        let lastDay = new Date(year, Number(month), 0).getDate();
        if (isCurrentMonth) lastDay = new Date().getDate();

        const response = await getHistory({
          stationId, timeType: 2,
          startTime: `${year}-${month}-01`,
          endTime: `${year}-${month}-${lastDay.toString().padStart(2, "0")}`,
        });
        const items = response?.stationDataItems || [];

        const dayMap = {};
        items.forEach(item => {
          const d = Number(item.day);
          if (d >= 1 && d <= lastDay) dayMap[d] = Number(item.generationValue) || 0;
        });

        const labels = [], dataPoints = [];
        for (let d = 1; d <= lastDay; d++) {
          labels.push(d.toString());
          dataPoints.push(dayMap[d] ?? 0);
        }

        const totalThisMonth = dataPoints.reduce((sum, v) => sum + v, 0);
        setTotalGenerated(Number(totalThisMonth.toFixed(1)));

        const monthKey = `${year}-${month}`;
        const monthlyCost = monthlyRecords[monthKey]?.cost || Number((totalThisMonth * rate).toFixed(0));
        setTotalSaved(monthlyCost);

        const potential = calculateCommittedUnits(totalInstalledCapacity, tab, currentDate);
        setPotentialUnits(Number(potential.toFixed(1)));
        const percent = potential > 0 ? Number((totalThisMonth / potential * 100).toFixed(1)) : 0;
        setPercentGenerated(percent);
        setStatusColor("#4CAF50");

        const maxVal = dataPoints.length ? Math.max(...dataPoints) : 0;
        const maxIdx = dataPoints.indexOf(maxVal);
        const newChartData = {
          labels,
          datasets: [{ data: dataPoints, colors: dataPoints.map((_, i) => () => i === maxIdx ? "#1F4FFF" : "#B8C7FF") }],
        };
        setChartData(newChartData);

        await storeData(HISTORY_KEY, JSON.stringify({
          chartData: newChartData,
          totalGenerated: Number(totalThisMonth.toFixed(1)),
          totalSaved: monthlyCost,
          potentialUnits: Number(potential.toFixed(1)),
          percentGenerated: percent,
        }));
        return;
      }

      // ════════════════════════════════════════════════
      // YEAR TAB
      // ════════════════════════════════════════════════
      if (tab === "Year") {
        const y = currentDate.getFullYear();
        const response = await getHistory({
          stationId, timeType: 3,
          startTime: `${y}-01`, endTime: `${y}-12`,
        });
        const items = response?.stationDataItems || [];

        const monthMap = {};
        items.forEach(item => {
          const m = Number(item.month);
          if (m >= 1 && m <= 12) monthMap[m] = Number(item.generationValue) || 0;
        });

        const labels = [], dataPoints = [];
        let totalUnits = 0;
        for (let m = 1; m <= 12; m++) {
          labels.push(new Date(y, m - 1, 1).toLocaleString("en", { month: "short" }));
          const val = monthMap[m] ?? 0;
          dataPoints.push(val);
          totalUnits += val;
        }

        setTotalGenerated(Number(totalUnits.toFixed(1)));

        let yearCost = 0;
        for (let m = 1; m <= 12; m++) {
          const key = `${y}-${String(m).padStart(2, "0")}`;
          yearCost += monthlyRecords[key]?.cost || (dataPoints[m - 1] * rate);
        }
        setTotalSaved(Number(yearCost.toFixed(0)));

        const potential = calculateCommittedUnits(totalInstalledCapacity, tab, currentDate);
        const percent = potential > 0 ? Number((totalUnits / potential * 100).toFixed(1)) : 0;
        setPotentialUnits(Number(potential.toFixed(1)));
        setPercentGenerated(percent);
        setStatusColor("#4CAF50");

        const maxValue = dataPoints.length ? Math.max(...dataPoints) : 0;
        const maxIndex = dataPoints.indexOf(maxValue);
        const newChartData = {
          labels,
          datasets: [{ data: dataPoints, colors: dataPoints.map((_, i) => () => i === maxIndex ? "#1F4FFF" : "#B8C7FF") }],
        };
        setChartData(newChartData);

        await storeData(HISTORY_KEY, JSON.stringify({
          chartData: newChartData,
          totalGenerated: Number(totalUnits.toFixed(1)),
          totalSaved: Number(yearCost.toFixed(0)),
          potentialUnits: potential,
          percentGenerated: percent,
        }));
        return;
      }

    } catch (err) {
      console.log("fetchGenerationData Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stationId) fetchGenerationData(selectedTab);
  }, [selectedTab, currentDate, monthlyRecords]);

  const hasValidData = chartData?.datasets?.[0]?.data?.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 0 }}>
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
              <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => onTabChange(tab)} activeOpacity={0.8}>
                {isActive ? (
                  <LinearGradient colors={["#F00001", "#B00100"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.activeTabButton}>
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

        {loading && <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 20 }} />}

        {!loading && hasValidData && chartData.labels.length > 0 && (
          <View style={{ alignItems: "center" }}>
            {selectedTab === "Day" ? (
              <LineChart
                data={{ labels: chartData.labels, datasets: [{ data: chartData.datasets[0].data }] }}
                width={screenWidth - 20} height={220} fromZero withDots={false}
                withInnerLines={false} withOuterLines={false} withShadow bezier
                verticalLabelRotation={270}
                chartConfig={{
                  backgroundColor: "#fff", backgroundGradientFrom: "#fff", backgroundGradientTo: "#fff",
                  decimalPlaces: 1, color: (opacity = 1) => `rgba(31,79,255,${opacity})`,
                  labelColor: () => "#888", fillShadowGradient: "#1F4FFF", fillShadowGradientOpacity: 0.8,
                  propsForBackgroundLines: { stroke: "transparent" },
                }}
                style={{ borderRadius: 16 }} xLabelsOffset={12} segments={2}
              />
            ) : (
              <BarChart
                data={chartData}
                width={selectedTab === "Month" ? screenWidth : Math.max(screenWidth - 1, (chartData?.labels?.length || 1) * 28)}
                height={selectedTab === "Year" ? 300 : 220}
                fromZero withInnerLines={false} withOuterLines={false}
                flatColor withCustomBarColorFromData verticalLabelRotation={270}
                xLabelsOffset={-3} yLabelsOffset={10}
                chartConfig={{
                  backgroundColor: "#fff", backgroundGradientFrom: "#fff", backgroundGradientTo: "#fff",
                  decimalPlaces: 0, barPercentage: 0.3,
                  color: (opacity = 1) => `rgba(184,199,255,${opacity})`,
                  labelColor: () => "#444", propsForBackgroundLines: { stroke: "transparent" },
                }}
                style={{ borderRadius: 12 }}
              />
            )}
          </View>
        )}

        <View style={styles.energyBox}>
          <Ionicons name="sunny" size={20} color="#ED1C25" style={{ marginRight: 8 }} />
          <Text style={styles.energyText}>
            Your solar home generated{" "}
            <Text style={[styles.highlight, { color: statusColor }]}>{percentGenerated}%</Text>
            {" "}of the potential energy
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

        <TouchableOpacity onPress={() => navigation.navigate(SCREEN_NAMES.KONDA_ABOUT)}>
          <Text style={styles.footerLink}>
            Know more about <Text style={{ fontWeight: "900" }}>Kondaas Assured™ <Text style={{ fontSize: 22, fontWeight: "900" }}>→</Text></Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PowerGenerationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6F6F6" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  headerTitle: { fontSize: 18, fontWeight: "600", marginLeft: 10 },
  tabContainer: { flexDirection: "row", backgroundColor: "#f2f2f2", borderRadius: 10, padding: 4, marginHorizontal: 16 },
  tabButton: { flex: 1, height: 38, justifyContent: "center", alignItems: "center" },
  activeTabButton: { width: "100%", height: "100%", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  tabText: { color: "#444", fontSize: 14, fontWeight: "500", lineHeight: 18 },
  activeTabText: { color: "#fff", fontSize: 14, fontWeight: "600", lineHeight: 18 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#ED1C25", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginTop: 12 },
  dateNavText: { fontSize: 14, fontWeight: "600", color: "#000" },
  energyBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF5F5", marginHorizontal: 20, marginTop: 10, borderRadius: 10, padding: 10, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3 },
  energyText: { flex: 1, fontSize: 14, color: "#333" },
  highlight: { color: "#ED1C25", fontWeight: "700" },
  summaryContainer: { flexDirection: "row", justifyContent: "space-between", marginHorizontal: 30, marginTop: 15 },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#000" },
  summaryLabel: { fontSize: 13, color: "#666", marginTop: 4 },
  footerLink: { color: "#ED1C25", textAlign: "left", marginTop: 10, fontSize: 15, marginLeft: 20 },
});
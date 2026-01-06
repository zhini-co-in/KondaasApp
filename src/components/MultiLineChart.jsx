import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");

const SmoothLineChart = ({
  datasets = [],
  labels = [],
  yAxisUnit = "Units",
}) => {
  const chartHeight = 160;
  const chartWidth = width - 90;

  const allValues = datasets.flatMap(d => d.values);
  const maxValue = Math.max(...allValues, 1);

  const getX = i =>
    (i / (labels.length - 1)) * chartWidth;

  const getY = v =>
    chartHeight - (v / maxValue) * chartHeight;

  // 👉 Create smooth Bezier path
  const createPath = values => {
    if (values.length === 0) return "";

    let d = `M ${getX(0)} ${getY(values[0])}`;

    for (let i = 1; i < values.length; i++) {
      const x = getX(i);
      const y = getY(values[i]);
      const prevX = getX(i - 1);
      const prevY = getY(values[i - 1]);

      const cx = (prevX + x) / 2;

      d += ` C ${cx} ${prevY}, ${cx} ${y}, ${x} ${y}`;
    }
    return d;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Y AXIS */}
        <View style={styles.yAxis}>
          <View style={styles.yLabels}>
            {[...Array(5)].map((_, i) => (
              <Text key={i} style={styles.yLabel}>
                {Math.round((maxValue / 4) * (4 - i))}
              </Text>
            ))}
          </View>

          {/* Units */}
          <View style={styles.yAxisUnit}>
            <Text style={styles.unit}>{yAxisUnit}</Text>
          </View>
        </View>


        {/* CHART */}
        <Svg width={chartWidth} height={chartHeight}>
          {datasets.map((ds, i) => (
            <Path
              key={i}
              d={createPath(ds.values)}
              stroke={ds.color}
              strokeWidth={3}
              fill="none"
            />
          ))}
        </Svg>
      </View>

      {/* X AXIS */}
      <View style={styles.xAxis}>
        {labels.map((l, i) => (
          <Text key={i} style={styles.xLabel}>
            {l}
          </Text>
        ))}
      </View>
      <Text style={styles.xAxisTitle}>Date</Text>

      {/* LEGEND */}
      <View style={styles.legend}>
        {datasets.map((ds, i) => (
          <View key={i} style={styles.legendItem}>
            <View
              style={[styles.legendLine, { backgroundColor: ds.color }]}
            />
            <Text style={styles.legendText}>{ds.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default SmoothLineChart;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
  },
  row: {
    flexDirection: "row",
  },
  yAxis: {
    width: 40,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  yLabels: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 6,
  },
  yAxisUnit: {
    position: "absolute",
    left: -18,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  yLabel: {
    fontSize: 10,
    color: "#666",
  },
  unit: {
    fontSize: 11,
    color: "#999",
    fontWeight: "bold",
    transform: [{ rotate: "-90deg" }],
    textAlign: "center",
  },
  xAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginLeft: 40,
    marginTop: 6,
  },
  xLabel: {
    fontSize: 10,
    color: "#666",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
  },
  legendLine: {
    width: 18,
    height: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: "#444",
  },
  xAxisTitle: {
    textAlign: "center",
    fontSize: 11,
    color: "#999",
    marginTop: 4,
    fontWeight: "bold",
  },
});

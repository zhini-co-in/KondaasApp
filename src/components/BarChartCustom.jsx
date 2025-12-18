import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
} from "react-native";

const { width } = Dimensions.get("window");

const BarChartCustom = ({
  labels = [],
  values = [],
  height = 220,
  barColor = "#3b6fb5",
}) => {
  const maxVal = Math.max(...values, 0);
  const horizontalLines = 5;
  const paddingLeft = 34;
  const chartWidth = width - 40;
  const usableWidth = chartWidth - paddingLeft - 20;
  const barSpacing = 10;
  const barCount = values.length || 1;
  const barWidth = Math.max(
    10,
    (usableWidth - barSpacing * (barCount - 1)) / barCount
  );

  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Animated values
  const animatedBars = useRef(values.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = animatedBars.map((anim, i) =>
      Animated.timing(anim, {
        toValue: values[i],
        duration: 900,
        delay: i * 120, // video-style stagger
        useNativeDriver: false,
      })
    );

    Animated.stagger(80, animations).start();
  }, [values]);

  const formatNumber = (n) => {
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toFixed(0);
  };

  return (
    <View style={[styles.container, { height: height + 70 }]}>
      <View style={styles.chartRow}>
        {/* LEFT AXIS */}
        <View style={{ width: paddingLeft, alignItems: "flex-end" }}>
          {Array.from({ length: horizontalLines + 1 }).map((_, i) => {
            const v =
              ((horizontalLines - i) / horizontalLines) * (maxVal || 1);
            return (
              <Text key={i} style={styles.axisLabel}>
                {formatNumber(v)}
              </Text>
            );
          })}
        </View>

        {/* CHART AREA */}
        <View style={{ flex: 1 }}>
          <View style={[styles.gridContainer, { height }]}>
            {/* GRID LINES */}
            {Array.from({ length: horizontalLines + 1 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  { top: (i / horizontalLines) * height },
                ]}
              />
            ))}

            {/* BARS */}
            <View style={styles.barsRow}>
              {values.map((val, idx) => {
                const isHighlight = idx === values.length - 1;

                const animatedHeight = animatedBars[idx].interpolate({
                  inputRange: [0, maxVal || 1],
                  outputRange: [2, height - 10],
                  extrapolate: "clamp",
                });

                return (
                  <Pressable
                    key={idx}
                    onPress={() =>
                      setSelectedIndex(selectedIndex === idx ? -1 : idx)
                    }
                    style={{
                      width: barWidth,
                      marginRight: barSpacing,
                      alignItems: "center",
                    }}
                  >
                    <View style={{ height, justifyContent: "flex-end" }}>
                      {/* Highlight background */}
                      {isHighlight && (
                        <View style={[styles.highlight, { height }]} />
                      )}

                      {/* Tooltip */}
                      {selectedIndex === idx && (
                        <View style={styles.tooltip}>
                          <Text style={styles.tooltipText}>
                            ₹ {val.toFixed(0)}
                          </Text>
                        </View>
                      )}

                      {/* Animated Bar */}
                      <Animated.View
                        style={[
                          styles.bar,
                          {
                            height: animatedHeight,
                            backgroundColor: barColor,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.xLabel}>
                      {labels[idx] || idx + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* UNIT */}
        <View style={{ width: 28, paddingLeft: 4 }}>
          <Text style={styles.axisUnit}>INR</Text>
        </View>
      </View>
    </View>
  );
};

export default BarChartCustom;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    elevation: 3,
  },
  chartRow: {
    flexDirection: "row",
  },
  axisLabel: {
    fontSize: 10,
    color: "#777",
    height: 44,
  },
  axisUnit: {
    fontSize: 10,
    color: "#777",
  },
  gridContainer: {
    position: "relative",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#eee",
  },
  barsRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 6,
  },
  bar: {
    width: "100%",
    borderRadius: 6,
  },
  highlight: {
    position: "absolute",
    left: -6,
    right: -6,
    backgroundColor: "#d9eeff",
    borderRadius: 6,
    opacity: 0.9,
  },
  tooltip: {
    position: "absolute",
    bottom: 40,
    alignItems: "center",
    width: "100%",
    zIndex: 10,
  },
  tooltipText: {
    backgroundColor: "#222",
    color: "#fff",
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  xLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#444",
    textAlign: "center",
  },
});

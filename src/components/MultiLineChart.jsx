import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

const MultiLineChart = ({ datasets = [], labels = [] }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
        }).start();
    }, []);

    const allValues = datasets.flatMap((ds) => ds.values);
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);

    const chartHeight = 140;
    const chartWidth = width - 60;

    const getPoints = (values) =>
        values.map((value, index) => {
            const x = (index / (values.length - 1)) * chartWidth;
            const y =
                chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight;
            return { x, y, value };
        });

    return (
        <View style={styles.chartWrapper}>
            <View style={[styles.chart, { height: chartHeight, width: chartWidth }]}>
                {datasets.map((ds, dsIndex) => {
                    const points = getPoints(ds.values);

                    return (
                        <React.Fragment key={`ds-${dsIndex}`}>
                            {points.map((point, index) => {
                                if (index === 0) return null;
                                const prev = points[index - 1];
                                const dx = point.x - prev.x;
                                const dy = point.y - prev.y;
                                const length = Math.sqrt(dx * dx + dy * dy);
                                const angle = Math.atan2(dy, dx);

                                return (
                                    <Animated.View
                                        key={`line-${dsIndex}-${index}`}
                                        style={{
                                            position: "absolute",
                                            left: prev.x,
                                            top: prev.y,
                                            width: animatedValue.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, length],
                                            }),
                                            height: 2,
                                            backgroundColor: ds.color,
                                            transform: [{ rotateZ: `${angle}rad` }],
                                            transformOrigin: "left center",
                                        }}
                                    />
                                );
                            })}

                            {points.map((point, index) => (
                                <React.Fragment key={`point-${dsIndex}-${index}`}>
                                    <Text
                                        style={{
                                            position: "absolute",
                                            left: point.x - 12,
                                            top: point.y - 22,
                                            fontSize: 10,
                                            fontWeight: "200",
                                            color: "#111",
                                        }}
                                    >
                                        {point.value}
                                    </Text>
                                    <View
                                        style={[
                                            styles.dot,
                                            {
                                                left: point.x - 4,
                                                top: point.y - 4,
                                                backgroundColor: ds.color,
                                            },
                                        ]}
                                    />
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    );
                })}
            </View>

            <View style={styles.labelRow}>
                {labels.map((lbl, i) => (
                    <Text key={i} style={styles.label}>
                        {lbl}
                    </Text>
                ))}
            </View>

            <View style={styles.legendRow}>
                {datasets.map((ds, i) => (
                    <View key={i} style={styles.legendItem}>
                        <View
                            style={[styles.legendDot, { backgroundColor: ds.color }]}
                        />
                        <Text style={styles.legendLabel}>{ds.label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    chartWrapper: {
        marginTop: 15,
        padding: 12,
        backgroundColor: "#fff",
        borderRadius: 10,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 3 },
    },
    chartTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111",
        marginBottom: 10,
    },
    chart: {
        alignSelf: "center",
        backgroundColor: "#F9FAFB",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#eee",
    },
    dot: {
        position: "absolute",
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: "#fff",
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        paddingHorizontal: 4,
    },
    label: {
        fontSize: 11,
        color: "#555",
    },
    legendRow: {
        flexDirection: "row",
        marginTop: 10,
        justifyContent: "center",
        flexWrap: "wrap",
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 8,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 4,
    },
    legendLabel: {
        fontSize: 11,
        color: "#444",
    },
});

export default MultiLineChart;

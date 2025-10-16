import React from "react";
import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MultiLineChart from "../components/MultiLineChart";

const KondaasAssuredScreen = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#fff" barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back-outline" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kondaas Assured</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* Subtitle */}
                <Text style={styles.subtitle}>Showing for generation until Aug 2025</Text>

                {/* Units Section */}
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


                {/* Chart Section */}
                <View style={styles.chartContainer}>
                    <MultiLineChart
                        datasets={[
                            // Generated (rising curve, ends ~1.9k)
                            { label: "Generated", values: [140, 700, 1400, 1800, 1950], color: "#EF4444" },

                            // Committed (slightly lower curve, ends ~1.7k)
                            { label: "Committed", values: [140, 700, 1200, 1800, 1700], color: "#FECACA" },
                        ]}
                        labels={["Jan'25", "Apr'25", "Jul'25", "Aug'25", "Sep'25"]}
                    />

                </View>

                {/* Info Card - Green */}
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

                {/* Info Card - Red */}
                <View style={[styles.infoCard, { backgroundColor: "#FFF4F4" }]}>
                    <View style={styles.iconCircleRed}>
                        <Ionicons name="wallet-outline" size={18} color="#E60000" />
                    </View>
                    <Text style={styles.infoText}>
                        Your Solar home has saved{" "}
                        <Text style={{ fontWeight: "700" }}>₹34,125</Text> until Aug 2025
                    </Text>
                </View>

                {/* Footer Link */}
                <TouchableOpacity onPress={() => navigation.navigate("PowerGenerationScreen")}>
                    <Text style={styles.footerLink}>
                        Know more about{" "}
                        <Text style={{ fontWeight: "700" }}>Kondaas Assured™ →</Text>
                    </Text>
                </TouchableOpacity>

            </ScrollView>
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

import React, { useState, useEffect } from "react";

import {
    View,
    Text,
    SafeAreaView,
    ScrollView,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
    Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import { fetchStationList } from "../api/api";
import Loader from "../components/Loader";
import { getStorageData, USER_DATA } from "../service/localStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LinearGradient from "react-native-linear-gradient";
import SolarParseUtil from '../utils/SolarParseUtil';
const ProfileScreen = ({ route, navigation }) => {
    const { stationId } = route.params || {};
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState(null);
    const [stationData, setStationData] = useState(null);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const data = await getStorageData(USER_DATA);
                if (data) {
                    const parsedData = JSON.parse(data);
                    setUserData(parsedData);
                }
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        };

        loadUserData();
    }, []);
    useEffect(() => {
        loadStations();
    }, []);

    const loadStations = async () => {
        try {
            console.log("Fetching station list...");
            setLoading(true);

            const response = await fetchStationList();
            console.log("Full Response:", JSON.stringify(response, null, 2));

            let stationArray = [];

            if (Array.isArray(response)) {
                stationArray = response;
            } else if (response && response.stationList) {
                stationArray = response.stationList;
            } else {
                console.log("No valid station list found in response");
            }
            const selected = stationArray.find((st) => st.id === stationId);

            if (selected) {
                console.log("✅ Selected Station:", selected);
                setStationData(selected); // Store in state
                await SolarParseUtil.clear();
                const parsed = SolarParseUtil.parseAndSave(selected);
            } else {
                console.log("⚠️ No station found for ID:", stationId);
            }

        } catch (error) {
            console.log("Error fetching stations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem(USER_DATA);
            await SolarParseUtil.clear();
            console.log(" USER_DATA  cleared successfully.");
            setShowLogoutPopup(false);
            navigation.reset({
                index: 0,
                routes: [{ name: "Login" }],
            });
        } catch (error) {
            console.error(" Error during logout:", error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#fff" barStyle="dark-content" />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back-outline" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>

                <View style={styles.profileCard}>
                    <View>
                        <Text style={styles.userName}>
                            {userData?.UserInfo?.name || "Guest User"}
                        </Text>
                        {/* <Text style={styles.memberSince}>Member since Aug 2023</Text> */}
                        <View style={styles.contactRow}>
                            <Ionicons name="call-outline" size={16} color="#555" />
                            <Text style={styles.contactText}>
                                {userData?.UserInfo?.phoneNo
                                    ? `+91 ${userData.UserInfo.phoneNo}`
                                    : "Not available"}
                            </Text>
                        </View>
                        <View style={styles.contactRow}>
                            <Ionicons name="mail-outline" size={16} color="#555" />
                            <Text style={styles.contactText}>
                                {userData?.UserInfo?.email || "Not available"}
                            </Text>
                        </View>
                    </View>

                    <MaterialIcons name="verified-user" size={26} color="#ED1C25" />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🌞 Solar Anniversary with Kondaas</Text>
                    <Text style={styles.labelText}>Your solar journey started on</Text>
                    <Text style={styles.highlightText}>August 15, 2023</Text>
                    <View style={styles.anniversaryRow}>
                        <View style={styles.anniversaryBox}>
                            <Text style={styles.valueText}>2</Text>
                            <Text style={styles.subText}>Years of Clean Energy</Text>
                        </View>
                        <View style={styles.anniversaryBox}>
                            <Text style={styles.valueText}>339</Text>
                            <Text style={styles.subText}>Days to Anniversary</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>⚙️ System Details</Text>

                    <View style={styles.systemGrid}>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>⚡ Capacity</Text>
                            <Text style={styles.systemValue}>
                                {stationData?.installedCapacity
                                    ? `${stationData.installedCapacity} kW`
                                    : "Not available"}
                            </Text>
                        </View>
                        <View style={styles.systemBox}>
                            <Text style={styles.systemLabel}>🟢 Type</Text>
                            <Text style={styles.systemValue}>
                                {stationData?.type || "Not available"}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.installationText}>
                        Installation Date:{" "}
                        <Text style={styles.boldText}>
                            {stationData?.startOperatingTime
                                ? new Date(stationData.startOperatingTime * 1000).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })
                                : "Not available"}
                        </Text>
                    </Text>

                    <Text style={styles.installationText}>
                        Station ID: <Text style={styles.boldText}>{stationData?.id || "Not available"}</Text>
                    </Text>

                    <Text style={styles.installationText}>
                        Address:{" "}
                        <Text style={styles.boldText}>
                            {stationData?.locationAddress || "Not available"}
                        </Text>
                    </Text>
                </View>


                {/* Environmental Impact */}
                {/* <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🌿 Environmental Impact</Text>
                    <View style={styles.envBox}>
                        <Text style={styles.envValue}>127</Text>
                        <Text style={styles.envLabel}>Trees Equivalent Planted</Text>
                        <Text style={styles.envSubText}>Based on CO₂ reduction of 2.38 Tonne</Text>
                    </View>
                    <View style={styles.envStats}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>12,400</Text>
                            <Text style={styles.statLabel}>kWh Generated</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>2,380 kg</Text>
                            <Text style={styles.statLabel}>CO₂ Saved</Text>
                        </View>
                    </View>
                </View> */}

                {/* Achievements */}
                {/* <View style={styles.card}>
                    <Text style={styles.sectionTitle}>🏅 Achievements</Text>
                    <View style={styles.achievementsRow}>
                        <View style={[styles.achievementBox, { backgroundColor: "#f9f6ff" }]}>
                            <Text style={styles.achievementText}>Solar Champion</Text>
                        </View>
                        <View style={[styles.achievementBox, { backgroundColor: "#eafff2" }]}>
                            <Text style={styles.achievementText}>Eco Warrior</Text>
                        </View>
                    </View>
                    <View style={styles.achievementsRow}>
                        <View style={[styles.achievementBox, { backgroundColor: "#fff9e6" }]}>
                            <Text style={styles.achievementText}>First Bill Paid</Text>
                        </View>
                        <View style={[styles.achievementBox, { backgroundColor: "#f1f1f1" }]}>
                            <Text style={styles.achievementText}>Locked</Text>
                        </View>
                    </View>
                </View> */}

                {/* Logout Button */}
                <TouchableOpacity
                    onPress={() => setShowLogoutPopup(true)}
                >
                    <LinearGradient
                        colors={["#F00001", "#B00100"]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.logoutButton}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </LinearGradient>
                </TouchableOpacity>

            </ScrollView>
            <Modal
                transparent
                visible={showLogoutPopup}
                animationType="fade"
                onRequestClose={() => setShowLogoutPopup(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.popupBox}>
                        <Ionicons name="log-out-outline" size={45} color="#ED1C25" />
                        <Text style={styles.popupText}>Are you sure want to logout?</Text>
                        <View style={styles.popupButtons}>
                            <TouchableOpacity style={styles.yesButton} onPress={handleLogout}>
                                <Text style={styles.yesText}>Yes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.noButton}
                                onPress={() => setShowLogoutPopup(false)}
                            >
                                <Text style={styles.noText}>No</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {loading && <Loader />}
        </SafeAreaView>
    );
};

export default ProfileScreen;

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

    profileCard: {
        backgroundColor: "#fff",
        margin: 15,
        padding: 15,
        borderRadius: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 2,
    },
    userName: { fontSize: 18, fontWeight: "700", color: "#000" },
    memberSince: { color: "#777", marginBottom: 8 },
    contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
    contactText: { fontSize: 14, color: "#555" },

    card: {
        backgroundColor: "#fff",
        marginHorizontal: 15,
        marginVertical: 8,
        padding: 15,
        borderRadius: 10,
        elevation: 2,
    },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: "#000", marginBottom: 8 },
    labelText: { fontSize: 13, color: "#666" },
    highlightText: { color: "#ED1C25", fontWeight: "700", marginBottom: 10 },
    anniversaryRow: { flexDirection: "row", justifyContent: "space-between" },
    anniversaryBox: { alignItems: "center", flex: 1 },
    valueText: { fontSize: 20, fontWeight: "700", color: "#333" },
    subText: { fontSize: 12, color: "#888" },

    systemGrid: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 6,
    },
    systemBox: {
        flex: 1,
        backgroundColor: "#f9f9f9",
        margin: 4,
        padding: 10,
        borderRadius: 8,
    },
    systemLabel: { fontSize: 13, color: "#777" },
    systemValue: { fontSize: 15, fontWeight: "700", color: "#000" },
    installationText: { fontSize: 13, color: "#555", marginTop: 4 },
    boldText: { fontWeight: "700", color: "#000" },

    envBox: {
        backgroundColor: "#eafff2",
        padding: 12,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 10,
    },
    envValue: { fontSize: 22, fontWeight: "700", color: "#0a8f4a" },
    envLabel: { fontSize: 14, color: "#333", marginVertical: 4 },
    envSubText: { fontSize: 12, color: "#666" },
    envStats: { flexDirection: "row", justifyContent: "space-between" },
    statBox: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 16, fontWeight: "700", color: "#000" },
    statLabel: { fontSize: 12, color: "#777" },

    achievementsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginVertical: 6,
    },
    achievementBox: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 4,
        alignItems: "center",
    },
    achievementText: { fontWeight: "600", color: "#333" },

    logoutButton: {
        margin: 15,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: "center",
    },
    logoutText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    popupBox: {
        width: "80%",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingVertical: 25,
        paddingHorizontal: 20,
        alignItems: "center",
        elevation: 10,
    },
    popupText: {
        fontSize: 16,
        color: "#333",
        marginVertical: 15,
        textAlign: "center",
    },
    popupButtons: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
    },
    yesButton: {
        backgroundColor: "#ED1C25",
        paddingVertical: 10,
        paddingHorizontal: 50,
        borderRadius: 8,
    },
    noButton: {
        backgroundColor: "#888",
        paddingVertical: 10,
        paddingHorizontal: 50,
        borderRadius: 8,
    },
    yesText: { color: "#fff", fontWeight: "700" },
    noText: { color: "#fff", fontWeight: "700" },
});

import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
    View,
    Text,
    
    ScrollView,
    StatusBar,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Loader from "../components/Loader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from '../constants/screenNames';

const SupportScreen = ({ route, navigation }) => {
    const { stationId } = route.params;

    console.log("SupportScreen ID:", stationId);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleCall = () => {
        const phoneNumber = "tel:9244414441";
        Linking.openURL(phoneNumber);
    };

    const getDaysAgo = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        const diff = (today - target) / (1000 * 60 * 60 * 24);

        if (diff === 0) return "Today";
        if (diff === 1) return "1 day ago";
        if (diff < 7) return `${diff} days ago`;

        const weeks = Math.floor(diff / 7);
        return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    };

const fetchTickets = async () => {
    try {
        setLoading(true);

        const storedData = await AsyncStorage.getItem(USER_DATA);

        const parsedData = storedData
            ? JSON.parse(storedData)
            : null;

        const phoneNo = parsedData?.UserInfo?.phoneNo;

        if (!phoneNo) {
            Alert.alert("Error", "Phone number not found");
            return;
        }

        const response = await fetch(
            `https://board.trisentrix.com/ticket/user?PhoneNo=${phoneNo}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("📡 status:", response.status);

        const result = await response.json();

        console.log("🎫 Ticket Response:", result);

        if (!result.success) {
            Alert.alert("Error", result.error || "Failed to fetch tickets");
            return;
        }

        const fetchedTickets = (result.data || []).map((item) => ({
            id: item.TicketNo || item._id,
            title: item.Description || "No description",
            category: item.type || "General",
            status: item.status || "Open",

            statusColor:
                item.status === "Resolved"
                    ? "#22C55E"
                    : item.status === "In progress"
                    ? "#F59E0B"
                    : "#E11D48",

            daysAgo: item.createdAt
                ? getDaysAgo(new Date(item.createdAt))
                : "N/A",

            createdAt: item.createdAt
                ? new Date(item.createdAt)
                : null,
        }));

        setTickets(fetchedTickets);

    } catch (error) {
        console.log("❌ fetchTickets error:", error);

        Alert.alert(
            "Error",
            error.message || "Failed to load tickets"
        );
    } finally {
        setLoading(false);
    }
};

    useFocusEffect(
        useCallback(() => {
            fetchTickets();
        }, [])
    );
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar backgroundColor="#fff" barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Support</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Help Section */}
                <View style={styles.helpSection}>
                    <Text style={styles.helpTitle}>Need Help?</Text>
                    <Text style={styles.helpDescription}>
                        Create a support ticket and our solar experts will help you resolve
                        any issues with your system.
                    </Text>

                    <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                        <Text style={styles.callButtonText}>Call Our Support Expert</Text>
                    </TouchableOpacity>



                    <TouchableOpacity
                        onPress={() =>
                            navigation.navigate(SCREEN_NAMES.CREATE_TICKET, {
                                stationId: stationId,
                            })
                        }
                    >
                        <LinearGradient
                            colors={["#F00001", "#B00100"]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.createButton}
                        >
                            <Text style={styles.createButtonText}>Create Ticket</Text>
                        </LinearGradient>
                    </TouchableOpacity>


                </View>
                {/* Recent Tickets */}
                <Text style={styles.recentTitle}>Recent Tickets</Text>
                {tickets.map((ticket, index) => (
                    <View key={index} style={styles.ticketCard}>
                        <View style={styles.ticketHeader}>
                            <Text style={styles.ticketId}>#{ticket.id}</Text>
                            <View style={styles.statusRow}>
                                <Ionicons
                                    name={
                                        ticket.status === "Resolved"
                                            ? "checkmark-circle"
                                            : "time-outline"
                                    }
                                    size={14}
                                    color={ticket.statusColor}
                                />
                                <Text
                                    style={[styles.statusText, { color: ticket.statusColor }]}
                                >
                                    {ticket.status}
                                </Text>
                            </View>
                            <Text style={styles.daysAgo}>{ticket.daysAgo}</Text>
                        </View>
                        <Text style={styles.ticketTitle}>{ticket.title}</Text>
                        <Text style={styles.ticketCategory}>{ticket.category}</Text>
                    </View>
                ))}
            </ScrollView>

            {loading && <Loader />}
        </SafeAreaView>
    );
};

export default SupportScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
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
    scrollContent: {
        padding: 16,
    },
    helpSection: {
        marginBottom: 25,
    },
    helpTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#000",
        marginBottom: 6,
    },
    helpDescription: {
        fontSize: 14,
        color: "#555",
        marginBottom: 15,
    },
    callButton: {
        borderWidth: 1,
        borderColor: "#ED1C25",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 10,
    },
    callButtonText: {
        color: "#ED1C25",
        fontWeight: "600",
        fontSize: 15,
    },
    createButton: {
  height: 45,
  borderRadius: 8,
  justifyContent: "center",
  alignItems: "center",
},
    createButtonText: {
  color: "#fff",
  fontWeight: "600",
  fontSize: 15,
  lineHeight: 20
},
    recentTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#000",
        marginBottom: 10,
    },
    ticketCard: {
        backgroundColor: "#F9FAFB",
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
    },
    ticketHeader: {
        flexDirection: "row",
        alignItems: "center",
    },
    ticketId: {
        fontWeight: "700",
        color: "#000",
        flex: 1,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 10,
    },
    statusText: {
        marginLeft: 4,
        fontWeight: "600",
        fontSize: 12,
    },
    daysAgo: {
        fontSize: 12,
        color: "#777",
    },
    ticketTitle: {
        marginTop: 4,
        fontWeight: "600",
        color: "#000",
        fontSize: 14,
    },
    ticketCategory: {
        fontSize: 12,
        color: "#777",
    },
});

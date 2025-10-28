import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

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
import firestore from "@react-native-firebase/firestore";
import Loader from "../components/Loader";
const SupportScreen = ({ navigation }) => {
     const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
 

  const getDaysAgo = (date) => {
    const diff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 1) return "Today";
    if (diff < 2) return "1 day ago";
    if (diff < 7) return `${Math.floor(diff)} days ago`;
    return `${Math.floor(diff / 7)} week${Math.floor(diff / 7) > 1 ? "s" : ""} ago`;
  };
   const fetchTickets = async () => {
    try {
      setLoading(true);
      const snapshot = await firestore()
        .collection("createTicket")
        .orderBy("createdAt", "desc")
        .get();

      if (snapshot.empty) {
        setTickets([]);
        return;
      }

      const fetchedTickets = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.TicketNo || doc.id,
          title: data.Description || "No description",
          category: data.type,
          status: data.status,
          statusColor:
            data.status === "Resolved"
              ? "#22C55E"
              : data.status === "In progress"
              ? "#F59E0B"
              : "#E11D48",
          daysAgo: data.createdAt ? getDaysAgo(data.createdAt.toDate()) : "N/A",
        };
      });

      setTickets(fetchedTickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      Alert.alert("Error", "Failed to load tickets.");
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

                    <TouchableOpacity style={styles.callButton}>
                        <Text style={styles.callButtonText}>Call Our Support Expert</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => navigation.navigate("createticketScreen")}
                    >
                        <Text style={styles.createButtonText}>Create Ticket</Text>
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
        borderColor: "#E60000",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginBottom: 10,
    },
    callButtonText: {
        color: "#E60000",
        fontWeight: "600",
        fontSize: 15,
    },
    createButton: {
        backgroundColor: "#E60000",
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
    },
    createButtonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 15,
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

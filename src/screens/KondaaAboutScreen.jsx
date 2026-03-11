import React from "react";
import {
  View,
  Text,
  
  ScrollView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

const KondaaAboutScreen = ({ navigation }) => {
  const benefits = [
    {
      icon: "checkmark-done-circle-outline",
      title: "Performance Guarantee",
      desc:
        "We guarantee your system will meet or exceed the committed energy generation targets",
      color: "#22C55E",
    },
    {
      icon: "wallet-outline",
      title: "Savings Protection",
      desc:
        "Your electricity bill savings are protected with our assured generation promise",
      color: "#F59E0B",
    },
    {
      icon: "pulse-outline",
      title: "Real-time Monitoring",
      desc: "24×7 system monitoring with instant alerts and performance tracking",
      color: "#EF4444",
    },
    {
      icon: "headset-outline",
      title: "Priority Support",
      desc:
        "Dedicated technical support with priority maintenance and issue resolution",
      color: "#3B82F6",
    },
    {
      icon: "bar-chart-outline",
      title: "ROI Assurance",
      desc: "Guaranteed return on investment with transparent reporting and analytics",
      color: "#8B5CF6",
    },
    {
      icon: "shield-checkmark-outline",
      title: "Premium Warranty",
      desc:
        "Extended warranty coverage beyond standard manufacturer warranties",
      color: "#EC4899",
    },
  ];

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
 
        {/* Red Top Card */}
        <View style={styles.topCard}>
          <Ionicons name="shield-checkmark-outline" size={40} color="#fff" />
          <Text style={styles.topTitle}>Kondaas Assured™</Text>
          <Text style={styles.topSubtitle}>
            Your Solar Investment Protection Program
          </Text>
        </View>
 <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is Kondaas Assured™?</Text>
          <Text style={styles.sectionText}>
            Kondaas Assured™ is our comprehensive protection program that
            guarantees your solar system’s performance and safeguards your
            investment. We ensure you get the maximum returns from your solar
            journey.
          </Text>
        </View>

        {/* Green Badge */}
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>100% Performance Guarantee</Text>
        </View>

        {/* Key Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Benefits</Text>
          {benefits.map((item, index) => (
            <View key={index} style={styles.benefitCard}>
              <View style={[styles.iconCircle, { backgroundColor: item.color + "22" }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{item.title}</Text>
                <Text style={styles.benefitDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ready to Get Protected?{"\n"}
            <Text style={{ fontSize: 13 }}>
              Join thousands of satisfied customers with Kondaas Assured™
            </Text>
          </Text>
          {/* <TouchableOpacity style={styles.getStartedButton}>
            <Text style={styles.getStartedText}>Get Started Today</Text>
          </TouchableOpacity> */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default KondaaAboutScreen;

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

  topCard: {
    backgroundColor: "#E60000",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    margin: 16,
    paddingVertical: 25,
  },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 10 },
  topSubtitle: { color: "#fff", fontSize: 13, marginTop: 4 },

  section: { paddingHorizontal: 16, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 6 },
  sectionText: { fontSize: 14, color: "#555", lineHeight: 20 },

  badgeContainer: {
    backgroundColor: "#22C55E",
    alignSelf: "center",
    marginTop: 16,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  badgeText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  benefitTitle: { fontSize: 14, fontWeight: "600", color: "#111" },
  benefitDesc: { fontSize: 13, color: "#555", marginTop: 2 },

  footer: {
    alignItems: "center",
    marginTop: 25,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  getStartedButton: {
    backgroundColor: "#E60000",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  getStartedText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

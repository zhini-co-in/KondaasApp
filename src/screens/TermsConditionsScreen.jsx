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
import LinearGradient from "react-native-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

const TermsConditionsScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>


      <LinearGradient
        colors={["#df0101", "#df0101", "#df0101"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.highlightBox}
      >
        <Text style={styles.highlightTitle}>Terms & Conditions</Text>
        <Text style={styles.highlightSub}>Kondaas Solar Solutions</Text>

        <View style={styles.updateBox}>
          <Text style={styles.updateText}>Last Updated: August 15, 2025</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Content */}
        <View style={styles.content}>
          {/* 1. Acceptance of Terms */}
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By downloading, accessing, or using the Kondaas Solar mobile
            application (“App”), you agree to be bound by these Terms and
            Conditions (“Terms”). If you do not agree to these Terms, please do
            not use our App or services.
          </Text>
          <Text style={styles.paragraph}>
            These Terms constitute a legally binding agreement between you and
            Kondaas Solar Solutions and govern your use of all our services,
            including but not limited to solar installations, monitoring
            systems, and the Kondaas Assured™ program.
          </Text>

          {/* 2. Company Information */}
          <Text style={styles.sectionTitle}>2. Company Information</Text>
          <Text style={styles.bold}>Kondaas Solar Solutions</Text>
          <Text style={styles.paragraph}>
            A leading provider of residential and commercial solar energy
            solutions in India.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Registered Office:</Text> [5B, Sri, Kamarajar Rd, Alamelu Nagar, Coimbatore, Tamil Nadu 641015]
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>E-Mail:</Text> [infokondaas@gmail.com]
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Phone Number:</Text> [92444 14441]
          </Text>

          {/* 3. App Usage & Services */}
          <Text style={styles.sectionTitle}>3. App Usage & Services</Text>

          <Text style={styles.subHeading}>3.1 Permitted Use</Text>
          <Text style={styles.paragraph}>
            The App is provided for your personal, non-commercial use to:
          </Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Monitor your solar system performance</Text>
            <Text style={styles.listItem}>• Track energy generation and savings</Text>
            <Text style={styles.listItem}>• Access support services</Text>
            <Text style={styles.listItem}>• Manage your Kondaas Assured™ benefits</Text>
            <Text style={styles.listItem}>• Participate in our referral program</Text>
          </View>

          <Text style={styles.subHeading}>3.2 Prohibited Activities</Text>
          <View style={styles.list}>
            <Text style={styles.listItem}>• Reverse engineering or extracting source code</Text>
            <Text style={styles.listItem}>• Using the App for illegal or unauthorized purposes</Text>
            <Text style={styles.listItem}>• Interfering with or disrupting the App’s functionality</Text>
            <Text style={styles.listItem}>• Attempting to gain unauthorized access to our systems</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsConditionsScreen;

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
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  scrollContainer: {
    flex: 1,
  },
  highlightBox: {
    paddingVertical: 20,
    alignItems: "center",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  highlightTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  highlightSub: {
    color: "#fff",
    fontSize: 14,
    marginTop: 4,
  },
  updateBox: {
    backgroundColor: "#FF8A80",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 6,
    marginTop: 10,
  },
  updateText: {
    color: "#fff",
    fontSize: 12,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginTop: 10,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: "#000",
  },
  subHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
    marginTop: 8,
    marginBottom: 4,
  },
  list: {
    marginLeft: 10,
    marginBottom: 10,
  },
  listItem: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
});

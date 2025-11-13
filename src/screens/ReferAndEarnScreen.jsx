import React, { useState, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage"; 
const ReferAndEarnScreen = ({ navigation }) => {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        setLoading(true);
        const userDataJson = await AsyncStorage.getItem(USER_DATA);
        const userData = userDataJson ? JSON.parse(userDataJson) : null;
        const phoneNo =
          userData?.UserInfo?.phoneNo ||
          userData?.phoneNumber ||
          userData?.mobile ||
          "";

        if (!phoneNo) {
          console.warn("⚠️ No phone number found in USER_DATA.");
          setReferrals([]);
          setLoading(false);
          return;
        }

        console.log("📱 Fetching referrals for phone:", phoneNo);
        const snapshot = await firestore()
          .collection("Referrals")
          .where("refererPhNo", "==", phoneNo)
          .get();
           const data = snapshot.docs.map(doc => doc.data());
        setReferrals(data);

        const successCount = data.filter(item => item.PurchaseTracking).length;
        setTotalAmount(successCount * 5000);

        if (snapshot.empty) {
          console.log("No referrals found for this user.");
          setReferrals([]);
          return;
        }

        const referralData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setReferrals(referralData);
      } catch (error) {
        console.error(" Error fetching referrals:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      {loading && <Loader />}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
      </View>

      {/* Earnings & Referrals */}
      <View style={styles.topBoxContainer}>
        <View style={styles.topBox}>
          <Ionicons name="wallet-outline" size={28} color="#555" />
          <Text style={styles.topValue}>₹{totalAmount.toLocaleString("en-IN")}
</Text>
          <Text style={styles.topLabel}>Earnings</Text>
        </View>
        <View style={styles.topBox}>
          <Ionicons name="people-outline" size={28} color="#555" />
          <Text style={styles.topValue}>
            {referrals.length.toString().padStart(2, "0")}
          </Text>
          <Text style={styles.topLabel}>Successful Referrals</Text>
        </View>
      </View>
      {/* Refer Now Button */}
      <TouchableOpacity
        style={styles.referBtn}
        onPress={() => navigation.navigate("ReferFriendScreen")}
      >
        <Text style={styles.referBtnText}>Refer Now!</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>How it works</Text>

      <View style={styles.howItWorksContainer}>
        {/* Step 1 */}
        <View style={styles.stepRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="link-outline" size={22} color="#E60000" />
          </View>
          <Text style={styles.stepText}>
            Invite your friends through the referral link
          </Text>
        </View>

        {/* Step Divider Dotted Line */}
        <View style={styles.dottedLine} />

        {/* Step 2 */}
        <View style={styles.stepRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="solar-outline" size={22} color="#E60000" />
          </View>
          <Text style={styles.stepText}>
            Your friend installs the Kondaas’s solar
          </Text>
        </View>

        {/* Step Divider Dotted Line */}
        <View style={styles.dottedLine} />

        {/* Step 3 */}
        <View style={styles.stepRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="wallet-outline" size={22} color="#E60000" />
          </View>
          <Text style={styles.stepText}>
            You will get ₹5,000 in your wallet
          </Text>
        </View>
      </View>

      {/* My Referrals */}
      <Text style={styles.sectionTitle}>My Referrals</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

        <View style={styles.referralList}>
          {referrals.map((item, index) => (
            <View key={index} style={styles.referralCard}>
              <View style={styles.referralLeft}>
                <Ionicons name="person-circle-outline" size={32} color="#777" />
                <View>
                  <Text style={styles.referralName}>{item.friendName}</Text>
                  <Text style={styles.referralStatus}>{item.PurchaseAt}</Text>
                </View>
              </View>

              {item.PurchaseTracking ? (
                <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
              ) : (
                <TouchableOpacity style={styles.remindBtn}>
                  <Text style={styles.remindBtnText}>Remind</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReferAndEarnScreen;

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

  topBoxContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    marginHorizontal: 10,
  },
  topBox: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: "center",
    elevation: 2,
  },
  topValue: { fontSize: 20, fontWeight: "bold", marginTop: 5 },
  topLabel: { fontSize: 13, color: "#777", marginTop: 2 },

  referBtn: {
    backgroundColor: "#E60000",
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  referBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },

  stepsContainer: { marginHorizontal: 20 },
  step: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  stepIcon: { marginRight: 10 },
  stepText: { fontSize: 14, color: "#444", flex: 1 },

  referralList: { marginTop: 10, marginHorizontal: 15 },
  referralCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  referralLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  referralName: { fontWeight: "700", fontSize: 14 },
  referralStatus: { fontSize: 12, color: "#666" },
  remindBtn: {
    backgroundColor: "#E60000",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  remindBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  howItWorksContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 5,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFECEC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },

  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },

  dottedLine: {
    borderLeftWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dotted",
    height: 25,
    marginLeft: 19,
  },

});

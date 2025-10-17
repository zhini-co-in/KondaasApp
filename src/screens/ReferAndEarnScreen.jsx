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

const ReferAndEarnScreen = ({ navigation }) => {
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
        <Text style={styles.headerTitle}>Refer & Earn</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Earnings & Referrals */}
        <View style={styles.topBoxContainer}>
          <View style={styles.topBox}>
            <Ionicons name="wallet-outline" size={28} color="#555" />
            <Text style={styles.topValue}>₹15,000</Text>
            <Text style={styles.topLabel}>Earnings</Text>
          </View>
          <View style={styles.topBox}>
            <Ionicons name="people-outline" size={28} color="#555" />
            <Text style={styles.topValue}>03</Text>
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


        {/* How it Works */}
      {/* How it Works */}
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
        <Text style={styles.sectionTitle}>My Referrals (4)</Text>
        <View style={styles.referralList}>
          {[
            { name: "Rajaram", status: "Yet to purchase", button: "Remind", color: "#E60000" },
            { name: "Sivakumar", status: "Purchased on 29th Aug 2025", icon: "checkmark-circle", color: "#4CAF50" },
            { name: "Jeevanandham", status: "Purchased on 11th Jul 2025", icon: "checkmark-circle", color: "#4CAF50" },
            { name: "Rajasekar", status: "Purchased on 17th Apr 2025", icon: "checkmark-circle", color: "#4CAF50" },
          ].map((item, index) => (
            <View key={index} style={styles.referralCard}>
              <View style={styles.referralLeft}>
                <Ionicons name="person-circle-outline" size={32} color="#777" />
                <View>
                  <Text style={styles.referralName}>{item.name}</Text>
                  <Text style={styles.referralStatus}>{item.status}</Text>
                </View>
              </View>
              {item.icon ? (
                <Ionicons name={item.icon} size={22} color={item.color} />
              ) : (
                <TouchableOpacity style={styles.remindBtn}>
                  <Text style={styles.remindBtnText}>{item.button}</Text>
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

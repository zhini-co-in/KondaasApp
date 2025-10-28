import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from "react-native";
import auth from "@react-native-firebase/auth";
import Loader from "../components/Loader";
const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSendOTP = async () => {
    if (phoneNumber.trim().length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    try {
      setLoading(true);
      const fullNumber = "+91" + phoneNumber; 
      const confirmation = await auth().signInWithPhoneNumber(fullNumber);
      setLoading(false);
      navigation.navigate("OtpScreen", { confirmation, phoneNumber: fullNumber });
    } catch (error) {
      console.log("OTP send error:", error);
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image
            source={require("../../assets/images/kondass.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.indicatorWrapper}>
            <View style={styles.indicator}></View>
          </View>

          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.subText}>Enter your phone number to continue</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter the Phone Number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <TouchableOpacity style={styles.otpButton} onPress={handleSendOTP}>
            <Text style={styles.otpButtonText}>Send OTP</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By signing up you are accepting the{" "}
            <Text
              style={styles.termsLink}
              onPress={() => navigation.navigate("TermsConditionsScreen")}
            >
              Terms & Conditions
            </Text>
          </Text>
        </View>
      </ScrollView>
         {loading && <Loader />}
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fb0404" },
  header: { justifyContent: "center", alignItems: "center", backgroundColor: "#fb0404", paddingVertical: 40 },
  logo: { width: 200, height: 100 },
  bottomContainer: { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 25, paddingVertical: 40, flexGrow: 1 },
  indicatorWrapper: { alignItems: "center", marginBottom: 25 },
  indicator: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2 },
  welcomeContainer: { alignItems: "flex-start", marginBottom: 25 },
  welcomeText: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", marginBottom: 6 },
  subText: { fontSize: 14, color: "#666" },
  inputContainer: { width: "100%", marginBottom: 20 },
  label: { fontSize: 14, color: "#333", marginBottom: 8, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 15, fontSize: 16, color: "#000" },
  otpButton: { backgroundColor: "#444", width: "100%", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 5 },
  otpButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  termsText: { color: "#999", fontSize: 12, textAlign: "center", marginTop: 25, lineHeight: 18 },
  termsLink: { color: "#fb0404", fontWeight: "600" },
});

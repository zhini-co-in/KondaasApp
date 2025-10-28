import React, { useState, useRef } from "react";
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
import DeviceInfo from "react-native-device-info";
import firestore from "@react-native-firebase/firestore";
import Loader from "../components/Loader";
import { storeData, USER_DATA } from "../service/localStorage";

const OtpScreen = ({ navigation, route }) => {
  const { confirmation, phoneNumber } = route.params;
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(false); // 👈 for incorrect OTP display
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    if (text.length > 1) text = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError(false); // reset error when typing

    if (text && index < otp.length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleConfirm = async () => {
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      Alert.alert("Error", "Please enter the full OTP");
      return;
    }

    try {
      setLoading(true);
      const result = await confirmation.confirm(otpCode);
      const cleanPhone = phoneNumber?.replace(/^\+91/, "");
      if (!cleanPhone) throw new Error("Invalid phone number");

      const appInfo = {
        version: "1.0.0",
        buildNo: "1",
        lastLogin: new Date().toISOString(),
      };

      const platformInfo = {
        os: DeviceInfo.getSystemName(),
        version: DeviceInfo.getSystemVersion(),
      };

      const userDocRef = firestore().collection("userDetails").doc(cleanPhone);
      const userDoc = await userDocRef.get();

      let userData;
      if (userDoc.exists) {
        userData = userDoc.data();
        await userDocRef.update({
          "AppInfo.lastLogin": appInfo.lastLogin,
          PlatformInfo: platformInfo,
        });
      } else {
        userData = {
          AppInfo: appInfo,
          PlatformInfo: platformInfo,
          UserInfo: { phoneNo: cleanPhone, name: "" },
        };
        await userDocRef.set(userData);
      }

      const finalData = {
        ...userData,
        AppInfo: appInfo,
        PlatformInfo: platformInfo,
      };

      await storeData(USER_DATA, JSON.stringify(finalData));
      const deviceId = userData?.UserInfo?.deviceId;

      if (deviceId && deviceId.trim() !== "") {
        navigation.reset({ index: 0, routes: [{ name: "mainScreen" }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "ProductsHomeScreen" }] });
      }
    } catch (error) {
      console.error("❌ OTP Confirmation Error:", error);
      setError(true); // 👈 show red border and error text
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
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
            <Text style={styles.subText}>Enter the OTP sent to your phone</Text>
          </View>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>OTP Number</Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                style={[styles.otpInput, error && styles.errorBorder]} // 👈 red border if error
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                keyboardType="number-pad"
                maxLength={1}
                returnKeyType="next"
              />
            ))}
          </View>

          {error && <Text style={styles.errorText}>Incorrect OTP</Text>}

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {loading && <Loader />}
    </SafeAreaView>
  );
};

export default OtpScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fb0404" },
  header: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fb0404",
    paddingVertical: 40,
  },
  logo: { width: 200, height: 100 },
  bottomContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingVertical: 40,
    flexGrow: 1,
  },
  indicatorWrapper: { alignItems: "center", marginBottom: 25 },
  indicator: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2 },
  welcomeContainer: { alignItems: "flex-start", marginBottom: 10 },
  welcomeText: { fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 10,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    width: 45,
    height: 50,
    textAlign: "center",
    fontSize: 18,
    color: "#000",
  },
  errorBorder: { borderColor: "red" }, // 👈 red border when error
  errorText: {
    color: "red",
    fontSize: 13,
    marginTop: 5,
    marginLeft: 2,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#666",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

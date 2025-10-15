import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

const OtpScreen = ({ navigation }) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputs = useRef([]);

  const handleChange = (text, index) => {
    if (text.length > 1) text = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < otp.length - 1) {
      inputs.current[index + 1].focus();
    }
  };

  const handleConfirm = () => {
    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      alert("Please enter the full OTP");
      return;
    }
    navigation?.navigate("Home");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {/* 🔴 Top Logo Section */}
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/kondass.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ⚪ White Rounded Container */}
          <View style={styles.bottomContainer}>
            <View style={styles.indicatorWrapper}>
              <View style={styles.indicator}></View>
            </View>

            {/* 👋 Welcome Section */}
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome</Text>
              <Text style={styles.subText}>
                Enter the OTP sent to number <Text style={{ fontWeight: "600" }}>+91 98765 12345</Text>
              </Text>
            </View>

            {/* 🔢 OTP Input */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputs.current[index] = ref)}
                  style={styles.otpInput}
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  returnKeyType="next"
                />
              ))}
            </View>

            {/* 🔘 Confirm Button */}
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>

            {/* 📜 Terms Text */}
            <Text style={styles.termsText}>
              By signing up you are accepting to the{" "}
              <Text style={styles.termsLink}>Terms & Conditions</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OtpScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fb0404",
  },
  container: {
    flex: 1,
    backgroundColor: "#fb0404",
  },
  header: {
    flex: 0.4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fb0404",
  },
  logo: {
    width: 200,
    height: 100,
  },
  bottomContainer: {
    flex: 0.6,
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingVertical: 40,
  },
  indicatorWrapper: {
    alignItems: "center",
    marginBottom: 25,
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
  },
  welcomeContainer: {
    alignItems: "flex-start",
    marginBottom: 25,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  subText: {
    fontSize: 14,
    color: "#666",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 20,
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
  confirmButton: {
    backgroundColor: "#666",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  termsText: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
    marginTop: 25,
    lineHeight: 18,
  },
  termsLink: {
    color: "#fb0404",
    fontWeight: "600",
  },
});

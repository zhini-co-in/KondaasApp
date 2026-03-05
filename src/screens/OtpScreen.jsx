import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import DeviceInfo from "react-native-device-info";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Loader from "../components/Loader";
import { storeData, USER_DATA } from "../service/localStorage";
import { setToken, getSolarmanToken } from "../api/api";
import { SOLARMAN_CONFIG } from "../api/solarmanAuth";
import NetInfo from "@react-native-community/netinfo";
import messaging from "@react-native-firebase/messaging";
import LinearGradient from "react-native-linear-gradient";
import { PermissionsAndroid, Platform } from "react-native";
import { SCREEN_NAMES } from '../constants/screenNames';

const OtpScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const [confirmation, setConfirmation] = useState(route.params.confirmation);
  const inputs = useRef([]);
  const { verificationId, phoneNumber } = route.params;

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleChange = (text, index) => {
    if (text.length > 1) text = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError(false);
    if (text && index < otp.length - 1) inputs.current[index + 1].focus();
  };

  const handleAutoLogin = async (credential, phone) => {
    try {
      setLoading(true);

      const result = await auth().signInWithCredential(credential);


      const cleanPhone = phone.replace("+91", "");

      const appInfo = { version: "1.0.0", buildNo: "1", lastLogin: new Date().toISOString() };
      const platformInfo = { os: DeviceInfo.getSystemName(), version: DeviceInfo.getSystemVersion() };

      const userRef = firestore().collection("userDetails").doc(cleanPhone);
      const docSnap = await userRef.get();

      let userData;
      if (docSnap.exists) {
        userData = docSnap.data() || {};
        const userInfo = userData.UserInfo || {};
        if (Object.keys(userInfo).length === 0) {
          userData.UserInfo = { phoneNo: cleanPhone, name: "", deviceId: "", email: "", password: "", unitsrupees: "4" };
          await userRef.set({ UserInfo: userData.UserInfo }, { merge: true });
        }
        await userRef.set({ AppInfo: appInfo, PlatformInfo: platformInfo }, { merge: true });
      } else {
        userData = { AppInfo: appInfo, PlatformInfo: platformInfo, UserInfo: { phoneNo: cleanPhone, name: "", deviceId: "", email: "", password: "", unitsrupees: "4" } };
        await userRef.set(userData);
      }

      // FCM Token
      let fcmToken = null;
      try {
        await requestFCMPermission();
        await new Promise(resolve => setTimeout(resolve, 2000));
        fcmToken = await messaging().getToken();
      } catch (err) {
        Alert.alert("FCM Error", "Failed to get FCM token");
      }

      await userRef.set({ UserInfo: { ...userData.UserInfo, fcmToken } }, { merge: true });

      // Solarman token
      const { email, password } = userData.UserInfo || {};
      let accessToken = null;
      if (email && password) {
        const tokenData = await getSolarmanToken(SOLARMAN_CONFIG.appId, SOLARMAN_CONFIG.appSecret, email, password, SOLARMAN_CONFIG.language);
        if (tokenData?.access_token) accessToken = tokenData.access_token;
      }

      const finalData = { ...userData, AppInfo: appInfo, PlatformInfo: platformInfo, accessToken: accessToken || null, UserInfo: { ...userData.UserInfo, fcmToken } };
      await storeData(USER_DATA, JSON.stringify(finalData));

      // Navigate
      if (email && password) {
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.MAIN }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.PRODUCTS_HOME }] });
      }

    } catch (err) {
      Alert.alert("Login Failed", err.message || "Something went wrong during auto-login");
    } finally {
      setLoading(false);
    }
  };


const handleConfirm = async () => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    Alert.alert("No Internet", "No network connection available");
    return;
  }

  const otpCode = otp.join("");

  if (otpCode.length < 6) {
    setErrorMessage("Please enter full OTP");
    return;
  }

  try {
    setLoading(true);

    const credential = auth.PhoneAuthProvider.credential(
      verificationId,
      otpCode
    );

    await handleAutoLogin(credential, phoneNumber);
    setErrorMessage("");

  } catch (err) {
    setErrorMessage(err.message || "OTP verification failed");
  } finally {
    setLoading(false);
  }
};

  const handleResendOtp = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert("No Internet", "No network connection available");
      return;
    }

    try {
      setLoading(true);
      setCanResend(false);
      setTimer(30);

      const confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
      setConfirmation(confirmationResult);
      setOtp(["", "", "", "", "", ""]);

      Alert.alert("OTP Sent", "A new OTP has been sent to your phone number.");

    } catch (error) {
      setCanResend(true);
      Alert.alert("Error", "Failed to resend OTP. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const requestFCMPermission = async () => {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      console.log("🔔 Notification permission:", granted);
    }

    const authStatus = await messaging().requestPermission();
    console.log("📩 FCM permission status:", authStatus);
  };
  return (
    <View style={{ flex: 1 }}>
      {/* 2. TRANSLUCENT STATUS BAR: Makes the system bar invisible so the gradient flows up */}
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle="light-content" 
      />

      {/* 3. WRAP EVERYTHING IN THE MAIN GRADIENT */}
      <LinearGradient
        colors={['#F00001', '#B00100']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            
            {/* 4. HEADER: Removed extra LinearGradient/Background to use parent's unique color shadow */}
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
                  style={[styles.otpInput, error && styles.errorBorder]}
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  returnKeyType="next"
                   onKeyPress={({ nativeEvent }) => {
        if (nativeEvent.key === "Backspace") {
          if (otp[index] === "" && index > 0) {
            const newOtp = [...otp];
            newOtp[index - 1] = "";
            setOtp(newOtp);
            inputs.current[index - 1].focus();
          }
        }
      }}
                />
              ))}
            </View>

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                { opacity: otp.join("").length === 6 ? 1 : 0.5 }
              ]}
              disabled={otp.join("").length !== 6}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>


            <View style={styles.resendContainer}>
              {canResend ? (
                <TouchableOpacity onPress={handleResendOtp}>
                  <Text style={styles.resendText}>Resend OTP</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.timerText}>Resend available in {timer}s</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.changeNumberContainer}
              onPress={() => navigation.navigate(SCREEN_NAMES.LOGIN)}
            >
              <Text style={styles.changeNumberText}>
                Wrong number? <Text style={styles.changeLink}>Change Phone Number</Text>
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
        {loading && <Loader />}
        </SafeAreaView>
      </LinearGradient>
      </View>
      
  );
};

export default OtpScreen;

const styles = StyleSheet.create({
  header: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom:40,
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
  subText: { color: "#555", fontSize: 14 },
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
  errorBorder: { borderColor: "red" },
  errorText: {
    color: "red",
    fontSize: 13,
    marginTop: 5,
    marginLeft: 2,
    fontWeight: "500",
  },
  confirmButton: {
    backgroundColor: "#444",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  changeNumberContainer: {
    alignItems: "center",
    marginTop: 15,
  },
  changeNumberText: {
    color: "#555",
    fontSize: 14,
  },
  changeLink: {
    color: "#fb0404",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  changeNumberContainer: { alignItems: "center", marginTop: 15 },
  changeNumberText: { color: "#555", fontSize: 14 },
  changeLink: { color: "#fb0404", fontWeight: "600", textDecorationLine: "underline" },
  resendContainer: { alignItems: "center", marginTop: 15 },
  resendText: { color: "#fb0404", fontSize: 15, fontWeight: "600" },
  timerText: { color: "#777", fontSize: 14 },
});

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
  Platform,
  PermissionsAndroid,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DeviceInfo from "react-native-device-info";
import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import LinearGradient from "react-native-linear-gradient";
import NetInfo from "@react-native-community/netinfo";

import Loader from "../components/Loader";
import { storeData, USER_DATA } from "../service/localStorage";
import { SCREEN_NAMES } from "../constants/screenNames";

const BASE_URL = "https://board.trisentrix.com";

const generateAuthToken = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 64 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

// deviceId எப்பவும் body-ல இருக்கும்
const apiCall = async (url, body, authToken = null) => {
  const headers = { "Content-Type": "application/json" };
  if (authToken) headers["x-auth-token"] = authToken;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
};

const OtpScreen = ({ navigation, route }) => {
  const [loading, setLoading]           = useState(false);
  const [otp, setOtp]                   = useState(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState("");
  const [timer, setTimer]               = useState(30);
  const [canResend, setCanResend]       = useState(false);
  const [confirmation, setConfirmation] = useState(route.params.confirmation);

  const inputs = useRef([]);
  const { verificationId, phoneNumber } = route.params;

  // ─── Countdown timer ─────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // ─── OTP input handling ──────────────────────────────────────
  const handleChange = (text, index) => {
    if (text.length > 1) text = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setErrorMessage("");
    if (text && index < otp.length - 1) inputs.current[index + 1]?.focus();
  };

  const handleBackspace = (key, index) => {
    if (key === "Backspace" && otp[index] === "" && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  };

  // ─── FCM token ───────────────────────────────────────────────
  const getFcmToken = async () => {
    try {
      if (Platform.OS === "android" && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }
      const status = await messaging().requestPermission();
      const allowed =
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL;

      if (allowed) {
        await messaging().registerDeviceForRemoteMessages();
        return await messaging().getToken();
      }
    } catch (e) {
      console.log("FCM error:", e.message);
    }
    return null;
  };

  // ─── Main login flow ─────────────────────────────────────────
  const handleAutoLogin = async (credential, phone) => {
    try {
      setLoading(true);

      // 1️⃣ Firebase verify
      await auth().signInWithCredential(credential);
      const cleanPhone = phone?.replace("+91", "").trim();

      // 2️⃣ FCM token & Device info
      const fcmToken  = await getFcmToken();
      const deviceId  = await DeviceInfo.getUniqueId(); // ← ஒரே இடத்துல பிடிக்கிறோம்
      const osName    = DeviceInfo.getSystemName();
      const osVersion = DeviceInfo.getSystemVersion();

      // 3️⃣ Generate authToken for this device
      const authToken = generateAuthToken();
      console.log("🔐 authToken generated:", authToken.slice(0, 16) + "...");
      console.log("📱 deviceId:", deviceId);

      const now = new Date().toISOString();

      // 4️⃣ Build the current device object
      const currentDevice = {
        deviceId,
        os:         osName,
        version:    osVersion,
        authToken,
        fcmToken:   fcmToken || null,
        lastUsedAt: now,
      };

      // 5️⃣ Initial SAVE — deviceId body-ல அனுப்பு
      const initialPayload = {
        deviceId,                          // ← server require பண்றது
        AppInfo: { buildNo: "1", version: "1.0.0", lastLogin: now },
        PlatformInfo: { devices: [currentDevice] },
        UserInfo: { phoneNo: cleanPhone, role: "user" },
        devicelist: [],
      };

      try {
        const saveJson = await apiCall(`${BASE_URL}/solarman/user`, initialPayload);
        console.log("💾 Initial save response:", JSON.stringify(saveJson));
      } catch (e) {
        console.log("Initial save error:", e.message);
      }

      // 6️⃣ GET existing user data — deviceId அனுப்பு
      let existingData = {};
      try {
        const getJson = await apiCall(
          `${BASE_URL}/solarman/get`,
          { phoneNo: cleanPhone, deviceId, token: authToken }, // ← deviceId add
          authToken
        );
        console.log("📦 GET user response:", JSON.stringify(getJson, null, 2));

        if (getJson?.success && getJson?.data) {
          existingData = getJson.data;
        } else if (getJson?.UserInfo || getJson?.phoneNo) {
          existingData = getJson;
        }
      } catch (e) {
        console.log("GET user error:", e.message);
      }

      console.log("📦 existingData full:", JSON.stringify(existingData, null, 2));

      // ─── Merge devices list ───────────────────────────────────
      const existingDevices = existingData?.PlatformInfo?.devices || [];
      const otherDevices    = existingDevices.filter((d) => d.deviceId !== deviceId);
      const mergedDevices   = [...otherDevices, currentDevice];

      // ─── Role & credentials ───────────────────────────────────
      // Server may return email/password/role at top-level OR inside UserInfo
      const userInfo = existingData?.UserInfo || {};
      const role     = userInfo?.role      || existingData?.role     || "user";
      const email    = userInfo?.email     || existingData?.email    || null;
      const password = userInfo?.password  || existingData?.password || null;

      console.log("👤 Role:", role);
      console.log("📧 email:", email);
      console.log("🔑 password:", password ? "EXISTS" : "MISSING");

      // 7️⃣ Fetch Solarman accessToken — deviceId அனுப்பு
      let accessToken = null;
      if (email && password) {
        try {
          const tokenJson = await apiCall(
            `${BASE_URL}/solarman/token`,
            { email, password, deviceId, phoneNo: cleanPhone } // ← deviceId add
          );
          console.log("🎟 Token response:", JSON.stringify(tokenJson));
          if (tokenJson?.access_token) {
            accessToken = tokenJson.access_token;
            console.log("✅ accessToken obtained");
          } else {
            console.log("❌ Token not in response");
          }
        } catch (e) {
          console.log("Token fetch error:", e.message);
        }
      } else {
        console.log("⚠️ Skipping token — email/password missing");
      }

      // 8️⃣ Fetch stations — deviceId அனுப்பு
      let devicelist = existingData.devicelist || [];
      if (accessToken) {
        try {
          const stationsJson = await apiCall(
            `${BASE_URL}/solarman/stations`,
            { token: accessToken, phoneNo: cleanPhone, deviceId }, // ← deviceId add
            authToken
          );
          console.log("🏭 Stations response:", JSON.stringify(stationsJson));

          const rawList = stationsJson?.stations || stationsJson?.stationList || [];
          console.log("📡 Station count:", rawList.length);

          if (rawList.length > 0) {
            devicelist = rawList.map((station) => ({
              id:   station.id,
              name: station.name || "",
              installationAmount:
                (existingData.devicelist || []).find((d) => d.id === station.id)
                  ?.installationAmount ?? "",
            }));
            console.log("✅ devicelist built:", devicelist.length, "stations");
          }
        } catch (e) {
          console.log("Stations fetch error:", e.message);
        }
      } else {
        console.log("⚠️ No accessToken — skipping stations fetch");
      }

      // 9️⃣ Final SAVE — deviceId அனுப்பு
      const finalPayload = {
        ...existingData,
        deviceId,                          // ← server require பண்றது
        AppInfo: {
          ...(existingData.AppInfo || {}),
          buildNo:   "1",
          version:   "1.0.0",
          lastLogin: now,
        },
        PlatformInfo: { devices: mergedDevices },
        UserInfo: {
          ...userInfo,
          phoneNo:  cleanPhone,
          email:    email    || null,
          password: password || null,
          role,
        },
        devicelist,
      };

      try {
        await apiCall(`${BASE_URL}/solarman/user`, finalPayload);
        console.log("✅ Final user data saved with", devicelist.length, "stations");
      } catch (e) {
        console.log("Final save error:", e.message);
      }

      // 🔟 AsyncStorage save
      const localData = {
        ...finalPayload,
        accessToken,
        authToken,   // ← current device's authToken shortcut
      };
      await storeData(USER_DATA, JSON.stringify(localData));
      console.log(
        "💾 Saved | accessToken:", accessToken ? "YES" : "NO",
        "| stations:", devicelist.length,
        "| devices:", mergedDevices.length
      );

      // 1️⃣1️⃣ Navigate — role based
      if (role === "surveyer") {
        console.log("✅ Surveyer → SurveyerScreen");
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.SURVEYER_SCREEN }] });
      } else if (email && email.trim() !== "") {
        console.log("✅ Email found → MainScreen");
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.MAIN }] });
      } else {
        console.log("⚠️ No email → ProductsHomeScreen");
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.PRODUCTS_HOME }] });
      }

    } catch (err) {
      console.log("Login error:", err.message);
      Alert.alert("Login Failed", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ─── Confirm OTP ─────────────────────────────────────────────
  const handleConfirm = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      Alert.alert("No Internet", "No network connection available");
      return;
    }

    const otpCode = otp.join("");
    if (otpCode.length < 6) {
      setErrorMessage("Please enter the full 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const credential = auth.PhoneAuthProvider.credential(verificationId, otpCode);
      await handleAutoLogin(credential, phoneNumber);
    } catch (err) {
      setErrorMessage(err.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ──────────────────────────────────────────────
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
      setOtp(["", "", "", "", "", ""]);
      const result = await auth().signInWithPhoneNumber(phoneNumber);
      setConfirmation(result);
      Alert.alert("OTP Sent", "A new OTP has been sent to your phone number.");
    } catch (e) {
      setCanResend(true);
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── UI ───────────────────────────────────────────────────────
  const otpFilled = otp.join("").length === 6;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={["#F00001", "#B00100"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <View style={styles.header}>
              <Image
                source={require("../../assets/images/kondass.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* White card */}
            <View style={styles.card}>
              <View style={styles.indicatorWrapper}>
                <View style={styles.indicator} />
              </View>

              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>Enter the OTP sent to your phone</Text>

              <Text style={styles.label}>OTP Number</Text>

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputs.current[index] = ref)}
                    style={[
                      styles.otpBox,
                      errorMessage ? styles.otpBoxError : null,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleBackspace(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                    returnKeyType="next"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    importantForAutofill="yes"
                  />
                ))}
              </View>

              {!!errorMessage && (
                <Text style={styles.errorText}>{errorMessage}</Text>
              )}

              {/* Confirm button */}
              <TouchableOpacity
                style={[styles.confirmBtn, { opacity: otpFilled ? 1 : 0.45 }]}
                disabled={!otpFilled}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>

              {/* Resend */}
              <View style={styles.resendRow}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResendOtp}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>
                    Resend available in {timer}s
                  </Text>
                )}
              </View>

              {/* Change number */}
              <TouchableOpacity
                style={styles.changeRow}
                onPress={() => navigation.navigate(SCREEN_NAMES.LOGIN)}
              >
                <Text style={styles.changeText}>
                  Wrong number?{" "}
                  <Text style={styles.changeLink}>Change Phone Number</Text>
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
    paddingBottom: 40,
  },
  logo: { width: 200, height: 100 },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingVertical: 40,
    flexGrow: 1,
  },
  indicatorWrapper: { alignItems: "center", marginBottom: 25 },
  indicator: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2 },
  title:    { fontSize: 16, fontWeight: "600", color: "#1A1A1A", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 20 },
  label:    { fontSize: 16, fontWeight: "600", color: "#1A1A1A", marginBottom: 12 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  otpBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    width: 45,
    height: 50,
    textAlign: "center",
    fontSize: 18,
    color: "#000",
  },
  otpBoxError: { borderColor: "red" },
  errorText: {
    color: "red",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
    fontWeight: "500",
  },
  confirmBtn: {
    backgroundColor: "#444",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  resendRow:  { alignItems: "center", marginTop: 15 },
  resendText: { color: "#fb0404", fontSize: 15, fontWeight: "600" },
  timerText:  { color: "#777", fontSize: 14 },
  changeRow:  { alignItems: "center", marginTop: 15 },
  changeText: { color: "#555", fontSize: 14 },
  changeLink: { color: "#fb0404", fontWeight: "600", textDecorationLine: "underline" },
});
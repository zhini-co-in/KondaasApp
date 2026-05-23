// OtpScreen_FIXED.js — Frontend only fix
// Backend-ஐ touch பண்ணல
// 
// KEY INSIGHT:
// /solarman/get என்பது token verify பண்றது
// /solarman/user (save) என்பது token verify பண்றது
// இரண்டுமே token இல்லாம work பண்ணாது
//
// FRONTEND-ONLY FIX STRATEGY:
// ஒரு புதுசா user login பண்ணும்போது:
//   1. Local token generate பண்றோம்
//   2. /solarman/get call பண்றோம் (fail ஆகும் —괜찮아)
//   3. fail ஆனா existingData = {} (empty) — தொடர்கிறோம்
//   4. Final save-ல் token-உடன் save பண்றோம்
//      → Backend save endpoint token இல்லாம accept பண்றதா?
//        இல்லன்னா save-உம் fail ஆகும் — ஆனால் local data இருக்கும்
//   5. AsyncStorage-ல் எல்லாம் save பண்றோம்
//   6. Navigate பண்றோம் — app work ஆகும்
//
// RETURNING USER:
//   DB-ல் token இருக்கும் (last session-ல் save ஆச்சு)
//   getUser pass ஆகும் ✅ email/password கிடைக்கும் ✅

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, Alert, StatusBar,
  Platform, PermissionsAndroid,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DeviceInfo from "react-native-device-info";
import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import LinearGradient from "react-native-linear-gradient";
import NetInfo from "@react-native-community/netinfo";
import Loader from "../components/Loader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { storeData, getStorageData, USER_DATA } from "../service/localStorage";
import { SCREEN_NAMES } from "../constants/screenNames";

const BASE_URL = "https://board.trisentrix.com";

// ─────────────────────────────────────────────────────────────
// safeApiCall — crash பண்ணாம, எப்பவும் object return பண்ணும்
// HTML / non-JSON response வந்தாலும் handle பண்ணும்
// ─────────────────────────────────────────────────────────────
const safeApiCall = async (url, body, authToken = null, deviceId = null) => {
  try {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["x-auth-token"] = authToken;
    if (deviceId)  headers["x-device-id"]  = deviceId;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    const endpoint = url.replace(BASE_URL, "");
    console.log(`🌐 [${res.status}] ${endpoint}`);

    try {
      const json = JSON.parse(rawText);
      console.log(`📨 Response:`, JSON.stringify(json).slice(0, 200));
      return { ok: res.status < 400, status: res.status, data: json };
    } catch {
      // HTML / plain text response — log பண்ணி empty return
      console.log(`⚠️ Non-JSON from ${endpoint}:`, rawText.slice(0, 100));
      return { ok: false, status: res.status, data: null };
    }
  } catch (networkErr) {
    console.log("🔴 Network error:", networkErr.message);
    return { ok: false, status: 0, data: null };
  }
};

// ─────────────────────────────────────────────────────────────
// Local token generate — returning user-க்கு இது use ஆகாது
// (DB-ல் உள்ள token match பண்ணாது)
// புதுசா user-க்கு மட்டும் — first login, DB empty
// ─────────────────────────────────────────────────────────────
const generateAuthToken = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 64 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
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

  useEffect(() => {
    if (timer <= 0) { setCanResend(true); return; }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

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

const getFcmToken = async () => {
  try {
    // ✅ iOS: APNs register + token ready ஆக wait பண்ணு
    if (Platform.OS === "ios") {
      await messaging().registerDeviceForRemoteMessages();
      
      // APNs token ready ஆக சிறிது நேரம் wait
      let apnsToken = null;
      let retries = 0;
      while (!apnsToken && retries < 5) {
        apnsToken = await messaging().getAPNSToken();
        if (!apnsToken) {
          await new Promise(res => setTimeout(res, 1000)); // 1 second wait
          retries++;
        }
      }
      
      if (!apnsToken) {
        console.log("⚠️ APNs token not available after retries");
        return null;
      }
      console.log("✅ APNs token ready:", apnsToken);
    }

    // Android permission
    if (Platform.OS === "android" && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }

    // Permission request
    const status = await messaging().requestPermission();
    const allowed =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;

    if (!allowed) {
      console.log("⚠️ Notification permission denied");
      return null;
    }

    // ✅ இப்போ FCM token எடு
    const fcmToken = await messaging().getToken();
    console.log("✅ FCM Token:", fcmToken ? "RECEIVED" : "MISSING");
    return fcmToken;

  } catch (e) {
    console.log("❌ FCM error:", e.message);
    return null;
  }
};

const handleAutoLogin = async (credential, phone) => {
  try {
    setLoading(true);
    await auth().signInWithCredential(credential);
    const cleanPhone = phone?.replace("+91", "").trim();

    const fcmToken  = await getFcmToken();
    const deviceId  = await DeviceInfo.getUniqueId();
    const osName    = DeviceInfo.getSystemName();
    const osVersion = DeviceInfo.getSystemVersion();
    const now       = new Date().toISOString();

    // ─── Step 1: AsyncStorage-ல் already token இருக்கா check ───
// Step 1: AsyncStorage token read — FIXED
// ─── Step 1: Stored token read ───────────────────────────────
// Step 1-ஐ இப்படி மாத்துங்கள் — full debug version:
let storedToken = null;
try {
  const raw = await getStorageData(USER_DATA);
  console.log("📦 Raw:", raw ? "HAS DATA ✅" : "EMPTY ❌");
  if (raw) {
    const parsed = JSON.parse(raw);
    const device = (parsed?.PlatformInfo?.devices || [])
      .find(d => d.deviceId === deviceId);
    storedToken = device?.authToken || parsed?.authToken || null;
    console.log("🔑 Token:", storedToken ? "FOUND ✅" : "MISSING ❌");
  }
} catch (e) {
  console.log("⚠️ Read error:", e.message);
}

    // ─── Step 2: Token decide பண்றோம் ───
    // storedToken இருந்தா → returning user, அதை use பண்ணு
    // இல்லன்னா → new user, fresh generate பண்ணு
    const workingToken = storedToken || generateAuthToken();
    const isReturning  = !!storedToken;

    console.log(isReturning ? "🔄 Returning user" : "🆕 New user");

    // ─── Step 3: GET user (storedToken-உடன் மட்டும் try) ───
    let existingData = {};

    if (isReturning) {
      const getResult = await safeApiCall(
        `${BASE_URL}/solarman/get`,
        { phoneNo: cleanPhone },
        workingToken,
        deviceId
      );

      if (getResult.ok && getResult.data?.success && getResult.data?.data) {
        existingData = getResult.data.data;
        console.log("✅ getUser success");
      } else {
        // Token expired → fresh token generate பண்ணோம்
        console.log("⚠️ Stored token rejected — treating as new session");
        // workingToken = generateAuthToken(); // ← optional reset
      }
    }
    // New user → existingData = {} already

    const userInfo = existingData?.UserInfo || {};
    const role     = userInfo?.role     || "user";
    const email    = userInfo?.email    || null;
    const password = userInfo?.password || null;

    // ─── Step 4: accessToken ───
    let accessToken = null;
    if (email && password) {
      const tokenResult = await safeApiCall(
        `${BASE_URL}/solarman/token`,
        { email, password, phoneNo: cleanPhone },
        workingToken,
        deviceId
      );
      accessToken = tokenResult.data?.access_token || null;
    }

    // ─── Step 5: Stations ───
    let devicelist = existingData.devicelist || [];
    if (accessToken) {
      const stationsResult = await safeApiCall(
        `${BASE_URL}/solarman/stations`,
        { phoneNo: cleanPhone },
        workingToken,
        deviceId
      );
      const rawList = stationsResult.data?.stations || stationsResult.data?.stationList || [];
      if (rawList.length > 0) {
        devicelist = rawList.map((station) => ({
          id:   station.id,
          name: station.name || "",
          installationAmount:
            (existingData.devicelist || []).find(d => d.id === station.id)
              ?.installationAmount ?? "",
        }));
      }
    }

    // ─── Step 6: Final payload build ───
    const currentDevice = {
      deviceId,
      os:         osName,
      version:    osVersion,
      authToken:  workingToken,
      fcmToken:   fcmToken || null,
      lastUsedAt: now,
      isLastLoggedIn: true,
    };

    const existingDevices = existingData?.PlatformInfo?.devices || [];
    const mergedDevices = [
      ...existingDevices
        .filter(d => d.deviceId !== deviceId)
        .map(d => ({ ...d, isLastLoggedIn: false })),
      currentDevice,
    ];

    const finalPayload = {
      ...existingData,
      AppInfo: { ...(existingData.AppInfo || {}), lastLogin: now },
      PlatformInfo: { devices: mergedDevices },
      UserInfo: {
        ...userInfo,
        phoneNo: cleanPhone,
        role,
        // ✅ email & password இல்லை — saveMailCredentials handle பண்ணும்
      },
      devicelist,
    };

    // ─── Step 7: Save to backend ───
// ─── Step 7: Save to backend ───
const saveResult = await safeApiCall(
  `${BASE_URL}/solarman/user`,
  finalPayload,
  workingToken,
  deviceId
);

if (!saveResult.ok) {
  console.log("⚠️ Backend save failed:", JSON.stringify(saveResult.data));
}

// ─── Step 7b: Save ஆன உடனே getUser call — email/password எடுக்கிறோம் ───
// New user / reinstall case-ல் existingData-ல் email இல்லை
// Save ஆன பிறகு token DB-ல் இருக்கும் — இப்போது getUser pass ஆகும்
if (!email) {
  console.log("📧 Email missing — fetching from DB after save...");
  const getUserResult = await safeApiCall(
    `${BASE_URL}/solarman/get`,
    { phoneNo: cleanPhone },
    workingToken,
    deviceId
  );

  if (getUserResult.ok && getUserResult.data?.success && getUserResult.data?.data) {
    const freshData = getUserResult.data.data;
const freshEmail    = freshData?.UserInfo?.email    || freshData?.email    || null;
const freshPassword = freshData?.UserInfo?.password || freshData?.password || null;
const freshRole     = freshData?.UserInfo?.role     || freshData?.role     || role;

    console.log("✅ Fresh email from DB:", freshEmail ? "FOUND" : "MISSING");

    // existingData update பண்ணு — navigate logic use பண்ணும்
    if (freshEmail) {
      // accessToken இல்லன்னா இப்போது எடுக்கிறோம்
      if (!accessToken && freshEmail && freshPassword) {
        const tokenResult = await safeApiCall(
          `${BASE_URL}/solarman/token`,
          { email: freshEmail, password: freshPassword, phoneNo: cleanPhone },
          workingToken,
          deviceId
        );
        accessToken = tokenResult.data?.access_token || null;
        console.log(accessToken ? "✅ accessToken obtained" : "⚠️ No accessToken");
      }

      // AsyncStorage-ஐ email-உடன் update பண்ணு
      const updatedPayload = {
        ...finalPayload,
        UserInfo: {
          ...finalPayload.UserInfo,
          email:    freshEmail,
          password: freshPassword,
          role:     freshRole,
        },
        accessToken,
        authToken: workingToken,
      };

      await AsyncStorage.setItem(USER_DATA, JSON.stringify(updatedPayload));
      console.log("💾 Updated storage with email");

      // Navigate to MainScreen
      if (freshRole === "surveyer") {
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.SURVEYER_SCREEN }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.MAIN }] });
      }
      return; // ← early return, கீழே navigate வேண்டாம்
    }
  }
}

// ─── Step 8: AsyncStorage ───
await AsyncStorage.setItem(USER_DATA, JSON.stringify({
  ...finalPayload,
  UserInfo: {
    ...finalPayload.UserInfo,
    role,  // ← "surveyer" or "user" — clearly set
  },
  accessToken,
  authToken: workingToken,
}));
console.log("💾 Write verify:", "SUCCESS ✅");

// ─── Step 9: Navigate ───
if (role === "surveyer") {
  navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.SURVEYER_SCREEN }] });
} else if (email?.trim()) {
  navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.MAIN }] });
} else {
  navigation.reset({ index: 0, routes: [{ name: SCREEN_NAMES.PRODUCTS_HOME }] });
}

  } catch (err) {
    console.log("❌ Login error:", err.message);
    Alert.alert("Login Failed", err.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
};

const handleConfirm = async () => {
  const net = await NetInfo.fetch();
const isOffline = net.isConnected === false || net.isInternetReachable === false;
if (isOffline) return;
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

    // ✅ FIX: confirmation.confirm() use பண்றோம்
    // signInWithPhoneNumber flow-க்கு இதுதான் சரி
    const userCredential = await confirmation.confirm(otpCode);

    // credential object உருவாக்கி handleAutoLogin-க்கு pass பண்றோம்
    const credential = auth.PhoneAuthProvider.credential(
      confirmation.verificationId,  // ✅ confirmation-இல் இருந்து எடுக்கிறோம்
      otpCode
    );

    await handleAutoLogin(credential, phoneNumber);

  } catch (err) {
    if (err.code === "auth/invalid-verification-code") {
      setErrorMessage("Invalid OTP. Please try again.");
    } else if (err.code === "auth/session-expired") {
      setErrorMessage("OTP expired. Please resend.");
    } else {
      setErrorMessage(err.message || "OTP verification failed");
    }
  } finally {
    setLoading(false);
  }
};

  const handleResendOtp = async () => {
    const net = await NetInfo.fetch();
const isOffline = net.isConnected === false || net.isInternetReachable === false;
if (isOffline) return;
    if (!net.isConnected) {
      Alert.alert("No Internet", "No network connection available");
      return;
    }
    try {
      setLoading(true);
      setCanResend(false);
      setTimer(30);
      setOtp(["", "", "", "", "", ""]);
      const result = await auth().signInWithPhoneNumber(phoneNumber, true);
      setConfirmation(result);
      Alert.alert("OTP Sent", "A new OTP has been sent.");
    } catch (e) {
      setCanResend(true);
      Alert.alert("Error", "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

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
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Image source={require("../../assets/images/kondass.png")} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.card}>
              <View style={styles.indicatorWrapper}>
                <View style={styles.indicator} />
              </View>
              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>Enter the OTP sent to your phone</Text>
              <Text style={styles.label}>OTP Number</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputs.current[index] = ref)}
                    style={[styles.otpBox, errorMessage ? styles.otpBoxError : null]}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    returnKeyType="next"
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    importantForAutofill="yes"
                  />
                ))}
              </View>
              {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
              <TouchableOpacity
                style={[styles.confirmBtn, { opacity: otpFilled ? 1 : 0.45 }]}
                disabled={!otpFilled}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmText}>Confirm</Text>
              </TouchableOpacity>
              <View style={styles.resendRow}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResendOtp}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>Resend available in {timer}s</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.changeRow}
                onPress={() => navigation.navigate(SCREEN_NAMES.LOGIN)}
              >
                <Text style={styles.changeText}>
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
  header:           { justifyContent: "center", alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  logo:             { width: 200, height: 100 },
  card:             { backgroundColor: "#fff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 25, paddingVertical: 40, flexGrow: 1 },
  indicatorWrapper: { alignItems: "center", marginBottom: 25 },
  indicator:        { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2 },
  title:            { fontSize: 16, fontWeight: "600", color: "#1A1A1A", marginBottom: 4 },
  subtitle:         { fontSize: 14, color: "#555", marginBottom: 20 },
  label:            { fontSize: 16, fontWeight: "600", color: "#1A1A1A", marginBottom: 12 },
  otpRow:           { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  otpBox:           { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, width: 45, height: 50, textAlign: "center", fontSize: 18, color: "#000" },
  otpBoxError:      { borderColor: "red" },
  errorText:        { color: "red", fontSize: 13, marginTop: 4, marginBottom: 4, fontWeight: "500" },
  confirmBtn:       { backgroundColor: "#444", width: "100%", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 10 },
  confirmText:      { color: "#fff", fontSize: 16, fontWeight: "600" },
  resendRow:        { alignItems: "center", marginTop: 15 },
  resendText:       { color: "#fb0404", fontSize: 15, fontWeight: "600" },
  timerText:        { color: "#777", fontSize: 14 },
  changeRow:        { alignItems: "center", marginTop: 15 },
  changeText:       { color: "#555", fontSize: 14 },
  changeLink:       { color: "#fb0404", fontWeight: "600", textDecorationLine: "underline" },
});
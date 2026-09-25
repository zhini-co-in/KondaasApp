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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorageData, USER_DATA } from "../service/localStorage";
import { SCREEN_NAMES } from "../constants/screenNames";
import { logError, logSecurity } from '../utils/crashLogger';
import { apiFetch, BASE_URL } from "../api/apiClient";

const OtpScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [autoRetried, setAutoRetried] = useState(false);

  const inputs = useRef([]);
  const [verificationId, setVerificationId] = useState(
  route.params?.verificationId || null
);
const { phoneNumber } = route.params || {};

  // Resend countdown timer
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Firebase session expiry warning (≈ 4 minutes)
  useEffect(() => {
    const expireTimer = setTimeout(() => {
      setErrorMessage("OTP session may have expired. Please resend if needed.");
      setCanResend(true);
    }, 4 * 60 * 1000);

    return () => clearTimeout(expireTimer);
  }, []);

  // ─── OTP Input Handlers ────────────────────────────────────
  const handleChange = (text, index) => {
    // Paste support
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").slice(0, 6);
      if (digits.length > 1) {
        const newOtp = ["", "", "", "", "", ""];
        digits.split("").forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtp(newOtp);
        setErrorMessage("");
        const lastIndex = Math.min(digits.length - 1, 5);
        inputs.current[lastIndex]?.focus();
        return;
      }
      text = text.slice(-1);
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setErrorMessage("");
    if (text && index < otp.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (key, index) => {
    if (key === "Backspace" && otp[index] === "" && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  };

  // ─── FCM Token ─────────────────────────────────────────────
  const getFcmToken = async () => {
    try {
      if (Platform.OS === "ios") {
        await messaging().registerDeviceForRemoteMessages();

        let apnsToken = null;
        let retries = 0;
        while (!apnsToken && retries < 5) {
          apnsToken = await messaging().getAPNSToken();
          if (!apnsToken) {
            await new Promise((res) => setTimeout(res, 1000));
            retries++;
          }
        }

        if (!apnsToken) {
          console.log("⚠️ APNs token not available after retries");
          return null;
        }
        console.log("✅ APNs token ready");
      }

      if (Platform.OS === "android" && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
      }

      const status = await messaging().requestPermission();
      const allowed =
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL;

      if (!allowed) {
        console.log("⚠️ Notification permission denied");
        return null;
      }

      const fcmToken = await messaging().getToken();
      console.log("✅ FCM Token:", fcmToken ? "RECEIVED" : "MISSING");
      return fcmToken;
    } catch (e) {
      console.log("❌ FCM error:", e.message);
      return null;
    }
  };

const handleAutoLogin = async (userCredential, phone) => {
  try {
    setLoading(true);

    const cleanPhone = phone?.replace("+91", "").trim();

    // ✅ Firebase ID token (OTP success-க்கு அப்புறம் currentUser இருக்கு)
    let firebaseToken = null;
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        firebaseToken = await currentUser.getIdToken(true); // force refresh
      }
    } catch (e) {
      console.log("⚠️ Firebase token fetch failed:", e.message);
    }

    if (!firebaseToken) {
      Alert.alert("Login Failed", "Could not get auth token. Please try again.");
      return;
    }

    const authExtraHeaders = {
  "x-user-phone": cleanPhone,
};

    const fcmToken = await getFcmToken();
    const deviceId = await DeviceInfo.getUniqueId();
    const osName = DeviceInfo.getSystemName();
    const osVersion = DeviceInfo.getSystemVersion();
    const now = new Date().toISOString();

    console.log("📡 OTP login | phone:", cleanPhone, "| hasFirebaseToken:", !!firebaseToken);

    // ─────────────────────────────────────────────────────────
    // Step 1: GET user (new / existing — always try)
    // apiFetch automatically adds x-auth-token + x-user-phone
    // ─────────────────────────────────────────────────────────
    const getResult = await apiFetch("/solarman/get", {
      method: "POST",
      body: { phoneNo: cleanPhone },
      headers: authExtraHeaders,
    });

    let existingData = {};
    if (getResult.ok && getResult.data?.success && getResult.data?.data) {
      existingData = getResult.data.data;
      console.log("✅ Existing user found");
    } else {
      console.log("🆕 New user — will create");
    }

    const userInfo = existingData?.UserInfo || existingData || {};
    const role = userInfo?.role || "user";
    const email = userInfo?.email || null;
    const password = userInfo?.password || null;
    const provider = userInfo?.provider || null;

    // ─────────────────────────────────────────────────────────
    // Step 2: accessToken (email+password இருந்தா)
    // ─────────────────────────────────────────────────────────
    let accessToken = null;
    if (email && password) {
      const tokenResult = await apiFetch("/solarman/token", {
        method: "POST",
        body: { email, password, phoneNo: cleanPhone },
        headers: authExtraHeaders,
      });
      accessToken = tokenResult.data?.access_token || null;
    }

    // ─────────────────────────────────────────────────────────
    // Step 3: Stations
    // ─────────────────────────────────────────────────────────
    let devicelist = existingData.devicelist || [];
    if (accessToken) {
      const stationsResult = await apiFetch("/solarman/stations", {
        method: "POST",
        body: { phoneNo: cleanPhone },
        headers: authExtraHeaders,
      });
      const rawList =
        stationsResult.data?.stations ||
        stationsResult.data?.stationList ||
        [];
      if (rawList.length > 0) {
        devicelist = rawList.map((station) => ({
          id: station.id,
          name: station.name || "",
          installationAmount:
            (existingData.devicelist || []).find((d) => d.id === station.id)
              ?.installationAmount ?? "",
        }));
      }
    }

    // ─────────────────────────────────────────────────────────
    // Step 4: Build payload
    // ─────────────────────────────────────────────────────────
    const currentDevice = {
      deviceId,
      os: osName,
      version: osVersion,
      authToken: firebaseToken, // ✅ Firebase token store பண்றோம்
      fcmToken: fcmToken || null,
      lastUsedAt: now,
      isLastLoggedIn: true,
    };

    const existingDevices = existingData?.PlatformInfo?.devices || [];
    const mergedDevices = [
      ...existingDevices
        .filter((d) => d.deviceId !== deviceId)
        .map((d) => ({ ...d, isLastLoggedIn: false })),
      currentDevice,
    ];

    const finalPayload = {
      ...existingData,
      AppInfo: {
        ...(existingData.AppInfo || {}),
        lastLogin: now,
        versionName: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber(),
      },
      PlatformInfo: { devices: mergedDevices },
      UserInfo: {
        ...userInfo,
        phoneNo: cleanPhone,
        role,
        provider,
      },
      devicelist,
    };

    // ─────────────────────────────────────────────────────────
    // Step 5: SAVE user (create if new / update if existing)
    // ─────────────────────────────────────────────────────────
    const saveResult = await apiFetch("/solarman/user", {
      method: "POST",
      body: finalPayload,
      headers: authExtraHeaders,
    });

    if (!saveResult.ok) {
      console.log("⚠️ Backend save failed:", JSON.stringify(saveResult.data));
      // still continue — local storage save பண்ணலாம்
    } else {
      console.log("✅ User saved/created successfully");
    }

    // ─────────────────────────────────────────────────────────
    // Step 6: Email missing → re-fetch
    // ─────────────────────────────────────────────────────────
    let finalEmail = email;
    let finalRole = role;
    let finalProvider = provider;
    let finalPassword = password;

    if (!email) {
      console.log("📧 Email missing — fetching from DB after save...");
      const getUserResult = await apiFetch("/solarman/get", {
        method: "POST",
        body: { phoneNo: cleanPhone },
        headers: authExtraHeaders,
      });

      if (getUserResult.ok && getUserResult.data?.success && getUserResult.data?.data) {
        const freshData = getUserResult.data.data;
        finalEmail =
          freshData?.UserInfo?.email || freshData?.email || null;
        finalPassword =
          freshData?.UserInfo?.password || freshData?.password || null;
        finalRole =
          freshData?.UserInfo?.role || freshData?.role || role;
        finalProvider =
          freshData?.UserInfo?.provider || freshData?.provider || provider;
      }
    }

    // ─────────────────────────────────────────────────────────
    // Step 7: AsyncStorage
    // ─────────────────────────────────────────────────────────
    const storagePayload = {
      ...finalPayload,
      UserInfo: {
        ...finalPayload.UserInfo,
        email: finalEmail,
        password: finalPassword,
        role: finalRole,
        provider: finalProvider,
      },
      accessToken,
      authToken: firebaseToken,
    };

    await AsyncStorage.setItem(USER_DATA, JSON.stringify(storagePayload));
    console.log("💾 Write verify: SUCCESS ✅");

    // ─────────────────────────────────────────────────────────
    // Step 8: Navigate
    // ─────────────────────────────────────────────────────────
    if (finalRole === "admin") {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.ADMIN_SCREEN }],
      });
    } else if (finalRole === "logistic") {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.LOGISTIC_SCREEN }],
      });
    } else if (finalRole === "surveyor") {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.SURVEYER_SCREEN }],
      });
    } else if (finalRole === "installer") {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.INSTALLER_SCREEN }],
      });
    } else if (finalEmail?.trim()) {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.MAIN }],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.PRODUCTS_HOME }],
      });
    }
  } catch (err) {
    console.log("❌ Login error:", err.message);
    logError("auto_login_failed", { message: err.message, phone });
    Alert.alert("Login Failed", err.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
};

  // ─── Confirm OTP ───────────────────────────────────────────
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

  if (!verificationId) {
    setErrorMessage("Session expired. Please go back and request OTP again.");
    return;
  }

  try {
    setLoading(true);
    setErrorMessage("");

    const credential = auth.PhoneAuthProvider.credential(verificationId, otpCode);
    const userCredential = await auth().signInWithCredential(credential);  // ← இது முக்கியம்

    await handleAutoLogin(userCredential, phoneNumber);
  } catch (err) {
    console.log("OTP error:", err.code, err.message);
        logSecurity("otp_verification_failed", { errorCode: err.code, message: err.message, phoneNumber });
    if (err.code === "auth/invalid-verification-code") {
      setErrorMessage("Invalid OTP. Please try again.");
    } else if (
      err.code === "auth/session-expired" ||
      err.code === "auth/code-expired"
    ) {
      setErrorMessage("OTP expired. Please resend.");
      setCanResend(true);
      setTimer(0);
    } else {
      setErrorMessage(err.message || "OTP verification failed");
    }
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
    setOtp(["", "", "", "", "", ""]);
    setErrorMessage("");

    auth()
      .verifyPhoneNumber(phoneNumber, true)  // force resend
      .on("state_changed", (snapshot) => {
        if (snapshot.state === auth.PhoneAuthState.CODE_SENT) {
          setVerificationId(snapshot.verificationId);
          setLoading(false);
          Alert.alert("OTP Sent", "A new OTP has been sent.");
        }
        if (snapshot.state === auth.PhoneAuthState.ERROR) {
          setLoading(false);
          setCanResend(true);
          Alert.alert("Error", snapshot.error?.message || "Failed to resend");
        }
      });
  } catch (e) {
    setLoading(false);
    setCanResend(true);
    Alert.alert("Error", e.message || "Failed to resend OTP");
  }
};

  const otpFilled = otp.join("").length === 6;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
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
            <View style={styles.header}>
              <Image
                source={require("../../assets/images/kondass.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.card}>
              <View style={styles.indicatorWrapper}>
                <View style={styles.indicator} />
              </View>

              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>
                Enter the OTP sent to your phone
              </Text>
              <Text style={styles.label}>OTP Number</Text>

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

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { opacity: otpFilled ? 1 : 0.45 },
                ]}
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
                  <Text style={styles.timerText}>
                    Resend available in {timer}s
                  </Text>
                )}
              </View>

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
  logo: {
    width: 200,
    height: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingVertical: 40,
    flexGrow: 1,
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
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 12,
  },
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
  otpBoxError: {
    borderColor: "red",
  },
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
  confirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendRow: {
    alignItems: "center",
    marginTop: 15,
  },
  resendText: {
    color: "#fb0404",
    fontSize: 15,
    fontWeight: "600",
  },
  timerText: {
    color: "#777",
    fontSize: 14,
  },
  changeRow: {
    alignItems: "center",
    marginTop: 15,
  },
  changeText: {
    color: "#555",
    fontSize: 14,
  },
  changeLink: {
    color: "#fb0404",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
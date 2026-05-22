import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from "@react-native-firebase/auth";
import NetInfo from "@react-native-community/netinfo";
import Loader from "../components/Loader";
import { storeData, getStorageData, USER_DATA } from "../service/localStorage";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from "../constants/screenNames";
import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";

const LoginScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const slideAnim = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    if (__DEV__) {
  auth().settings.appVerificationDisabledForTesting = true;
}
  }, []);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);

      if (!state.isConnected) {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => unsubscribe();
  }, [slideAnim]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const savedData = await getStorageData(USER_DATA);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          const savedPhone = parsed?.UserInfo?.phoneNo || "";
          setPhoneNumber(savedPhone);
        }
      } catch (error) {
        console.log("Error loading saved phone number:", error);
      }
    };
    fetchUserData();
  }, []);

const handleSendOTP = async () => {
  if (loading) return;

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    Alert.alert("No Internet", "No network connection available");
    return;
  }

  if (phoneNumber.trim().length !== 10) {
    Alert.alert("Error", "Enter a valid 10-digit phone number");
    return;
  }

  try {
    setLoading(true);
    const fullNumber = "+91" + phoneNumber.trim();

    // ✅ FIX: iOS APNs token refresh — Chrome open ஆவதை தடுக்கும்
    if (Platform.OS === "ios") {
      try {
        await messaging().registerDeviceForRemoteMessages();
        await messaging().getAPNSToken();
        console.log("✅ APNs token refreshed");
      } catch (e) {
        console.log("⚠️ APNs refresh warning:", e.message);
        // Error வந்தாலும் continue பண்ணும் — crash ஆகாது
      }
    }

    // ✅ FIX: verifyPhoneNumber → signInWithPhoneNumber (forceResend: true)
    const confirmation = await auth().signInWithPhoneNumber(fullNumber, true);

    setLoading(false);
    navigation.navigate(SCREEN_NAMES.OTP, {
      confirmation,                              // ✅ OtpScreen already use பண்றது
      verificationId: confirmation.verificationId,
      phoneNumber: fullNumber,
    });

  } catch (err) {
    setLoading(false);
    console.log("❌ OTP send error:", err.message);
    Alert.alert("Error", err.message);
  }
};

 return (
    <View style={{ flex: 1 }}>
      {/* 2. TRANSLUCENT STATUS BAR: This allows the gradient to sit underneath the clock */}
      <StatusBar 
        translucent 
        backgroundColor="transparent" 
        barStyle="light-content" 
      />

      {/* 3. WRAP EVERYTHING IN THE GRADIENT SO IT COVERS THE TOP AREA */}
      <LinearGradient
        colors={['#F00001', '#B00100']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <Animated.View
            style={[styles.netBanner, { transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={styles.netBannerText}>No Internet Connection</Text>
          </Animated.View>

          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }} 
            keyboardShouldPersistTaps="handled"
          >
            {/* 4. HEADER: Removed extra LinearGradient here since parent already has it */}
            <View style={styles.header}>
              <Image
                source={require("../../assets/images/kondass.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          {/* WHITE CONTAINER */}
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
                maxLength={10}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, "");
                  setPhoneNumber(cleaned);
                }}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.otpButton,
                { opacity: phoneNumber.length === 10 && isConnected ? 1 : 0.5 }
              ]}
              disabled={phoneNumber.length !== 10 || !isConnected}
              onPress={handleSendOTP}
            >
              <Text style={styles.otpButtonText}>Send OTP</Text>
            </TouchableOpacity>


            <Text style={styles.termsText}>
              By signing up you are accepting the{" "}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.navigate(SCREEN_NAMES.TERMS_CONDITIONS)}
              >
                Terms & Conditions
              </Text>
            </Text>
          </View>
        </ScrollView>

        {loading && <Loader />}
      </SafeAreaView>
      </LinearGradient>
      </View>

  );
};
export default LoginScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  netBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#B50203",
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 999,
  },
  netBannerText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  header: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom:40,
  },
  logo: {
    width: 200,
    height: 100,
  },
  bottomContainer: {
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
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#000",
  },
  otpButton: {
    backgroundColor: "#444",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  otpButtonText: {
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

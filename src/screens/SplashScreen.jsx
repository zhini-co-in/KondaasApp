import React, { useEffect } from 'react';
import {
  Image,
  Text,
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Kondaas } from '../constants/ImageConstant';
import FontStyles from '../constants/fonts';

import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage"; 

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const checkUserData = async () => {
      try {
        console.log("🔍 Checking AsyncStorage for USER_DATA...");

        const storedData = await AsyncStorage.getItem(USER_DATA);

        if (!storedData) {
          console.log("❌ No USER_DATA found → Navigating to Intro");
          navigation.replace("Intro");
          return;
        }

        console.log("✅ USER_DATA found:", storedData);

        const userData = JSON.parse(storedData);
        const lastLogin = userData?.AppInfo?.lastLogin;
        const deviceId = userData?.UserInfo?.deviceId;

        console.log("📆 lastLogin:", lastLogin);
        console.log("🔧 deviceId:", deviceId);

        if (!lastLogin) {
          console.log("⚠️ lastLogin missing → Navigating to Intro");
          navigation.replace("Intro");
          return;
        }

        const lastLoginDate = new Date(lastLogin);
        const currentDate = new Date();
        const diffInDays = (currentDate - lastLoginDate) / (1000 * 60 * 60 * 24);

        console.log("🕒 Current Date:", currentDate.toISOString());
        console.log("🕓 Last Login Date:", lastLoginDate.toISOString());
        console.log(`📅 Difference: ${diffInDays.toFixed(2)} days`);

        // If last login > 30 days → clear storage and go to Intro
        if (diffInDays > 30) {
          console.log("🚫 Last login older than 30 days → Clearing storage & going to Intro");
          await AsyncStorage.removeItem(USER_DATA);
          navigation.replace("Intro");
          return;
        }

        // ✅ Check for deviceId presence
        if (deviceId && deviceId.trim() !== "") {
          console.log("✅ Device ID found → Navigating to mainScreen");
          navigation.reset({
            index: 0,
            routes: [{ name: "mainScreen" }],
          });
        } else {
          console.log("⚠️ No deviceId found → Navigating to ProductsHomeScreen");
          navigation.reset({
            index: 0,
            routes: [{ name: "ProductsHomeScreen" }],
          });
        }
      } catch (error) {
        console.log("❗ Error checking user data:", error);
        navigation.replace("Intro");
      }
    };

    const timeout = setTimeout(() => {
      checkUserData();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [navigation]);


  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fb0404" barStyle="light-content" />

      <View style={styles.imageContainer}>
        <Image
          source={Kondaas}
          style={styles.centerImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.bottomText}>Powered by Trisentrix | Version 1.0</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fb0404',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerImage: {
    width: 250,
    height: 250,
  },
  bottomText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: FontStyles.POPPINS500,
    fontWeight: '400',
    padding: 12,
  },
});

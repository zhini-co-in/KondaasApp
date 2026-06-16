import React, { useEffect } from 'react';
import {
  Image,
  Text,
  View,
  StyleSheet,
  StatusBar,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Kondaas } from '../constants/ImageConstant';
import FontStyles from '../constants/fonts';

import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage";
import LinearGradient from 'react-native-linear-gradient';
import { SCREEN_NAMES } from '../constants/screenNames';

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const checkUserData = async () => {
      try {
        console.log(" Checking AsyncStorage for USER_DATA...");

        const storedData = await AsyncStorage.getItem(USER_DATA);

        if (!storedData) {
          console.log("No USER_DATA found → Navigating to Intro");
          navigation.replace(SCREEN_NAMES.INTRO);
          return;
        }

        console.log(" USER_DATA found:", storedData);

        const userData = JSON.parse(storedData);
        const lastLogin = userData?.AppInfo?.lastLogin;
        const deviceId = userData?.UserInfo?.deviceId;
        const email = userData?.UserInfo?.email;
        const password = userData?.UserInfo?.password;
        const unitsrupees = userData?.UserInfo?.unitsrupees;
        const role =
  userData?.UserInfo?.role ||      // OtpScreen save பண்றது இங்கே
  userData?.UserInfo?.Role ||
  userData?.userroles?.role ||
  "";
        console.log("User Role:", role);
        console.log("lastLogin:", lastLogin);
        console.log("deviceId:", deviceId);
        console.log("unitId:", unitsrupees);

        if (!lastLogin) {
          console.log("lastLogin missing → Navigating to Intro");
          navigation.replace(SCREEN_NAMES.INTRO);
          return;
        }

        const lastLoginDate = new Date(lastLogin);
        const currentDate = new Date();
        const diffInDays = (currentDate - lastLoginDate) / (1000 * 60 * 60 * 24);

        console.log("🕒 Current Date:", currentDate.toISOString());
        console.log("🕓 Last Login Date:", lastLoginDate.toISOString());
        console.log(`📅 Difference: ${diffInDays.toFixed(2)} days`);

        if (diffInDays > 30) {
          console.log("🚫 Last login older than 30 days → Clearing storage & going to Intro");
          await AsyncStorage.removeItem(USER_DATA);
          navigation.replace(SCREEN_NAMES.INTRO);
          return;
        }

        // ROLE BASED NAVIGATION
// ROLE BASED NAVIGATION
// புதுசு
if (role === "admin") {
  console.log("Admin role detected → Navigating to Admin Screen");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.ADMIN_SCREEN }],
  });
} else if (role === "logistic") {
  console.log("Logistic role detected → Navigating to Logistic Screen");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.LOGISTIC_SCREEN }],
  });
<<<<<<< Updated upstream
}  else if (role === "installer") {
  console.log("Installer role detected → Navigating to Installer Screen");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.INSTALLER_SCREEN }],
  });
}  else if (role === "surveyer") {
=======
} else if (role === "surveyor") {
>>>>>>> Stashed changes
  console.log("Surveyer role detected → Navigating to Surveyer Screen");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.SURVEYER_SCREEN }],
  });
} else if (email && email.trim() !== "" && password && password.trim() !== "") {
  console.log("Normal user → Navigating to Main");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.MAIN }],
  });
} else {
  console.log("No login → Navigating to ProductsHome");
  navigation.reset({
    index: 0,
    routes: [{ name: SCREEN_NAMES.PRODUCTS_HOME }],
  });
}
      } catch (error) {
        console.log("❗ Error checking user data:", error);
        navigation.replace(SCREEN_NAMES.INTRO);
      }
    };

    const timeout = setTimeout(() => {
      checkUserData();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [navigation]);


  return (
    <LinearGradient
  colors={['#F00001', '#B00100']}
  start={{ x: 0.5, y: 0 }}
  end={{ x: 0.5, y: 1 }}
  style={[styles.container, { paddingTop: StatusBar.currentHeight }]}
>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.imageContainer}>
        <Image
          source={Kondaas}
          style={styles.centerImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.bottomText}>Powered by Trisentrix | Version 1.0</Text>
    </LinearGradient>
  );
};


export default SplashScreen;

const styles = StyleSheet.create({
  container: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
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
    position: 'absolute', 
    bottom: Platform.OS === 'ios' ? 65 : 45, 
    textAlign: 'center',
    width: '100%',
  },
});

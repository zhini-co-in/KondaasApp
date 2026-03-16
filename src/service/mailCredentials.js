import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import CryptoJS from "crypto-js";
import { USER_DATA } from "./localStorage";

export const saveMailCredentials = async (email, password) => {
  try {
    if (!email || !password) {
      return { success: false, message: "Please enter email and password" };
    }

    const storedData = await AsyncStorage.getItem(USER_DATA);
    const parsedData = storedData ? JSON.parse(storedData) : null;

    const phoneNo = parsedData?.UserInfo?.phoneNo;

    if (!phoneNo) {
      return { success: false, message: "Phone number not found" };
    }

    const hashedPassword = CryptoJS.SHA256(password).toString();

    await firestore()
      .collection("userDetails")
      .doc(phoneNo)
      .update({
        "UserInfo.email": email,
        "UserInfo.password": hashedPassword,
      });

    return { success: true, message: "Credentials saved successfully" };

  } catch (error) {
    console.log("Mail Credential Error:", error);
    return { success: false, message: "Failed to save credentials" };
  }
};
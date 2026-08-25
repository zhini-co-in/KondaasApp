import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import { USER_DATA } from "./localStorage";

export const saveMailCredentials = async (email, password) => {
  try {
    if (!email || !password) {
      return { success: false, message: "Please enter email and password" };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { success: false, message: "Please enter a valid email address" };
    }

    const storedData = await AsyncStorage.getItem(USER_DATA);
    const parsedData = storedData ? JSON.parse(storedData) : null;

    const phoneNo = parsedData?.UserInfo?.phoneNo || parsedData?.id;
    console.log("📱 Phone No:", phoneNo);

    if (!phoneNo) {
      return { success: false, message: "Session expired. Please login again." };
    }

    const hashedPassword = CryptoJS.SHA256(password).toString();

    const payload = {
      ...parsedData,
      UserInfo: {
        ...parsedData.UserInfo,
        phoneNo,
        email,
        password: hashedPassword,   // ✅ DB-க்கு hashed
        plainPassword: password,     // ✅ Solarman token-க்கு — local only
      },
    };

    console.log("📤 Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://kondaas.atom8itsolutions.com/solarman/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.log("❌ API Error:", errBody);
      return { success: false, message: "Server error: " + errBody };
    }

    const updatedData = await response.json();
    console.log("✅ API Response:", updatedData);

    // ✅ AsyncStorage-ல plainPassword-உம் save ஆகும்
    await AsyncStorage.setItem(USER_DATA, JSON.stringify(payload));

    return { success: true, message: "Credentials saved successfully" };

  } catch (error) {
    console.log("❌ Mail Credential Error:", error);
    return { success: false, message: "Failed to save credentials" };
  }
};
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@SolarApp:selectedStationId";

export const saveStationId = async (id) => {
  try {
    await AsyncStorage.setItem(KEY, String(id)); // ✅ MUST STRING
    console.log("✅ Station ID Saved:", id);
  } catch (e) {
    console.log("❌ Save StationId Error", e);
  }
};

export const getStationId = async () => {
  try {
    const id = await AsyncStorage.getItem(KEY);
    console.log("📥 Station ID Loaded:", id);
    return id;
  } catch (e) {
    console.log("❌ Get StationId Error", e);
    return null;
  }
};

export const clearStationId = async () => {
  try {
    await AsyncStorage.removeItem(KEY);
    console.log("🗑 Station ID Cleared");
  } catch (e) {
    console.log("❌ Clear StationId Error", e);
  }
};
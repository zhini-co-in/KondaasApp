import AsyncStorage from "@react-native-async-storage/async-storage";

export const USER_DATA = "user_data";
export const IsLackCallsShown = "isLackCallsShown";

export const storeData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
    console.log("Data stored succesfully ", key + "-" + value);
  } catch (e) {
    console.log("Error Storing Data in Async");
  }
};

export const getStorageData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value;
  } catch (e) {
  }
};

export const clearStorage = async () => {
  AsyncStorage.clear();
  console.log(AsyncStorage.getAllKeys);
};
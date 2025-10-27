import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Alert,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { USER_DATA } from "../service/localStorage"; // your storage key
import Loader from '../components/Loader';

const ReferFriendScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch product list
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snapshot = await firestore().collection("productList").get();
        if (!snapshot.empty) {
          const productData = snapshot.docs.map((doc) => ({
            id: doc.id,
            title: doc.data().title,
          }));
          setProducts(productData);
        } else {
          console.log("⚠️ No products found in Firestore");
        }
      } catch (error) {
        console.error("❌ Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  // Handle Refer
const handleRefer = async () => {
  if (!name || !mobile || !product) {
    Alert.alert("Missing Info", "Please fill all fields before submitting.");
    return;
  }

  try {
    setLoading(true);

    const userDataJson = await AsyncStorage.getItem(USER_DATA);
    const userData = userDataJson ? JSON.parse(userDataJson) : null;

    console.log("🧠 Parsed USER_DATA object:", userData);

    const refererPhNo =
      userData?.UserInfo?.phoneNo ||
      userData?.phoneNumber ||
      userData?.mobile ||
      "";

    console.log("📱 Extracted refererPhNo:", refererPhNo);

    if (!refererPhNo) {
      Alert.alert("Error", "Referer phone number missing in user data.");
      return;
    }

    const salesId = firestore().collection("Referrals").doc().id;

    const referralData = {
      salesId,
      refererPhNo,
      friendPhNo: mobile,
      friendName: name,
      status: null,
      bonusAmount: null,
      amountCredited: null,
      description: null,
      productID: product,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore().collection("Referrals").doc(salesId).set(referralData);

    Alert.alert("✅ Success", "Referral submitted successfully!");
    setName("");
    setMobile("");
    setProduct("");
  } catch (error) {
    console.error("❌ Error saving referral:", error);
    Alert.alert("Error", "Something went wrong while submitting referral.");
  } finally {
    setLoading(false);
  }
};



 return (
  <SafeAreaView style={styles.container}>
    <StatusBar backgroundColor="#fff" barStyle="dark-content" />

    {/* 🔄 Loader Overlay */}
    {loading && <Loader />}

    {/* Header */}
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Refer Friends</Text>
    </View>

    {/* Form */}
    <ScrollView contentContainerStyle={styles.formContainer}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your friend's name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Mobile</Text>
      <TextInput
        style={styles.input}
        placeholder="+91 XXXXX XXXXX"
        keyboardType="phone-pad"
        value={mobile}
        onChangeText={setMobile}
      />

      <Text style={styles.label}>Interested Product</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={product}
          onValueChange={(itemValue) => setProduct(itemValue)}
          mode="dropdown"
          style={styles.picker}
        >
          <Picker.Item label="Select Product" value="" />
          {products.map((item) => (
            <Picker.Item key={item.id} label={item.title} value={item.id} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.referBtn}
        onPress={handleRefer}
        disabled={loading}
      >
        <Text style={styles.referBtnText}>
          {loading ? "Submitting..." : "Refer"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
);

};



export default ReferFriendScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#000" },

  formContainer: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    color: "#555",
    marginTop: 15,
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    height: 48,
    color: "#333",
  },
  referBtn: {
    backgroundColor: "#E60000",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 30,
  },
  referBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

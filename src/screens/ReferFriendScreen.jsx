import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage";
import Loader from "../components/Loader";
import Contacts from "react-native-contacts";
import { PermissionsAndroid, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import NetInfo from "@react-native-community/netinfo";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from "../constants/screenNames";

const BASE_URL = "https://board.trisentrix.com";

const ReferFriendScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showList, setShowList] = useState(false);

  // ─── Product list is still fetched from Firestore (unchanged) ───
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
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

  // ─── Contacts permission + load ───
  useEffect(() => {
    const getContacts = async () => {
      try {
        if (Platform.OS === "android") {
          const permission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS
          );
          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert("Permission denied", "Cannot access contacts");
            return;
          }
        }
        const allContacts = await Contacts.getAll();
        const contactList = allContacts
          .filter((c) => c.phoneNumbers.length > 0)
          .map((c) => ({
            name: c.displayName,
            number: c.phoneNumbers[0].number.replace(/\s+/g, ""),
          }));
        setContacts(contactList);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
    };
    getContacts();
  }, []);

  const handleNameSearch = (text) => {
    setName(text);
    if (text.length > 0) {
      const filtered = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(text.toLowerCase()) ||
          c.number.replace(/\D/g, "").includes(text)
      );
      setFilteredContacts(filtered.slice(0, 5));
      setShowList(true);
    } else {
      setShowList(false);
    }
  };

  const handleSearch = (text) => {
    const cleaned = text.replace(/[^0-9]/g, "").slice(0, 10);
    setMobile(cleaned);
    if (cleaned.length > 0) {
      const filtered = contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(cleaned.toLowerCase()) ||
          c.number.replace(/\D/g, "").includes(cleaned)
      );
      setFilteredContacts(filtered.slice(0, 5));
      setShowList(true);
    } else {
      setShowList(false);
    }
  };

  const selectContact = (contact) => {
    const cleanedNumber = contact.number.replace(/\D/g, "").slice(-10);
    setMobile(cleanedNumber);
    setName(contact.name);
    setShowList(false);
  };

  const handleRefer = async () => {
    const net = await NetInfo.fetch();
const isOffline = net.isConnected === false || net.isInternetReachable === false;
if (isOffline) return;
    if (!net.isConnected) {
      alert("No network connection available");
      return;
    }
    if (!name || !mobile || !product) {
      Alert.alert("Missing Info", "Please fill all fields before submitting.");
      return;
    }
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      Alert.alert("Invalid Mobile Number", "Enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setLoading(true);

      // ─── Get referer phone from AsyncStorage ───
      const userDataJson = await AsyncStorage.getItem(USER_DATA);
      const userData = userDataJson ? JSON.parse(userDataJson) : null;
      const refererPhNo =
        userData?.UserInfo?.phoneNo ||
        userData?.phoneNumber ||
        userData?.mobile ||
        "";
      if (!refererPhNo) {
        Alert.alert("Error", "Referer phone number missing in user data.");
        return;
      }

      // ─── Check duplicate via your API ───
      const checkRes = await fetch(
        `${BASE_URL}/referral/get?refererPhNo=${encodeURIComponent(refererPhNo)}`
      );
      const checkData = await checkRes.json();
      if (checkData.success && checkData.data?.length) {
        const alreadyReferred = checkData.data.some(
          (r) => r.friendPhNo === mobile
        );
        if (alreadyReferred) {
          Alert.alert(
            "Already Exists",
            "This mobile number has already been referred."
          );
          setLoading(false);
          return;
        }
      }

      // ─── Build referral payload ───
      const salesId = `REF-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      const referralPayload = {
        id: salesId,
        salesId,
        refererPhNo,
        friendPhNo: mobile,
        friendName: name,
        productID: product,
        status: "",
        bonusAmount: null,
        amountCredited: null,
        description: null,
        PurchaseAt: "",
        PurchaseTracking: "",
      };

      // ─── POST to your endpoint ───
      const res = await fetch(`${BASE_URL}/referral/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(referralPayload),
      });
      const data = await res.json();

      if (data.success) {
        Alert.alert("Success", "Referral submitted successfully!");
        setName("");
        setMobile("");
        setProduct("");
        navigation.navigate(SCREEN_NAMES.REFER_AND_EARN);
      } else {
        Alert.alert("Error", data.error || "Failed to submit referral.");
      }
    } catch (error) {
      console.error("❌ handleRefer error:", error);
      Alert.alert("Error", "Something went wrong while submitting referral.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      {loading && <Loader />}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer Friends</Text>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.formContainer}>
        <Text style={styles.label}>Mobile</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 XXXXX XXXXX"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={handleSearch}
        />

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your friend's name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={handleNameSearch}
        />

        {showList && (
          <View style={{ maxHeight: 200, marginTop: 8 }}>
            <ScrollView
              style={{
                borderWidth: 1,
                borderColor: "#eee",
                borderRadius: 8,
                backgroundColor: "#fff",
              }}
              nestedScrollEnabled={true}
            >
              {filteredContacts.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => selectContact(item)}
                  style={{
                    padding: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                    backgroundColor: "white",
                  }}
                >
                  <Text style={{ fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: "gray" }}>{item.number}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>Enter a Product</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter interested product"
          placeholderTextColor="#999"
          value={product}
          onChangeText={setProduct}
        />

        <TouchableOpacity onPress={handleRefer} disabled={loading}>
          <LinearGradient
            colors={["#F00001", "#B00100"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.referBtn}
          >
            <Text style={styles.referBtnText}>
              {loading ? "Submitting..." : "Refer"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
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
  formContainer: { padding: 16 },
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
  referBtn: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  referBtnText: { color: "#fff", fontSize: 16, fontWeight: "600", lineHeight: 20 },
});
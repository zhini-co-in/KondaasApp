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
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { USER_DATA } from "../service/localStorage";
import Loader from '../components/Loader';
import Contacts from 'react-native-contacts';
import { PermissionsAndroid, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import NetInfo from "@react-native-community/netinfo";
import LinearGradient from "react-native-linear-gradient";
import { SCREEN_NAMES } from '../constants/screenNames';

const ReferFriendScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showList, setShowList] = useState(false);
  
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
          console.log(" No products found in Firestore");
        }
      } catch (error) {
        console.error(" Error fetching products:", error);
      }
    };
    fetchProducts();
  }, []);

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
      const existingRef = await firestore()
        .collection("referrals")
        .where("friendPhNo", "==", mobile)
        .get();

      if (!existingRef.empty) {
        Alert.alert(
          "Already Exists",
          "This mobile number has already been referred."
        );
        setLoading(false);
        return;
      }
      const salesId = firestore().collection("referrals").doc().id;
      const referralData = {
        salesId,
        refererPhNo,
        friendPhNo: mobile,
        friendName: name,
        status: "",
        bonusAmount: null,
        amountCredited: null,
        description: null,
        PurchaseAt: "",
        PurchaseTracking: "",
        productID: product,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection("referrals").doc(salesId).set(referralData);

      Alert.alert("Success", "Referral submitted successfully!");
      setName("");
      setMobile("");
      setProduct("");
      navigation.navigate(SCREEN_NAMES.REFER_AND_EARN);

    } catch (error) {
      Alert.alert("Error", "Something went wrong while submitting referral.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      {loading && <Loader />}

      {/* 🔹 Header */}
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
        <TouchableOpacity
          onPress={handleRefer}
          disabled={loading}
        >
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
    height: 55,
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  itemStyle: {
    fontSize: 16,
    height: 55,
    lineHeight: 22,
  },
  referBtn: {
    height: 48,
  borderRadius: 8,
  justifyContent: "center",
  alignItems: "center",
  marginTop: 30,
  },
  referBtnText: {
    color: "#fff",
  fontSize: 16,
  fontWeight: "600",
  lineHeight: 20
  },
});

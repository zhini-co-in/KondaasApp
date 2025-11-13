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
  FlatList,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { USER_DATA } from "../service/localStorage";
import Loader from '../components/Loader';
import Contacts from 'react-native-contacts';
import { PermissionsAndroid, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const ReferFriendScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [showList, setShowList] = useState(false);

  // 🔹 Fetch product list
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

  // 🔹 Fetch device contacts
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
    if (!name || !mobile || !product) {
      Alert.alert("Missing Info", "Please fill all fields before submitting.");
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
      const salesId = firestore().collection("Referrals").doc().id;
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

      await firestore().collection("Referrals").doc(salesId).set(referralData);

      Alert.alert("✅ Success", "Referral submitted successfully!");
      setName("");
      setMobile("");
      setProduct("");
      navigation.navigate("ReferandEarnScreen");

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
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={handleSearch}
        />
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your friend's name"
          value={name}
          onChangeText={setName}
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

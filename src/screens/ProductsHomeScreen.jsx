import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { saveMailCredentials } from "../api/api1";
import Loader from "../components/Loader";
import ProfileImg from "../../assets/images/Round.png";
import { getStorageData, USER_DATA } from "../service/localStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCREEN_NAMES } from '../constants/screenNames';

const ProductsHomeScreen = () => {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [showCredentialPopup, setShowCredentialPopup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ─── Phone call ───────────────────────────────────────────────────────────
  const handleCall = () => {
    Linking.openURL("tel:9244414441");
  };

  // ─── Logout — ✅ FIX: AsyncStorage.clear() பண்றோம் ──────────────────────
  // பழைய user cache (SAVINGS_KEY, STATIONS_KEY, TODAY_KEY, LIFETIME_KEY)
  // எல்லாம் clear ஆகும் — new user login பண்ணும்போது fresh data வரும்
  const handleLogout = async () => {
    try {
      setShowLogoutPopup(false);

      // ✅ FIX: removeItem மட்டும் இல்லாம எல்லா cache-உம் clear பண்ணு
      await AsyncStorage.clear();
      console.log("✅ AsyncStorage fully cleared on logout.");

      navigation.reset({
        index: 0,
        routes: [{ name: SCREEN_NAMES.LOGIN }],
      });
    } catch (error) {
      console.error("❌ Error during logout:", error);
    }
  };

  // ─── Load user from AsyncStorage ─────────────────────────────────────────
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await getStorageData(USER_DATA);
        if (data) {
          const parsedData = JSON.parse(data);
          setUserData(parsedData);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    loadUserData();
  }, []);

  // ─── Fetch products from Firestore ────────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snapshot = await firestore()
          .collection("productList")
          .where("isArchived", "==", false)
          .get();

        if (snapshot.empty) {
          setLoading(false);
          return;
        }

        const allProducts = [];
        snapshot.forEach((doc) => {
          allProducts.push({ id: doc.id, ...doc.data() });
        });
        setProducts(allProducts);
      } catch (error) {
        console.error("Firestore error:", error);
        Alert.alert("Error", error.message || "Failed to fetch products");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // ─── Close credential popup ───────────────────────────────────────────────
  const closeCredentialPopup = () => {
    setShowCredentialPopup(false);
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };

  // ─── Save credentials — ✅ FIX: 300ms delay after save ──────────────────
  // saveMailCredentials → AsyncStorage write complete ஆன பிறகு navigate பண்ணு
  // இல்லன்னா MainScreen-ல் USER_DATA read பண்ணும்போது stale/empty வரும்
  const handleSaveCredentials = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    const result = await saveMailCredentials(email.trim(), password);

    if (result.success) {
      Alert.alert("Success", result.message, [
        {
          text: "OK",
          onPress: async () => {
            closeCredentialPopup();

            // ✅ FIX: AsyncStorage write flush ஆக 300ms wait பண்ணு
            await new Promise(resolve => setTimeout(resolve, 300));

            navigation.reset({
              index: 0,
              routes: [{ name: SCREEN_NAMES.MAIN }],
            });
          },
        },
      ]);
    } else {
      Alert.alert("Error", result.message);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <Image source={ProfileImg} style={styles.profileImg} />
            <View>
              <Text style={styles.profileName}>
                {userData?.UserInfo?.name || "Guest User"}
              </Text>
            </View>
          </View>
          <View style={styles.iconRow}>
            <TouchableOpacity
              style={styles.iconBox}
              onPress={() => setShowLogoutPopup(true)}
            >
              <Ionicons name="log-out-outline" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* No Device Section */}
        <View style={styles.noDeviceContainer}>
          <Text style={styles.noDeviceTitle}>No Device Configured</Text>
          <Text style={styles.contactAdminText}>Contact Admin</Text>
          <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
            <Text style={styles.contactBtnText}>Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addCredentialBtn, { marginTop: 12 }]}
            onPress={() => setShowCredentialPopup(true)}
          >
            <Text style={styles.addCredentialText}>Add Credentials</Text>
          </TouchableOpacity>
        </View>

        {/* Product Section */}
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Our Products</Text>
          {products.length === 0 ? (
            <Text style={{ textAlign: "center", color: "#888" }}>
              No products available
            </Text>
          ) : (
            products.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.productCard}
                onPress={() =>
                  navigation.navigate(SCREEN_NAMES.PRODUCT_DETAIL, { product: item })
                }
              >
                <Image source={{ uri: item.imageURL }} style={styles.productImg} />
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.title}</Text>
                  {item.offer ? (
                    <View style={styles.offerBadge}>
                      <Text style={styles.offerText}>{item.offer}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Logout Modal */}
        <Modal
          transparent
          visible={showLogoutPopup}
          animationType="fade"
          onRequestClose={() => setShowLogoutPopup(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.popupBox}>
              <Ionicons name="log-out-outline" size={45} color="#f15b5d" />
              <Text style={styles.popupText}>Are you sure want to logout?</Text>
              <View style={styles.popupButtons}>
                <TouchableOpacity style={styles.yesButton} onPress={handleLogout}>
                  <Text style={styles.yesText}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.noButton}
                  onPress={() => setShowLogoutPopup(false)}
                >
                  <Text style={styles.noText}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Credentials Modal */}
        <Modal
          transparent
          visible={showCredentialPopup}
          animationType="fade"
          onRequestClose={closeCredentialPopup}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.popupBox}>
              <Ionicons name="mail-outline" size={40} color="#4A90E2" />
              <Text style={styles.popupTitle}>Add Credentials</Text>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#999" />
                <TextInput
                  placeholder="Enter registered device email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#999" />
                <TextInput
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.popupButtons}>
                <TouchableOpacity style={styles.noButton} onPress={closeCredentialPopup}>
                  <Text style={styles.noText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.yesButton} onPress={handleSaveCredentials}>
                  <Text style={styles.yesText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
      {loading && <Loader />}
    </SafeAreaView>
  );
};

export default ProductsHomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileImg: { width: 35, height: 35, borderRadius: 20, marginRight: 10 },
  profileName: { fontSize: 15, fontWeight: "600", color: "#000" },
  iconRow: { flexDirection: "row" },
  iconBox: { marginLeft: 10 },

  noDeviceContainer: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginBottom: 10,
  },
  noDeviceTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  contactAdminText: { color: "#777", marginTop: 6, marginBottom: 20 },
  contactBtn: {
    backgroundColor: "#e60000",
    paddingVertical: 10,
    paddingHorizontal: 150,
    borderRadius: 6,
  },
  contactBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  productsSection: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  productImg: { width: 85, height: 65, borderRadius: 8, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: "600", color: "#000" },
  offerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ffa500",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 5,
  },
  offerText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupBox: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 25,
    paddingHorizontal: 20,
    alignItems: "center",
    elevation: 10,
  },
  popupText: {
    fontSize: 16,
    color: "#333",
    marginVertical: 15,
    textAlign: "center",
  },
  popupTitle: { fontSize: 18, fontWeight: "600", marginVertical: 10 },
  popupButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 20,
  },
  yesButton: {
    backgroundColor: "#f15b5d",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  noButton: {
    backgroundColor: "#888",
    paddingVertical: 10,
    paddingHorizontal: 25,
    borderRadius: 8,
  },
  yesText: { color: "#fff", fontWeight: "700" },
  noText: { color: "#fff", fontWeight: "700" },

  addCredentialBtn: {
    marginTop: 15,
    backgroundColor: "#e60000",
    paddingVertical: 10,
    paddingHorizontal: 120,
    borderRadius: 6,
  },
  addCredentialText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 12,
    width: "100%",
  },
  input: { flex: 1, height: 45, marginLeft: 8 },
});
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
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

  const handleCall = () => {
    const phoneNumber = "tel:9244414441";
    Linking.openURL(phoneNumber);
  };
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(USER_DATA);
      console.log(" USER_DATA cleared successfully.");
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error(" Error during logout:", error);
    }
  };

  
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
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snapshot = await firestore().collection("productList").where("isArchived", "==", false).get();
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


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <Image source={ProfileImg} style={styles.profileImg} />
            <View>
              <Text style={styles.profileName}>
                {/* Ram kumar */}
                {userData?.UserInfo?.name || "Guest User"}
              </Text>
              <Text style={styles.liveText}>● Live</Text>
            </View>
          </View>
          <View style={styles.iconRow}>
           <TouchableOpacity
  style={styles.iconBox}
  onPress={() => setShowLogoutPopup(true)}
>
  <Ionicons name="log-out-outline" size={22} color="#000" />
</TouchableOpacity>

            {/* <TouchableOpacity style={styles.iconBox}>
              <Ionicons name="document-text-outline" size={22} color="#000" />
            </TouchableOpacity> */}
          </View>
        </View>

        {/* No Device Section */}
        <View style={styles.noDeviceContainer}>
          <Text style={styles.noDeviceTitle}>No Device Configured</Text>
          <Text style={styles.contactAdminText}>Contact Admin</Text>
          <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
            <Text style={styles.contactBtnText}>Contact</Text>
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

      </ScrollView>
      {loading && <Loader />}
    </SafeAreaView>
  );
};

export default ProductsHomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  liveText: { fontSize: 13, color: "green" },
  iconRow: { flexDirection: "row" },
  iconBox: { marginLeft: 10 },

  // No Device Section
  noDeviceContainer: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginBottom: 10,
  },
  noDeviceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  contactAdminText: {
    color: "#777",
    marginTop: 6,
    marginBottom: 20,
  },
  contactBtn: {
    backgroundColor: "#e60000",
    paddingVertical: 10,
    paddingHorizontal: 150,
    borderRadius: 6,
  },
  contactBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  // Product Section
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
  offerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
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
    popupButtons: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
    },
    yesButton: {
        backgroundColor: "#f15b5d",
        paddingVertical: 10,
        paddingHorizontal: 50,
        borderRadius: 8,
    },
    noButton: {
        backgroundColor: "#888",
        paddingVertical: 10,
        paddingHorizontal: 50,
        borderRadius: 8,
    },
    yesText: { color: "#fff", fontWeight: "700" },
    noText: { color: "#fff", fontWeight: "700" },
});

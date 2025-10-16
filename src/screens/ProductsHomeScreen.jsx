import React from "react";
import {
  View,
  Text,
  Image,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

import ProfileImg from "../../assets/images/Round.png";
import Solar1 from "../../assets/images/Rectangle_solar.png";
import Solar2 from "../../assets/images/Rectangle_plate.png";
import Solar3 from "../../assets/images/Rectangle_solarplate.png";

const ProductsHomeScreen = () => {
  const navigation = useNavigation();

  const products = [
    {
      id: 1,
      name: "Residential Rooftop Solar – OnGrid",
      image: Solar1,
      offer: "Flat 10% OFF",
      color: "#27ae60",
    },
    {
      id: 2,
      name: "Residential Rooftop Solar – OffGrid",
      image: Solar2,
      offer: "Flat 10% OFF",
      color: "#27ae60",
    },
    {
      id: 3,
      name: "Solar Pump",
      image: Solar3,
      offer: "Upto 20% OFF",
      color: "#f39c12",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* --- Header --- */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <Image source={ProfileImg} style={styles.profileImg} />
            <View>
              <Text style={styles.profileName}>Ram Kumar</Text>
              <Text style={styles.liveText}>● Live</Text>
            </View>
          </View>

          <View style={styles.iconRow}>
            <TouchableOpacity style={styles.iconBox}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBox}>
              <Ionicons name="document-text-outline" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- No Device Section --- */}
        <View style={styles.noDeviceSection}>
          <Text style={styles.noDeviceTitle}>No Device Configured</Text>
          <Text style={styles.noDeviceSub}>Contact Admin</Text>
          <TouchableOpacity style={styles.contactButton}>
            <Text style={styles.contactText}>Contact</Text>
          </TouchableOpacity>
        </View>

        {/* --- Product List --- */}
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Our Products</Text>

          {products.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.productCard}
              onPress={() =>
                navigation.navigate("ProductDetailScreen", { product: item })
              }
            >
              <Image source={item.image} style={styles.productImg} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <View
                  style={[styles.offerBadge, { backgroundColor: item.color }]}
                >
                  <Text style={styles.offerText}>{item.offer}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProductsHomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { paddingBottom: 20 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  profileImg: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  profileName: { fontSize: 16, fontWeight: "600", color: "#000" },
  liveText: { fontSize: 13, color: "green", marginTop: 2 },
  iconRow: { flexDirection: "row" },
  iconBox: { marginLeft: 10 },

  noDeviceSection: { alignItems: "center", marginTop: 30 },
  noDeviceTitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  noDeviceSub: { color: "#888", marginTop: 4, marginBottom: 20 },
  contactButton: {
    backgroundColor: "#e60000",
    width: "90%",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  contactText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  productsSection: { marginTop: 30, paddingHorizontal: 15 },
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
  productImg: { width: 80, height: 60, borderRadius: 8, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: "600", color: "#000" },
  offerBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 5,
  },
  offerText: { color: "#fff", fontSize: 11, fontWeight: "600" },
});

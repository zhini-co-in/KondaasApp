import React from "react";
import { View, Text, Image, StyleSheet, ScrollView } from "react-native";

import Solar1 from "../../assets/images/Rectangle_solar.png";
import Solar2 from "../../assets/images/Rectangle_plate.png";
import Solar3 from "../../assets/images/Rectangle_solarplate.png";

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

const SolarList = () => {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Solar Products</Text>
          {products.map((item) => (
            <View key={item.id} style={styles.productCard}>
              <Image source={item.image} style={styles.productImg} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <View
                  style={[styles.offerBadge, { backgroundColor: item.color }]}
                >
                  <Text style={styles.offerText}>{item.offer}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { paddingBottom: 20 },

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

export default SolarList;

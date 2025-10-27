import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";

const SolarList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={{ marginTop: 10 }}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.productsSection}>
          <Text style={styles.productsTitle}>Solar Products</Text>

          {products.length > 0 ? (
            products.map((item) => (
              <View key={item.id} style={styles.productCard}>
                {item.imageURL ? (
                  <Image source={{ uri: item.imageURL }} style={styles.productImg} />
                ) : (
                  <View style={[styles.productImg, styles.placeholderImg]} />
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{item.title}</Text>
                  {item.offer && (
                    <View
                      style={[
                        styles.offerBadge,
                        { backgroundColor: item.color || "#27ae60" },
                      ]}
                    >
                      <Text style={styles.offerText}>{item.offer}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No products available</Text>
          )}
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
  placeholderImg: { backgroundColor: "#ddd" },
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
  noDataText: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SolarList;

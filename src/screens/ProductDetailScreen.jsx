import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

const ProductDetailScreen = ({ navigation, route }) => {
  const [showModal, setShowModal] = useState(false);

  // ✅ Get passed product details from route params
  const { product } = route.params || {};
  // fallback if nothing passed
  const productTitle = product?.title || "Product Title Not Found";
  const productImage = product?.imageURL
    ? { uri: product.imageURL }
    : require("../../assets/images/Rectangle_solar1.png");
  const productOffer = product?.offer || "No Offer";
  const productDescription =
    product?.description ||
    "No description available for this product.";

  const handleEnquire = () => setShowModal(true);
  const handleOk = () => {
    setShowModal(false);
    navigation.navigate("ProductListScreen");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* ✅ Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
      </View>

      {/* ✅ Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.imageContainer}>
          <Image source={productImage} style={styles.productImage} />

          {productOffer !== "No Offer" && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerText}>{productOffer}</Text>
            </View>
          )}

          <Text style={styles.productTitle}>{productTitle}</Text>
        </View>

        <Text style={styles.sectionText}>Product Overview</Text>
        <Text style={styles.detailText}>{productDescription}</Text>

        {/* ✅ Buttons */}
        <TouchableOpacity style={styles.enquireButton} onPress={handleEnquire}>
          <Text style={styles.enquireText}>Enquire Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.referButton}
          onPress={() => navigation.navigate("ReferandEarnScreen")}
        >
          <Text style={styles.referText}>Refer a Friend</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ✅ Modal */}
      <Modal transparent visible={showModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>
              The enquiry request for{" "}
              <Text style={{ fontWeight: "700" }}>{productTitle}</Text> was sent
              successfully.
            </Text>
            <TouchableOpacity style={styles.okButton} onPress={handleOk}>
              <Text style={styles.okButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 15,
    elevation: 4,
  },
  backButton: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 18, fontWeight: "600", color: "#080707ff" },
  scrollContainer: { padding: 20 },

  imageContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 15,
    position: "relative",
  },
  productImage: { width: "100%", height: 180, borderRadius: 10 },
  offerBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#e74c3c",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  offerText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  productTitle: {
    position: "absolute",
    bottom: 10,
    left: 10,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sectionText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "600",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 15,
  },

  enquireButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  enquireText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  referButton: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 30,
  },
  referText: { color: "#000", fontSize: 15, fontWeight: "600" },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBox: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#000",
  },
  okButton: {
    backgroundColor: "red",
    paddingHorizontal: 25,
    paddingVertical: 8,
    borderRadius: 6,
  },
  okButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});

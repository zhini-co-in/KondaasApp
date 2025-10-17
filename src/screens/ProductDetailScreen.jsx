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
import Rectangle_solar1 from "../../assets/images/Rectangle_solar1.png";

const ProductDetailScreen = ({ navigation }) => {
  const [showModal, setShowModal] = useState(false);

  const handleEnquire = () => {

    setShowModal(true);
  };

  const handleOk = () => {
    // Hide modal first
    setShowModal(false);
    // Navigate to ProductsHomeScreen
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
          <Image source={Rectangle_solar1} style={styles.productImage} />
          <View style={styles.offerBadge}>
            <Text style={styles.offerText}>Flat 10% OFF</Text>
          </View>
          <Text style={styles.productTitle}>
            Residential Rooftop Solar – OnGrid
          </Text>
        </View>

        <Text style={styles.sectionText}>
          Enjoy an energy-efficient home with smart Ongrid rooftop solar
          solutions from Kondaas.
        </Text>
        <Text style={styles.detailText}>
          As more homeowners become aware of rising utility bills and the negative environmental impact of fossil fuels, solar power is beginning to dominate the roost as a sustainable energy source.  Kondaas helps you effectively convert your roof into a solar power station. With a one-time investment and our experienced team, you can expect to significantly reduce your energy costs while playing a key role in reducing the carbon footprint of your environment. Yes, you are right. It lasts over 25 years with no fuel costs and little maintenance.
        </Text>

        <Text style={styles.subTitle}>
          Why Kondaas for Ongrid Rooftop Solar Solutions?
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Largest residential solar provider</Text>
          <Text style={styles.bullet}>
            • Ranked top EPC company for 7 years in a row
          </Text>
          <Text style={styles.bullet}>
            • 100000+ satisfied customers and counting
          </Text>
        </View>

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
              The enquiry request was sent successfully.
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
  sectionText: { fontSize: 15, color: "#000", fontWeight: "600", marginBottom: 8 },
  detailText: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 15 },
  subTitle: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 8 },
  bulletList: { marginBottom: 20 },
  bullet: { fontSize: 13, color: "#444", lineHeight: 20, marginBottom: 6 },

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

  /** ---------- MODAL ---------- **/
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

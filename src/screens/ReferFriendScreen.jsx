import React, { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";

const ReferFriendScreen = ({ navigation }) => {
  const [name, setName] = useState("Ramkumar");
  const [mobile, setMobile] = useState("+91 9514583588");
  const [product, setProduct] = useState("Rooftop Solar - Ongrid");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer Friends</Text>
      </View>

      {/* Form */}
      <ScrollView contentContainerStyle={styles.formContainer}>
        {/* Name */}
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your friend's name"
          value={name}
          onChangeText={setName}
        />

        {/* Mobile */}
        <Text style={styles.label}>Mobile</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 XXXXX XXXXX"
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={setMobile}
        />

        {/* Interested Product */}
        <Text style={styles.label}>Interested Product</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={product}
            onValueChange={(itemValue) => setProduct(itemValue)}
            mode="dropdown"
            style={styles.picker}
          >
            <Picker.Item label="Rooftop Solar - Ongrid" value="Rooftop Solar - Ongrid" />
            <Picker.Item label="Rooftop Solar - Offgrid" value="Rooftop Solar - Offgrid" />
            <Picker.Item label="Solar Water Heater" value="Solar Water Heater" />
            <Picker.Item label="Solar Inverter" value="Solar Inverter" />
          </Picker>
        </View>

        {/* Refer Button */}
        <TouchableOpacity style={styles.referBtn}>
          <Text style={styles.referBtnText}>Refer</Text>
        </TouchableOpacity>
      </ScrollView>
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

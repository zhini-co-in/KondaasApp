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

const CreateTicketScreen = ({ navigation }) => {
  const [selectedDevice, setSelectedDevice] = useState("Rooftop Solar - Ongrid");
  const [selectedIssue, setSelectedIssue] = useState("");
  const [description, setDescription] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Support Ticket</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Device */}
        <Text style={styles.label}>Device</Text>
        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedDevice}
            onValueChange={(itemValue) => setSelectedDevice(itemValue)}
            style={styles.picker}
            dropdownIconColor="#000"
          >
            <Picker.Item label="Rooftop Solar - Ongrid" value="Rooftop Solar - Ongrid" />
            <Picker.Item label="Rooftop Solar - Hybrid" value="Rooftop Solar - Hybrid" />
            <Picker.Item label="Rooftop Solar - Offgrid" value="Rooftop Solar - Offgrid" />
          </Picker>
        </View>

        {/* Issue Type */}
        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedIssue}
            onValueChange={(itemValue) => setSelectedIssue(itemValue)}
            style={styles.picker}
            dropdownIconColor="#000"
          >
            <Picker.Item label="Select an Issue Type" value="" />
            <Picker.Item label="System Performance" value="System Performance" />
            <Picker.Item label="Technical Support" value="Technical Support" />
            <Picker.Item label="Billing & Savings" value="Billing & Savings" />
          </Picker>
        </View>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={5}
          placeholder="Please provide detailed information about your issue..."
          placeholderTextColor="#999"
          value={description}
          onChangeText={setDescription}
        />

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton}>
          <Text style={styles.submitButtonText}>Submit Ticket</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreateTicketScreen;

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

  scrollContent: {
    padding: 16,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginTop: 16,
    marginBottom: 6,
  },

  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  picker: {
    height: 50,
    width: "100%",
  },

 
  textArea: {
  borderWidth: 1,
  borderColor: "#ddd",
  borderRadius: 8,
  padding: 12,
  textAlignVertical: "top",
  fontSize: 14,
  color: "#000",
  backgroundColor: "#fff",
  marginBottom: 20,
  height: 160,
},


  submitButton: {
    backgroundColor: "#E60000",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

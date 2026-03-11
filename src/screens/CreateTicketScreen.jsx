import React, { useEffect, useState } from "react";
import {
  View,
  Text,

  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "react-native-vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage";
import Loader from "../components/Loader";
import { fetchStationDevices, fetchStationList } from "../api/api";
import NetInfo from '@react-native-community/netinfo';
import LinearGradient from "react-native-linear-gradient";
const CreateTicketScreen = ({ route, navigation }) => {
  const { stationId } = route.params;
  console.log("CreateTicketScreen Station ID:", stationId);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedIssue, setSelectedIssue] = useState("");
  const [description, setDescription] = useState("");
  const [deviceList, setDeviceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userPhone, setUserPhone] = useState("");
  const [stationList, setStationList] = useState([]);

  useEffect(() => {
    const getUserData = async () => {
      try {
        const data = await AsyncStorage.getItem(USER_DATA);
        if (data) {
          const parsed = JSON.parse(data);

          const extractedPhone =
            parsed?.UserInfo?.phoneNo ||
            parsed?.phoneNo ||
            parsed?.phoneNumber ||
            parsed?.mobile ||
            "Unknown";

          console.log("📱 Extracted phone number:", extractedPhone);

          setUserPhone(extractedPhone);
        } else {
          console.warn("⚠️ No USER_DATA found in AsyncStorage");
          setUserPhone("Unknown");
        }
      } catch (error) {
        console.error(" Error reading user data:", error);
        setUserPhone("Unknown");
      }
    };

    getUserData();
  }, []);

  useEffect(() => {
    const loadDevices = async () => {
      setLoading(true);

      const res = await fetchStationDevices(stationId);

      if (res && res.deviceListItems) {
        const inverterDevices = res.deviceListItems.filter(
          (item) =>
            item.deviceType?.toLowerCase() === "inverter" ||
            item.deviceName?.toLowerCase().includes("inverter")
        );

        setDeviceList(inverterDevices);
      }

      setLoading(false);
    };

    loadDevices();
  }, [stationId]);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setLoading(true);
    const list = await fetchStationList();
    setStationList(list);
    setLoading(false);
  };
  const matchedStation = stationList.find(
    (s) => s.id === stationId
  );

  console.log(" Incoming stationId:", stationId);
  console.log(" StationList:", stationList);
  console.log("Matched Station:", matchedStation);
  console.log(" Station Name:", matchedStation?.name);
  const stationName = matchedStation?.name || "";

  const generateTicketNo = (phone) => {
    const timestamp = Date.now().toString().slice(-6);
    return `TKT-${phone.slice(-4)}-${timestamp}`;
  };
  const handleSubmit = async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      alert("No network connection available");
      return;
    }
    if (!selectedDevice) {
      Alert.alert("Missing Info", "Please select a device.");
      return;
    }

    if (!selectedIssue) {
      Alert.alert("Missing Info", "Please select an issue type.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing Info", "Please enter a description.");
      return;
    }

    try {
      setSubmitting(true);
      const storedData = await AsyncStorage.getItem(USER_DATA);
      const parsedData = storedData ? JSON.parse(storedData) : null;
      const phoneNumber = parsedData?.UserInfo?.phoneNo;

      if (!phoneNumber) {
        Alert.alert("Missing Info", "User phone number not found in storage.");
        setSubmitting(false);
        return;
      }

      const ticketNo = generateTicketNo(phoneNumber);

      await firestore().collection("createTicket").doc(ticketNo).set({
        PhoneNo: phoneNumber,
        TicketNo: ticketNo,
        Description: description.trim(),
        deviceId: selectedDevice,
        createdBy: phoneNumber,
        createdAt: firestore.FieldValue.serverTimestamp(),
        status: "Open",
        assignedTo: "",
        type: selectedIssue,
      });

      Alert.alert(" Success", `Ticket ${ticketNo} has been submitted successfully!`);
      setSelectedDevice("");
      setSelectedIssue("");
      setDescription("");
      navigation.goBack();

    } catch (error) {
      console.error("Error creating ticket:", error);
      Alert.alert("Error", "Failed to create support ticket.");
    } finally {
      setSubmitting(false);
    }
  };



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
        <Text style={styles.label}>
          Device <Text style={{ color: "red" }}>*</Text>
        </Text>
        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedDevice}
            onValueChange={(itemValue) => setSelectedDevice(itemValue)}
            style={styles.picker}
            itemStyle={styles.itemStyle}
            dropdownIconColor="#000"
            enabled={!loading}
          >
            <Picker.Item label="Select a Device" value="" color="#111010ff" />
            {loading ? (
              <Picker.Item />
            ) : deviceList.length > 0 ? (
              deviceList.map((device) => (
                <Picker.Item
                  key={device.deviceId}
                  label={`${device.deviceType} - ${device.deviceId}- ${stationName}`}
                  value={`${device.deviceId}-${stationName}`}

                />
              ))
            ) : (
              <Picker.Item label="No devices available" value="" />
            )}
          </Picker>

        </View>

        {/* Issue Type */}
        <Text style={styles.label}>
          Issue Type <Text style={{ color: "red" }}>*</Text>
        </Text>
        <View style={styles.dropdownContainer}>
          <Picker
            selectedValue={selectedIssue}
            onValueChange={(itemValue) => setSelectedIssue(itemValue)}
            style={styles.picker}
            itemStyle={styles.itemStyle}
            dropdownIconColor="#000"
          >
            <Picker.Item label="Select an Issue Type" value="" />
            <Picker.Item label="System Performance" value="System Performance" />
            <Picker.Item label="Technical Support" value="Technical Support" />
            <Picker.Item label="Billing & Savings" value="Billing & Savings" />
          </Picker>
        </View>

        {/* Description */}
        <Text style={styles.label}>
          Description <Text style={{ color: "red" }}>*</Text>
        </Text>
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
        <TouchableOpacity

          onPress={handleSubmit}
          disabled={submitting}
        >
          <LinearGradient
            colors={["#F00001", "#B00100"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.submitButton}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Submitting..." : "Submit Ticket"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {(loading || submitting) && <Loader />}
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
    height: 55,        // important for TECNO devices
    paddingHorizontal: 10,
    justifyContent: "center",
    color: "#000",
  },
  itemStyle: {
    fontSize: 16,
    height: 55,
    lineHeight: 24,    // prevents text clipping
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

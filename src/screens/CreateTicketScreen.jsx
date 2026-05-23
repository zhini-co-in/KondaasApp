import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  StatusBar,
  Alert,
  Platform,
  Share,
  Modal,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from "react-native-vector-icons/Ionicons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { USER_DATA } from "../service/localStorage";
import Loader from "../components/Loader";
import { fetchStationList } from "../api/api1";
import NetInfo from '@react-native-community/netinfo';
import LinearGradient from "react-native-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const CreateTicketScreen = ({ route, navigation }) => {
  const { stationId } = route.params;
  const [deviceInput, setDeviceInput] = useState("");
  const [selectedIssue, setSelectedIssue] = useState("");
  const [tempIssue, setTempIssue] = useState("");
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stationList, setStationList] = useState([]);

  const issueOptions = [
    { label: "Select an Issue Type", value: "" },
    { label: "System Performance", value: "System Performance" },
    { label: "Technical Support", value: "Technical Support" },
    { label: "Billing & Savings", value: "Billing & Savings" },
  ];

  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);
        const list = await fetchStationList();
        setStationList(Array.isArray(list) ? list : []);
      } catch (e) {
        console.log("❌ loadStations error:", e);
        setStationList([]);
      } finally {
        setLoading(false);
      }
    };
    loadStations();
  }, []);

  const matchedStation = stationList.find((s) => s.id === stationId);
  const stationName = matchedStation?.name || "";

  const generateTicketNo = (phone) => {
    const timestamp = Date.now().toString().slice(-6);
    return `TKT-${phone.slice(-4)}-${timestamp}`;
  };

  const openIOSPicker = () => {
    setTempIssue(selectedIssue);
    setShowIOSPicker(true);
  };

  const confirmIOSPicker = () => {
    setSelectedIssue(tempIssue);
    setShowIOSPicker(false);
  };

  const cancelIOSPicker = () => {
    setShowIOSPicker(false);
  };

  const handleSubmit = async () => {
    const net = await NetInfo.fetch();
const isOffline = net.isConnected === false || net.isInternetReachable === false;
if (isOffline) return;
    if (!net.isConnected) {
      Alert.alert("No Network", "No network connection available.");
      return;
    }
    if (!deviceInput.trim()) {
      Alert.alert("Missing Info", "Please enter your device name.");
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
        Alert.alert("Missing Info", "User phone number not found.");
        return;
      }

      const ticketNo = generateTicketNo(phoneNumber);

      const payload = {
        TicketNo: ticketNo,
        PhoneNo: phoneNumber,
        Description: description.trim(),
        deviceId: deviceInput.trim(),
        createdBy: phoneNumber,
        status: "Open",
        assignedTo: "",
        type: selectedIssue,
      };

      const response = await fetch("https://board.trisentrix.com/ticket/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        Alert.alert("Error", result.error || "Failed to create ticket.");
        return;
      }

      const shareMessage =
        `🎫 Support Ticket Created\n\n` +
        `Ticket No : ${ticketNo}\n` +
        `Device    : ${deviceInput.trim()}\n` +
        `Issue     : ${selectedIssue}\n` +
        `Station   : ${stationName}\n\n` +
        `We will get back to you shortly.`;

      const resetAndGoBack = () => {
        setDeviceInput("");
        setSelectedIssue("");
        setDescription("");
        navigation.goBack();
      };

      Alert.alert(
        "✅ Ticket Submitted",
        `Ticket ${ticketNo} created successfully!`,
        [
          {
            text: "Share",
            onPress: async () => {
              await Share.share({ message: shareMessage });
              resetAndGoBack();
            },
          },
          {
            text: "OK",
            onPress: resetAndGoBack,
          },
        ]
      );

    } catch (error) {
      console.error("❌ Ticket submit error:", error);
      Alert.alert("Error", "Failed to create support ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#080707ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Support Ticket</Text>
      </View>

      {/* ✅ KeyboardAwareScrollView — ReferFriendScreen மாதிரி */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >

        {/* Device */}
        <Text style={styles.label}>
          Device <Text style={{ color: "red" }}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your device / inverter name"
          placeholderTextColor="#999"
          value={deviceInput}
          onChangeText={setDeviceInput}
        />

        {/* Issue Type */}
        <Text style={styles.label}>
          Issue Type <Text style={{ color: "red" }}>*</Text>
        </Text>

        {Platform.OS === "ios" ? (
          /* iOS — custom button */
          <TouchableOpacity style={styles.iosPickerButton} onPress={openIOSPicker}>
            <Text style={selectedIssue ? styles.iosPickerText : styles.iosPickerPlaceholder}>
              {selectedIssue || "Select an Issue Type"}
            </Text>
            <Ionicons name="chevron-down-outline" size={18} color="#666" />
          </TouchableOpacity>
        ) : (
          /* Android — native dropdown */
          <View style={styles.dropdownContainer}>
            <Picker
              selectedValue={selectedIssue}
              onValueChange={(itemValue) => setSelectedIssue(itemValue)}
              style={styles.picker}
              dropdownIconColor="#000"
            >
              {issueOptions.map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
              ))}
            </Picker>
          </View>
        )}

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

        {/* ✅ Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
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

      </KeyboardAwareScrollView>

      {/* iOS Modal Picker */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showIOSPicker}
          transparent
          animationType="slide"
          onRequestClose={cancelIOSPicker}
        >
          {/* Dimmed backdrop */}
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={cancelIOSPicker}
          />

          {/* Bottom sheet */}
          <View style={styles.iosPickerSheet}>
            <View style={styles.iosPickerToolbar}>
              <TouchableOpacity onPress={cancelIOSPicker}>
                <Text style={styles.iosPickerCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.iosPickerTitle}>Issue Type</Text>
              <TouchableOpacity onPress={confirmIOSPicker}>
                <Text style={styles.iosPickerDone}>Done</Text>
              </TouchableOpacity>
            </View>

            <Picker
              selectedValue={tempIssue}
              onValueChange={(val) => setTempIssue(val)}
              style={styles.iosPickerWheel}
              itemStyle={styles.iosItemStyle}
            >
              {issueOptions.map((opt) => (
                <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
              ))}
            </Picker>
          </View>
        </Modal>
      )}

      {(loading || submitting) && <Loader />}
    </SafeAreaView>
  );
};

export default CreateTicketScreen;

const styles = StyleSheet.create({

  /* ── Layout ── */
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
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
    paddingBottom: 40,
  },

  /* ── Labels ── */
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginTop: 16,
    marginBottom: 6,
  },

  /* ── Device TextInput ── */
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#000",
    backgroundColor: "#fff",
  },

  /* ── Android Picker ── */
  dropdownContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 5,
  },
  picker: { width: "100%", color: "#000" },

  /* ── iOS Picker button ── */
  iosPickerButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iosPickerText: { fontSize: 14, color: "#000" },
  iosPickerPlaceholder: { fontSize: 14, color: "#999" },

  /* ── iOS Modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iosPickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  iosPickerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  iosPickerTitle: { fontSize: 15, fontWeight: "600", color: "#000" },
  iosPickerCancel: { fontSize: 15, color: "#666" },
  iosPickerDone: { fontSize: 15, fontWeight: "700", color: "#B00100" },
  iosPickerWheel: { width: "100%" },
  iosItemStyle: { fontSize: 16, color: "#000" },

  /* ── Description ── */
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

  /* ── Submit ── */
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
const FormScreen = () => {
    const navigation = useNavigation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    address: "",
    feedback: "",
  });
  const [step, setStep] = useState(1);

const [ebData, setEbData] = useState({
  month1: "",
  month2: "",
  month3: "",
  month4: "",
  month5: "",
  month6: "",
});

  const [errors, setErrors] = useState<any>({});

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const validate = () => {
    let err: any = {};

    if (!form.firstName) err.firstName = "First name is required";

    if (!form.lastName) err.lastName = "Last name is required";

    if (!form.mobile) {
      err.mobile = "Mobile number is required";
    } else if (!/^\d{10}$/.test(form.mobile)) {
      err.mobile = "Mobile must be 10 digits";
    }

    if (!form.address) err.address = "Address is required";

    if (!form.feedback) {
      err.feedback = "Feedback is required";
    } else if (form.feedback.length < 5) {
      err.feedback = "Minimum 5 characters required";
    }

    return err;
  };

  const handleSubmit = () => {
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
    } else {
       setStep(2);
    }
  };
  const handleEbSubmit = () => {
  Alert.alert("Success", "All Data Submitted ✅");

  console.log("Form Data:", form);
  console.log("EB Data:", ebData);
};

  return (
  <SafeAreaView style={styles.container}>

  {/* Back Button */}
  <TouchableOpacity
    style={styles.backButton}
    onPress={() => {
      if (step === 2) {
        setStep(1); // 👈 back to form1
      } else {
        navigation.goBack();
      }
    }}
  >
    <Text style={styles.backText}>← Back</Text>
  </TouchableOpacity>

  {step === 1 ? (
    <>
      <Text style={styles.title}>User Form</Text>

      <TextInput
        placeholder="First Name"
        style={styles.input}
        value={form.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />
      <Text style={styles.error}>{errors.firstName}</Text>

      <TextInput
        placeholder="Last Name"
        style={styles.input}
        value={form.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />
      <Text style={styles.error}>{errors.lastName}</Text>

      <TextInput
        placeholder="Mobile Number"
        keyboardType="numeric"
        style={styles.input}
        value={form.mobile}
        onChangeText={(text) => handleChange("mobile", text)}
      />
      <Text style={styles.error}>{errors.mobile}</Text>

      <TextInput
        placeholder="Address"
        style={styles.input}
        value={form.address}
        onChangeText={(text) => handleChange("address", text)}
      />
      <Text style={styles.error}>{errors.address}</Text>

      <TextInput
        placeholder="Feedback"
        style={styles.input}
        value={form.feedback}
        onChangeText={(text) => handleChange("feedback", text)}
      />
      <Text style={styles.error}>{errors.feedback}</Text>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </>
  ) : (
    <>
      <Text style={styles.title}>Last 6 Months EB Units</Text>

      {Object.keys(ebData).map((key, index) => (
        <TextInput
          key={key}
          placeholder={`Month ${index + 1} Units`}
          keyboardType="numeric"
          style={styles.input}
          value={ebData[key as keyof typeof ebData]}
          onChangeText={(text) =>
            setEbData({ ...ebData, [key]: text })
          }
        />
      ))}

      <TouchableOpacity style={styles.button} onPress={handleEbSubmit}>
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>
    </>
  )}
</SafeAreaView>
  );
};

export default FormScreen;

const styles = StyleSheet.create({
  container: {
  flex: 1,
  padding: 20,
  backgroundColor: "#fff",
},
  title: {
    fontSize: 22,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 5,
    borderRadius: 5,
  },
  error: {
    color: "red",
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#ED1C25",
    padding: 15,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
  },
  backButton: {
  marginBottom: 10,
},

backText: {
  fontSize: 16,
  color: "#0b0b0b",
},
});
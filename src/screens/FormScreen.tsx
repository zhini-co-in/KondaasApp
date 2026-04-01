import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import formConfig from "./formConfig.json";

// ─── Types ─────────────────────────────────────────────────────
type FieldDef = {
  key: string;
  label: string;
  type: "input" | "picker" | "textarea";
  inputType?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: { pattern: string; message: string };
  autoCapitalize?: string;
  numberOfLines?: number;
  conditionalChildren?: ConditionalChild[];
};

type ConditionalChild = {
  when: { key: string; value?: string; values?: string[] };
  sectionTitle?: string;
  fields: FieldDef[];
};

type StepDef = {
  id: number;
  title: string;
  stateKey: string;
  category?: string;
  fields: FieldDef[];
};

// ─── Build initial state from config ───────────────────────────
const buildInitialState = (steps: StepDef[]): Record<string, Record<string, string>> => {
  const state: Record<string, Record<string, string>> = {};

  const collectFields = (fields: FieldDef[], target: Record<string, string>) => {
    for (const field of fields) {
      target[field.key] = "";
      if (field.conditionalChildren) {
        for (const child of field.conditionalChildren) {
          collectFields(child.fields, target);
        }
      }
    }
  };

  for (const step of steps) {
    state[step.stateKey] = {};
    collectFields(step.fields, state[step.stateKey]);
  }

  return state;
};

// ─── Validate a step's fields ──────────────────────────────────
const validateStep = (
  stepDef: StepDef,
  data: Record<string, string>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const checkFields = (fields: FieldDef[]) => {
    for (const field of fields) {
      const value = data[field.key] ?? "";

      if (field.required && !value) {
        errors[field.key] = `${field.label} is required`;
      } else if (value && field.validation) {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          errors[field.key] = field.validation.message;
        }
      }

      // Check conditional children if parent has a value
      if (field.conditionalChildren) {
        for (const child of field.conditionalChildren) {
          const parentVal = data[child.when.key] ?? "";
          const isActive =
            (child.when.value && parentVal === child.when.value) ||
            (child.when.values && child.when.values.includes(parentVal));
          if (isActive) {
            checkFields(child.fields);
          }
        }
      }
    }
  };

  checkFields(stepDef.fields);
  return errors;
};

// ─── Main Component ────────────────────────────────────────────
const FormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as { category?: string } | undefined;
  const category = params?.category;

  const steps = (formConfig.steps as StepDef[]).filter(step =>
    category ? step.category === category : true
  );
  const totalSteps = steps.length;

  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>(
    buildInitialState(steps)
  );

  // ─── Field value getter/setter ────────────────────────────
  const getValue = (stateKey: string, fieldKey: string): string =>
    formData[stateKey]?.[fieldKey] ?? "";

  const setValue = (stateKey: string, fieldKey: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [stateKey]: { ...prev[stateKey], [fieldKey]: value },
    }));
    setErrors((prev) => ({ ...prev, [fieldKey]: "" }));
  };

  // ─── Step submit ──────────────────────────────────────────
  const handleStepSubmit = () => {
    const currentStepDef = steps[step - 1];
    const data = formData[currentStepDef.stateKey] ?? {};
    const errs = validateStep(currentStepDef, data);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    if (step < totalSteps) {
      setStep((s) => s + 1);
    } else {
      handleFinalSubmit();
    }
  };

  // ─── Final submit ─────────────────────────────────────────
  const handleFinalSubmit = async () => {
    try {
      // Map stateKey -> data
      const payload: Record<string, Record<string, string>> = {};
      for (const stepDef of steps) {
        payload[stepDef.stateKey] = formData[stepDef.stateKey];
      }

      const response = await fetch(
        "https://kondaas-api.trisentrix-dev.workers.dev/user/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to submit");

      Alert.alert("Success", "User added successfully");
      setFormData(buildInitialState(steps));
      setStep(1);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // ─── Render fields recursively ────────────────────────────
  const renderField = (field: FieldDef, stateKey: string) => {
    const value = getValue(stateKey, field.key);
    const error = errors[field.key];

    const fieldJSX =
      field.type === "picker" ? (
        <View key={field.key} style={styles.fieldWrapper}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.star}> *</Text>}
          </Text>
          <View style={styles.pickerWrapper}>
            {/* @ts-ignore */}
            <Picker
              selectedValue={value}
              onValueChange={(val: string) => setValue(stateKey, field.key, val)}
              style={styles.picker}
            >
              <Picker.Item label="Select" value="" />
              {field.options?.map((opt) => (
                <Picker.Item key={opt} label={opt} value={opt} />
              ))}
            </Picker>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : field.type === "textarea" ? (
        <View key={field.key} style={styles.fieldWrapper}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.star}> *</Text>}
          </Text>
          <TextInput
            placeholder={field.placeholder}
            style={[styles.input, styles.textArea]}
            value={value}
            onChangeText={(t: string) => setValue(stateKey, field.key, t)}
            multiline
            numberOfLines={field.numberOfLines ?? 4}
            textAlignVertical="top"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <View key={field.key} style={styles.fieldWrapper}>
          <Text style={styles.label}>
            {field.label}
            {field.required && <Text style={styles.star}> *</Text>}
          </Text>
          <TextInput
            placeholder={field.placeholder}
            keyboardType={field.inputType as any}
            autoCapitalize={(field.autoCapitalize as any) ?? "sentences"}
            style={styles.input}
            value={value}
            onChangeText={(t: string) => setValue(stateKey, field.key, t)}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );

    // Render conditional children if applicable
    const children: JSX.Element[] = [];
    if (field.conditionalChildren) {
      for (const child of field.conditionalChildren) {
        const parentVal = getValue(stateKey, child.when.key);
        const isActive =
          (child.when.value && parentVal === child.when.value) ||
          (child.when.values && child.when.values.includes(parentVal));

        if (isActive) {
          children.push(
            <View key={`child-${child.when.value ?? child.when.values?.join("-")}`} style={styles.nestedSection}>
              {child.sectionTitle && (
                <Text style={styles.nestedTitle}>{child.sectionTitle}</Text>
              )}
              {child.fields.map((f) => renderField(f, stateKey))}
            </View>
          );
        }
      }
    }

    return (
      <React.Fragment key={field.key}>
        {fieldJSX}
        {children}
      </React.Fragment>
    );
  };

  // ─── Render ───────────────────────────────────────────────
  const currentStepDef = steps[step - 1];

  return (
    <SafeAreaView style={styles.safeArea as any}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step > 1) setStep((s) => s - 1);
            else navigation.goBack();
          }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Step Title */}
        <Text style={styles.title}>{currentStepDef.title}</Text>
         {/* Dynamic Fields */}
        {currentStepDef.fields.map((field) =>
          renderField(field, currentStepDef.stateKey)
        )}
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {steps.map((s) => (
            <View
              key={s.id}
              style={[styles.stepDot, step === s.id && styles.stepDotActive]}
            >
              <Text
                style={[styles.stepDotText, step === s.id && styles.stepDotTextActive]}
              >
                {s.id}
              </Text>
            </View>
          ))}
        </View>

        {/* Next / Submit Button */}
        <TouchableOpacity style={styles.button} onPress={handleStepSubmit}>
          <Text style={styles.buttonText}>
            {step === totalSteps ? "Submit" : "Next"}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

export default FormScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center", fontWeight: "700" },
  label: { marginBottom: 3, fontWeight: "600" },
  star: { color: "red" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 10, marginBottom: 5, borderRadius: 5 },
  error: { color: "red", marginBottom: 10, fontSize: 12 },
  button: { backgroundColor: "#ED1C25", padding: 15, borderRadius: 5, marginTop: 10 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  backButton: { marginBottom: 10 },
  backText: { fontSize: 16, color: "#0b0b0b" },
  fieldWrapper: { marginBottom: 5 },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, marginBottom: 5, overflow: "hidden" },
  picker: { height: 50 },
  nestedSection: { backgroundColor: "#f9f9f9", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, padding: 12, marginBottom: 10 },
  nestedTitle: { fontWeight: "700", marginBottom: 10, fontSize: 14, color: "#333" },
  stepIndicator: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 20, gap: 12 },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "#ccc", justifyContent: "center", alignItems: "center" },
  stepDotActive: { backgroundColor: "#ED1C25", borderColor: "#ED1C25" },
  stepDotText: { fontWeight: "700", color: "#ccc" },
  stepDotTextActive: { color: "#fff" },
  textArea: { height: 100, textAlignVertical: "top" },
});

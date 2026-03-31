import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView 
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";

const FormScreen = () => {
  const navigation = useNavigation();

  // ─── Step tracking ───────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Step 1 State ───────────────────────────────────────────
  const [form, setForm] = useState({
    orderType: "",
    consumerNumber: "",
    consumerName: "",
    consumerAddress: "",
    mobileNumber: "",
    ebRegisteredMobile: "",
    connectionType: "",
    projectType: "",
    ebConnectionStatus: "",
  });

  // ─── Step 2 State ───────────────────────────────────────────
  const [requirements, setRequirements] = useState({
    ebConnectedLoad: "",
    inverterCapacity: "",
    inverterConnectionType: "",
    numPanels: "",
    panelType: "",
    buildingHeight: "",
    rooftopAccess: "",
    ladderToRooftop: "",
    roofType: "",
    structureType: "",
    flatRoof1_2x1: "",
    flatRoof1_3x1: "",
    flatRoof1_4x1: "",
    flatRoof1_2x2: "",
    flatRoof1_3x2: "",
    flatRoof1_4x2: "",
    flatRoof2_2x2: "",
    flatRoof2_3x2: "",
    flatRoof2_4x2: "",
    flatRoof2_5x2: "",
    aluminumRowConfig: "",
    requiredCivilWork: "",
    scopeCivilWork: "",
    additionalStructureRequired: "",
    additionalStructureAmount: "",
    agreeAdditionalStructureCost: "",
    customerArrangeStructureYes: "",
    arrangeRemark: "",
    additionalStructureTime: "",
    customerArrangeStructure: "",
  });

  // ─── Step 3 State ───────────────────────────────────────────
  const [safety, setSafety] = useState({
    ladder: "",
    walkway: "",
    handrail: "",
    slidingDoor: "",
  });

  // ─── Step 4 State ───────────────────────────────────────────
  const [cable, setCable] = useState({
    cableRequirement: "",
    agreeExtraCableCost: "",
    acCable: "",
    dcCable: "",
    laCable: "",
    earthingCable: "",
    anyAdditional: "",
  });

  // ─── Step 5 State ───────────────────────────────────────────
  const [docs, setDocs] = useState({
    aadhar: "",
    pan: "",
    roofPhotos: "",
    cheque: "",
    buildingFull: "",
    ebBill: "",
    passportPhoto: "",
    emailId: "",
    googleMapLink: "",
  });

  // ─── Step 6 State ───────────────────────────────────────────
  const [payment, setPayment] = useState({
    requiredLoan: "",
    orderClosingDate: "",
    plantCost: "",
    advancePayment: "",
    balanceAmount: "",
    netMeterCost: "",
  });

  // ─── Step 7 State ───────────────────────────────────────────
  const [signatures, setSignatures] = useState({
    customerNameMobile: "",
    siteSurveyorName: "",
    surveyorMobile: "",
  });

  // ─── Step 8 State ───────────────────────────────────────────
  const [remarks, setRemarks] = useState({
    changeLoad: "",
    nameChangeEB: "",
    nameChangeBank: "",
    change1to3Phase: "",
    remarksText: "",
  });

  // ─── Helpers ────────────────────────────────────────────────
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleReqChange = (key: string, value: string) => {
    setRequirements((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSafetyChange = (key: string, value: string) => {
    setSafety((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleCableChange = (key: string, value: string) => {
    setCable((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleDocsChange = (key: string, value: string) => {
    setDocs((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handlePaymentChange = (key: string, value: string) => {
    setPayment((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSignaturesChange = (key: string, value: string) => {
    setSignatures((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleRemarksChange = (key: string, value: string) => {
    setRemarks((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  // ─── Step 1 Validation & Submit ─────────────────────────────
  const validateStep1 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!form.orderType) err.orderType = "Order Type is required";
    if (!form.consumerNumber) err.consumerNumber = "Consumer Number is required";
    if (!form.consumerName) err.consumerName = "Consumer Name is required";
    if (!form.consumerAddress) err.consumerAddress = "Consumer Address is required";
    if (!form.mobileNumber) {
      err.mobileNumber = "Mobile Number is required";
    } else if (!/^\d{10,15}$/.test(form.mobileNumber)) {
      err.mobileNumber = "Enter a valid mobile number (10–15 digits)";
    }
    if (!form.ebRegisteredMobile) {
      err.ebRegisteredMobile = "EB Registered Mobile is required";
    } else if (!/^\d{10,15}$/.test(form.ebRegisteredMobile)) {
      err.ebRegisteredMobile = "Enter a valid mobile number (10–15 digits)";
    }
    if (!form.connectionType) err.connectionType = "EB Connection Type is required";
    if (!form.projectType) err.projectType = "Project Type is required";
    if (!form.ebConnectionStatus) err.ebConnectionStatus = "EB Connection Status is required";
    return err;
  };

  const handleStep1Submit = () => {
    const errs = validateStep1();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(2);
    }
  };

  // ─── Step 2 Validation & Submit ─────────────────────────────
  const validateStep2 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!requirements.ebConnectedLoad) err.ebConnectedLoad = "EB Connected Load is required";
    if (!requirements.inverterCapacity) err.inverterCapacity = "Inverter Capacity is required";
    if (!requirements.inverterConnectionType) err.inverterConnectionType = "Inverter Connection Type is required";
    if (!requirements.numPanels) err.numPanels = "No. of Panels is required";
    if (!requirements.panelType) err.panelType = "Type of Panel is required";
    if (!requirements.buildingHeight) err.buildingHeight = "Building Height is required";
    if (!requirements.rooftopAccess) err.rooftopAccess = "Rooftop Access is required";
    if (!requirements.ladderToRooftop) err.ladderToRooftop = "Ladder to Rooftop is required";
    if (!requirements.roofType) err.roofType = "Type of Roof is required";
    if (!requirements.structureType) err.structureType = "Structure Type is required";
    if (!requirements.requiredCivilWork) err.requiredCivilWork = "Required Civil Work is required";
    if (requirements.requiredCivilWork === "Yes" && !requirements.scopeCivilWork)
      err.scopeCivilWork = "Scope of Civil Work is required";
    if (!requirements.additionalStructureRequired)
      err.additionalStructureRequired = "Additional Structure Required is required";
    if (requirements.additionalStructureRequired === "YES" && !requirements.additionalStructureAmount)
      err.additionalStructureAmount = "Amount is required";
    if (requirements.additionalStructureRequired === "NO" && !requirements.customerArrangeStructure)
      err.customerArrangeStructure = "This field is required";
    return err;
  };

  const handleStep2Submit = () => {
    const errs = validateStep2();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(3);
    }
  };

  // ─── Step 3 Validation & Submit ─────────────────────────────
  const validateStep3 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!safety.ladder) err.ladder = "Ladder is required";
    if (!safety.walkway) err.walkway = "Walkway is required";
    if (!safety.handrail) err.handrail = "Handrail is required";
    if (!safety.slidingDoor) err.slidingDoor = "Sliding Door is required";
    return err;
  };

  const handleStep3Submit = () => {
    const errs = validateStep3();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(4);
    }
  };

  // ─── Step 4 Validation & Submit ─────────────────────────────
  const validateStep4 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!cable.cableRequirement) err.cableRequirement = "Cable Requirement is required";
    if (cable.cableRequirement === "Need Additional Cable") {
      if (!cable.agreeExtraCableCost) err.agreeExtraCableCost = "This field is required";
      if (!cable.acCable) err.acCable = "AC Cable is required";
      if (!cable.dcCable) err.dcCable = "DC Cable is required";
      if (!cable.laCable) err.laCable = "LA Cable is required";
      if (!cable.earthingCable) err.earthingCable = "Earthing Cable is required";
      if (!cable.anyAdditional) err.anyAdditional = "This field is required";
    }
    return err;
  };

  const handleStep4Submit = () => {
    const errs = validateStep4();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(5);
    }
  };

  // ─── Step 5 Validation & Submit ─────────────────────────────
  const validateStep5 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!docs.aadhar) err.aadhar = "Aadhar Card is required";
    if (!docs.pan) err.pan = "PAN Card is required";
    if (!docs.roofPhotos) err.roofPhotos = "Roof Photos is required";
    if (!docs.cheque) err.cheque = "Cancelled Cheque / Passbook is required";
    if (!docs.buildingFull) err.buildingFull = "Building Full View Photo is required";
    if (!docs.ebBill) err.ebBill = "EB Bill copy is required";
    if (!docs.passportPhoto) err.passportPhoto = "Passport Size Photo is required";
    return err;
  };

  const handleStep5Submit = () => {
    const errs = validateStep5();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(6);
    }
  };

  // ─── Step 6 Validation & Submit ─────────────────────────────
  const validateStep6 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!payment.requiredLoan) err.requiredLoan = "Required Loan is required";
    if (!payment.orderClosingDate) err.orderClosingDate = "Approx Order Closing Date is required";
    if (!payment.plantCost) err.plantCost = "Customer Payable Plant Cost is required";
    if (!payment.advancePayment) err.advancePayment = "Advance Payment Received is required";
    if (!payment.balanceAmount) err.balanceAmount = "Balance Amount Payable is required";
    if (!payment.netMeterCost) err.netMeterCost = "Customer Payable Net Meter Cost is required";
    return err;
  };

  const handleStep6Submit = () => {
    const errs = validateStep6();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(7);
    }
  };

  // ─── Step 7 Validation & Submit ─────────────────────────────
  const validateStep7 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!signatures.customerNameMobile) err.customerNameMobile = "Name & Mobile Number is required";
    if (!signatures.siteSurveyorName) err.siteSurveyorName = "Site Surveyor Name is required";
    if (!signatures.surveyorMobile) err.surveyorMobile = "Surveyor Mobile No. is required";
    return err;
  };

  const handleStep7Submit = () => {
    const errs = validateStep7();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      setStep(8);
    }
  };

  // ─── Step 8 Validation & Submit ─────────────────────────────
  const validateStep8 = (): Record<string, string> => {
    const err: Record<string, string> = {};
    if (!remarks.changeLoad) err.changeLoad = "This field is required";
    if (!remarks.nameChangeEB) err.nameChangeEB = "This field is required";
    if (!remarks.nameChangeBank) err.nameChangeBank = "This field is required";
    if (!remarks.change1to3Phase) err.change1to3Phase = "This field is required";
    if (!remarks.remarksText) err.remarksText = "Remarks is required";
    return err;
  };

  const handleStep8Submit = () => {
    const errs = validateStep8();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
    } else {
      setErrors({});
      handleFinalSubmit();
    }
  };

  // ─── Final Submit ────────────────────────────────────────────
  const handleFinalSubmit = async () => {
    try {
      const response = await fetch(
        "https://kondaas-api.trisentrix-dev.workers.dev/user/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerDetails: form,
            customerRequirements: requirements,
            safetyAndInstallation: safety,
            cableRequirements: cable,
            collectedDocumentChecklist: docs,
            paymentDetails: payment,
            signatures,
            remarks,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to submit");

      Alert.alert("Success", "User added successfully");

      // Reset all state
      setForm({ orderType: "", consumerNumber: "", consumerName: "", consumerAddress: "", mobileNumber: "", ebRegisteredMobile: "", connectionType: "", projectType: "", ebConnectionStatus: "" });
      setRequirements({ ebConnectedLoad: "", inverterCapacity: "", inverterConnectionType: "", numPanels: "", panelType: "", buildingHeight: "", rooftopAccess: "", ladderToRooftop: "", roofType: "", structureType: "", flatRoof1_2x1: "", flatRoof1_3x1: "", flatRoof1_4x1: "", flatRoof1_2x2: "", flatRoof1_3x2: "", flatRoof1_4x2: "", flatRoof2_2x2: "", flatRoof2_3x2: "", flatRoof2_4x2: "", flatRoof2_5x2: "", aluminumRowConfig: "", requiredCivilWork: "", scopeCivilWork: "", additionalStructureRequired: "", additionalStructureAmount: "", agreeAdditionalStructureCost: "", customerArrangeStructureYes: "", arrangeRemark: "", additionalStructureTime: "", customerArrangeStructure: "" });
      setSafety({ ladder: "", walkway: "", handrail: "", slidingDoor: "" });
      setCable({ cableRequirement: "", agreeExtraCableCost: "", acCable: "", dcCable: "", laCable: "", earthingCable: "", anyAdditional: "" });
      setDocs({ aadhar: "", pan: "", roofPhotos: "", cheque: "", buildingFull: "", ebBill: "", passportPhoto: "", emailId: "", googleMapLink: "" });
      setPayment({ requiredLoan: "", orderClosingDate: "", plantCost: "", advancePayment: "", balanceAmount: "", netMeterCost: "" });
      setSignatures({ customerNameMobile: "", siteSurveyorName: "", surveyorMobile: "" });
      setRemarks({ changeLoad: "", nameChangeEB: "", nameChangeBank: "", change1to3Phase: "", remarksText: "" });
      setStep(1);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // ─── Reusable Components ─────────────────────────────────────
  const PickerField = ({
    label,
    selectedValue,
    onValueChange,
    options,
    error,
  }: {
    label: string;
    selectedValue: string;
    onValueChange: (val: string) => void;
    options: string[];
    error?: string;
  }) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label} <Text style={styles.star}>*</Text>
      </Text>
      <View style={styles.pickerWrapper}>
        {/* @ts-ignore */}
        <Picker
          selectedValue={selectedValue}
          onValueChange={onValueChange}
          style={styles.picker}
        >
          <Picker.Item label="Select" value="" />
          {options.map((opt) => (
            <Picker.Item key={opt} label={opt} value={opt} />
          ))}
        </Picker>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  const InputField = ({
    label,
    placeholder,
    value,
    onChangeText,
    keyboardType = "default",
    error,
  }: {
    label: string;
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    keyboardType?: any;
    error?: string;
  }) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label} <Text style={styles.star}>*</Text>
      </Text>
      <TextInput
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────
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

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive]}>
              <Text style={[styles.stepDotText, step === s && styles.stepDotTextActive]}>{s}</Text>
            </View>
          ))}
        </View>

        {/* ── STEP 1: Customer Details ── */}
        {step === 1 && (
          <>
            <Text style={styles.title}>Customer Details</Text>

            <PickerField label="Order Type" selectedValue={form.orderType}
              onValueChange={(val) => handleChange("orderType", val)}
              options={["Company Lead", "Dealer Own Lead"]} error={errors.orderType} />

            <InputField label="Consumer Number" placeholder="Enter Consumer Number"
              value={form.consumerNumber} keyboardType="numeric"
              onChangeText={(t: string) => handleChange("consumerNumber", t)} error={errors.consumerNumber} />

            <InputField label="Consumer Name" placeholder="Enter Consumer Name"
              value={form.consumerName}
              onChangeText={(t: string) => handleChange("consumerName", t)} error={errors.consumerName} />

            <InputField label="Consumer Address" placeholder="Enter Consumer Address"
              value={form.consumerAddress}
              onChangeText={(t: string) => handleChange("consumerAddress", t)} error={errors.consumerAddress} />

            <InputField label="Mobile Number" placeholder="Enter Mobile Number"
              value={form.mobileNumber} keyboardType="phone-pad"
              onChangeText={(t: string) => handleChange("mobileNumber", t)} error={errors.mobileNumber} />

            <InputField label="EB Registered Mobile Number" placeholder="Enter EB Registered Mobile"
              value={form.ebRegisteredMobile} keyboardType="phone-pad"
              onChangeText={(t: string) => handleChange("ebRegisteredMobile", t)} error={errors.ebRegisteredMobile} />

            <PickerField label="EB Connection Type" selectedValue={form.connectionType}
              onValueChange={(val) => handleChange("connectionType", val)}
              options={["Single Phase", "Three Phase"]} error={errors.connectionType} />

            <PickerField label="Project Type" selectedValue={form.projectType}
              onValueChange={(val) => handleChange("projectType", val)}
              options={["Ongrid - Subsidy", "Ongrid - Non Subsidy", "Hybrid - Subsidy", "Hybrid - Non Subsidy"]}
              error={errors.projectType} />

            <PickerField label="EB Connection Status" selectedValue={form.ebConnectionStatus}
              onValueChange={(val) => handleChange("ebConnectionStatus", val)}
              options={["Permanent Residential", "Temporary Residential", "Commercial", "Other"]}
              error={errors.ebConnectionStatus} />

            <TouchableOpacity style={styles.button} onPress={handleStep1Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2: Customer Requirements ── */}
        {step === 2 && (
          <>
            <Text style={styles.title}>Customer Requirements</Text>

            <InputField label="EB Connected Load (KW)" placeholder="Enter KW"
              value={requirements.ebConnectedLoad} keyboardType="decimal-pad"
              onChangeText={(t: string) => handleReqChange("ebConnectedLoad", t)} error={errors.ebConnectedLoad} />

            <InputField label="Inverter Capacity (KW)" placeholder="Enter KW"
              value={requirements.inverterCapacity} keyboardType="decimal-pad"
              onChangeText={(t: string) => handleReqChange("inverterCapacity", t)} error={errors.inverterCapacity} />

            <PickerField label="Inverter Connection Type" selectedValue={requirements.inverterConnectionType}
              onValueChange={(val) => handleReqChange("inverterConnectionType", val)}
              options={["1 Phase", "3 Phase"]} error={errors.inverterConnectionType} />

            <InputField label="No. of Panels" placeholder="Enter number"
              value={requirements.numPanels} keyboardType="numeric"
              onChangeText={(t: string) => handleReqChange("numPanels", t)} error={errors.numPanels} />

            <PickerField label="Type of Panel" selectedValue={requirements.panelType}
              onValueChange={(val) => handleReqChange("panelType", val)}
              options={["Mono PERC Half Cut Bifacial 520–550W", "TopCon Bifacial 600–620W"]}
              error={errors.panelType} />

            <PickerField label="Building Height" selectedValue={requirements.buildingHeight}
              onValueChange={(val) => handleReqChange("buildingHeight", val)}
              options={["1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5 + Floors"]}
              error={errors.buildingHeight} />

            <PickerField label="Rooftop Access" selectedValue={requirements.rooftopAccess}
              onValueChange={(val) => handleReqChange("rooftopAccess", val)}
              options={["Yes", "No"]} error={errors.rooftopAccess} />

            <PickerField label="Ladder to Rooftop" selectedValue={requirements.ladderToRooftop}
              onValueChange={(val) => handleReqChange("ladderToRooftop", val)}
              options={["Permanent", "Temporary", "Not Required"]} error={errors.ladderToRooftop} />

            <PickerField label="Type of Roof" selectedValue={requirements.roofType}
              onValueChange={(val) => handleReqChange("roofType", val)}
              options={["Flat", "Concrete Slope", "GI Sheet N–S", "GI Sheet Slope", "Mixed", "Other"]}
              error={errors.roofType} />

            <PickerField label="Structure Type" selectedValue={requirements.structureType}
              onValueChange={(val) => handleReqChange("structureType", val)}
              options={["Flat Roof 1 Meter", "Flat Roof 2 Meter", "Aluminum Long Rail", "Aluminum Short Rail", "Customized"]}
              error={errors.structureType} />

            {requirements.structureType === "Flat Roof 1 Meter" && (
              <View style={styles.nestedSection}>
                <Text style={styles.nestedTitle}>Flat Roof 1 Meter Configuration</Text>
                {([ ["2x1","flatRoof1_2x1"], ["3x1","flatRoof1_3x1"], ["4x1","flatRoof1_4x1"],
                    ["2x2","flatRoof1_2x2"], ["3x2","flatRoof1_3x2"], ["4x2","flatRoof1_4x2"] ] as [string, keyof typeof requirements][]).map(([label, key]) => (
                  <InputField key={key} label={label} placeholder={`Enter ${label}`}
                    value={requirements[key] as string}
                    onChangeText={(t: string) => handleReqChange(key, t)} />
                ))}
              </View>
            )}

            {requirements.structureType === "Flat Roof 2 Meter" && (
              <View style={styles.nestedSection}>
                <Text style={styles.nestedTitle}>Flat Roof 2 Meter Configuration</Text>
                {([ ["2x2","flatRoof2_2x2"], ["3x2","flatRoof2_3x2"], ["4x2","flatRoof2_4x2"], ["5x2","flatRoof2_5x2"] ] as [string, keyof typeof requirements][]).map(([label, key]) => (
                  <InputField key={key} label={label} placeholder={`Enter ${label}`}
                    value={requirements[key] as string}
                    onChangeText={(t: string) => handleReqChange(key, t)} />
                ))}
              </View>
            )}

            {(requirements.structureType === "Aluminum Long Rail" || requirements.structureType === "Aluminum Short Rail") && (
              <View style={styles.nestedSection}>
                <Text style={styles.nestedTitle}>Aluminum Rail Configuration</Text>
                <PickerField label="Row Configuration" selectedValue={requirements.aluminumRowConfig}
                  onValueChange={(val) => handleReqChange("aluminumRowConfig", val)}
                  options={["1 Row", "2 Row", "3 Row", "4 Row"]} />
              </View>
            )}

            <PickerField label="Required Civil Work" selectedValue={requirements.requiredCivilWork}
              onValueChange={(val) => handleReqChange("requiredCivilWork", val)}
              options={["Yes", "No"]} error={errors.requiredCivilWork} />

            {requirements.requiredCivilWork === "Yes" && (
              <PickerField label="Scope Of Civil Work" selectedValue={requirements.scopeCivilWork}
                onValueChange={(val) => handleReqChange("scopeCivilWork", val)}
                options={["Customer", "Installer"]} error={errors.scopeCivilWork} />
            )}

            <PickerField label="Additional Structure Required" selectedValue={requirements.additionalStructureRequired}
              onValueChange={(val) => handleReqChange("additionalStructureRequired", val)}
              options={["YES", "NO"]} error={errors.additionalStructureRequired} />

            {requirements.additionalStructureRequired === "YES" && (
              <View style={styles.nestedSection}>
                <InputField label="Approx Amount for Additional Structure" placeholder="Enter Amount"
                  value={requirements.additionalStructureAmount} keyboardType="decimal-pad"
                  onChangeText={(t: string) => handleReqChange("additionalStructureAmount", t)}
                  error={errors.additionalStructureAmount} />

                <PickerField label="Customer agree to bear additional structure cost"
                  selectedValue={requirements.agreeAdditionalStructureCost}
                  onValueChange={(val) => handleReqChange("agreeAdditionalStructureCost", val)}
                  options={["Yes", "No", "Not Required"]} />

                <PickerField label="Customer will arrange structure by self"
                  selectedValue={requirements.customerArrangeStructureYes}
                  onValueChange={(val) => handleReqChange("customerArrangeStructureYes", val)}
                  options={["Yes", "No"]} />

                <InputField label="Remark" placeholder="Enter remark"
                  value={requirements.arrangeRemark}
                  onChangeText={(t: string) => handleReqChange("arrangeRemark", t)} />

                <PickerField label="Approximate time required"
                  selectedValue={requirements.additionalStructureTime}
                  onValueChange={(val) => handleReqChange("additionalStructureTime", val)}
                  options={["1 week", "2 weeks", "more than 2 weeks", "Customer is not willing to install additional structure."]} />
              </View>
            )}

            {requirements.additionalStructureRequired === "NO" && (
              <View style={styles.nestedSection}>
                <PickerField label="Customer will arrange structure by self"
                  selectedValue={requirements.customerArrangeStructure}
                  onValueChange={(val) => handleReqChange("customerArrangeStructure", val)}
                  options={["Yes", "No"]} error={errors.customerArrangeStructure} />
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleStep2Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 3: Safety & Installation Requirements ── */}
        {step === 3 && (
          <>
            <Text style={styles.title}>Safety & Installation Requirements</Text>

            <PickerField label="Ladder" selectedValue={safety.ladder}
              onValueChange={(val) => handleSafetyChange("ladder", val)}
              options={["Yes", "No", "Not Required"]} error={errors.ladder} />

            <PickerField label="Walkway" selectedValue={safety.walkway}
              onValueChange={(val) => handleSafetyChange("walkway", val)}
              options={["Yes", "No", "Not Required"]} error={errors.walkway} />

            <PickerField label="Handrail" selectedValue={safety.handrail}
              onValueChange={(val) => handleSafetyChange("handrail", val)}
              options={["Yes", "No", "Not Required"]} error={errors.handrail} />

            <PickerField label="Sliding Door" selectedValue={safety.slidingDoor}
              onValueChange={(val) => handleSafetyChange("slidingDoor", val)}
              options={["Yes", "No", "Not Required"]} error={errors.slidingDoor} />

            <TouchableOpacity style={styles.button} onPress={handleStep3Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 4: Cable Requirements ── */}
        {step === 4 && (
          <>
            <Text style={styles.title}>Cable Requirements</Text>

            <PickerField label="Cable Requirement" selectedValue={cable.cableRequirement}
              onValueChange={(val) => handleCableChange("cableRequirement", val)}
              options={["Required Standard BOM Cables Only", "Need Additional Cable"]}
              error={errors.cableRequirement} />

            {cable.cableRequirement === "Need Additional Cable" && (
              <View style={styles.nestedSection}>
                <Text style={styles.nestedTitle}>Additional Cable Details</Text>

                <PickerField label="Customer agreed for extra cable & accessory cost"
                  selectedValue={cable.agreeExtraCableCost}
                  onValueChange={(val) => handleCableChange("agreeExtraCableCost", val)}
                  options={["Yes", "No"]} error={errors.agreeExtraCableCost} />

                <InputField label="AC Cable" placeholder="Enter AC Cable"
                  value={cable.acCable} keyboardType="decimal-pad"
                  onChangeText={(t: string) => handleCableChange("acCable", t)} error={errors.acCable} />

                <InputField label="DC Cable" placeholder="Enter DC Cable"
                  value={cable.dcCable} keyboardType="decimal-pad"
                  onChangeText={(t: string) => handleCableChange("dcCable", t)} error={errors.dcCable} />

                <InputField label="LA Cable" placeholder="Enter LA Cable"
                  value={cable.laCable} keyboardType="decimal-pad"
                  onChangeText={(t: string) => handleCableChange("laCable", t)} error={errors.laCable} />

                <InputField label="Earthing Cable" placeholder="Enter Earthing Cable"
                  value={cable.earthingCable} keyboardType="decimal-pad"
                  onChangeText={(t: string) => handleCableChange("earthingCable", t)} error={errors.earthingCable} />

                <InputField label="Any Additional" placeholder="Enter additional details"
                  value={cable.anyAdditional}
                  onChangeText={(t: string) => handleCableChange("anyAdditional", t)} error={errors.anyAdditional} />
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleStep4Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 5: Document Checklist ── */}
        {step === 5 && (
          <>
            <Text style={styles.title}>Collected Document Checklist</Text>

            <PickerField label="Aadhar Card" selectedValue={docs.aadhar}
              onValueChange={(val) => handleDocsChange("aadhar", val)}
              options={["Yes", "No"]} error={errors.aadhar} />

            <PickerField label="PAN Card" selectedValue={docs.pan}
              onValueChange={(val) => handleDocsChange("pan", val)}
              options={["Yes", "No"]} error={errors.pan} />

            <PickerField label="Roof Photos" selectedValue={docs.roofPhotos}
              onValueChange={(val) => handleDocsChange("roofPhotos", val)}
              options={["Yes", "No"]} error={errors.roofPhotos} />

            <PickerField label="Cancelled Cheque / Passbook" selectedValue={docs.cheque}
              onValueChange={(val) => handleDocsChange("cheque", val)}
              options={["Yes", "No"]} error={errors.cheque} />

            <PickerField label="Building Full View Photo" selectedValue={docs.buildingFull}
              onValueChange={(val) => handleDocsChange("buildingFull", val)}
              options={["Yes", "No"]} error={errors.buildingFull} />

            <PickerField label="EB Bill copy (last 6 months)" selectedValue={docs.ebBill}
              onValueChange={(val) => handleDocsChange("ebBill", val)}
              options={["Yes", "No"]} error={errors.ebBill} />

            <PickerField label="Passport Size Photo" selectedValue={docs.passportPhoto}
              onValueChange={(val) => handleDocsChange("passportPhoto", val)}
              options={["Yes", "No"]} error={errors.passportPhoto} />

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Email ID</Text>
              <TextInput placeholder="Enter Email ID" keyboardType="email-address"
                autoCapitalize="none" style={styles.input}
                value={docs.emailId} onChangeText={(t: string) => handleDocsChange("emailId", t)} />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Google Map Link</Text>
              <TextInput placeholder="Enter Google Map Link" keyboardType="url"
                autoCapitalize="none" style={styles.input}
                value={docs.googleMapLink} onChangeText={(t: string) => handleDocsChange("googleMapLink", t)} />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleStep5Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 6: Payment Details ── */}
        {step === 6 && (
          <>
            <Text style={styles.title}>Payment Details</Text>

            <PickerField label="Required Loan" selectedValue={payment.requiredLoan}
              onValueChange={(val) => handlePaymentChange("requiredLoan", val)}
              options={["Yes", "No"]} error={errors.requiredLoan} />

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Approx Order Closing Date <Text style={styles.star}>*</Text></Text>
              <TextInput placeholder="YYYY-MM-DD" style={styles.input}
                value={payment.orderClosingDate}
                onChangeText={(t: string) => handlePaymentChange("orderClosingDate", t)} />
              {errors.orderClosingDate ? <Text style={styles.error}>{errors.orderClosingDate}</Text> : null}
            </View>

            <InputField label="Customer Payable Plant Cost" placeholder="Enter Amount"
              value={payment.plantCost} keyboardType="decimal-pad"
              onChangeText={(t: string) => handlePaymentChange("plantCost", t)} error={errors.plantCost} />

            <InputField label="Advance Payment Received" placeholder="Enter Amount"
              value={payment.advancePayment} keyboardType="decimal-pad"
              onChangeText={(t: string) => handlePaymentChange("advancePayment", t)} error={errors.advancePayment} />

            <InputField label="Balance Amount Payable" placeholder="Enter Amount"
              value={payment.balanceAmount} keyboardType="decimal-pad"
              onChangeText={(t: string) => handlePaymentChange("balanceAmount", t)} error={errors.balanceAmount} />

            <InputField label="Customer Payable Net Meter Cost" placeholder="Enter Amount"
              value={payment.netMeterCost} keyboardType="decimal-pad"
              onChangeText={(t: string) => handlePaymentChange("netMeterCost", t)} error={errors.netMeterCost} />

            <TouchableOpacity style={styles.button} onPress={handleStep6Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 7: Signatures ── */}
        {step === 7 && (
          <>
            <Text style={styles.title}>Signatures</Text>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>
                Name & Mobile Number - Who was met during the site survey{" "}
                <Text style={styles.star}>*</Text>
              </Text>
              <TextInput placeholder="Name & Mobile Number" style={styles.input}
                value={signatures.customerNameMobile}
                onChangeText={(t: string) => handleSignaturesChange("customerNameMobile", t)} />
              {errors.customerNameMobile ? <Text style={styles.error}>{errors.customerNameMobile}</Text> : null}
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Site Surveyor Name <Text style={styles.star}>*</Text></Text>
              <TextInput placeholder="Site Surveyor Name" style={styles.input}
                value={signatures.siteSurveyorName}
                onChangeText={(t: string) => handleSignaturesChange("siteSurveyorName", t)} />
              {errors.siteSurveyorName ? <Text style={styles.error}>{errors.siteSurveyorName}</Text> : null}
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Mobile No. <Text style={styles.star}>*</Text></Text>
              <TextInput placeholder="Mobile No." keyboardType="phone-pad" style={styles.input}
                value={signatures.surveyorMobile}
                onChangeText={(t: string) => handleSignaturesChange("surveyorMobile", t)} />
              {errors.surveyorMobile ? <Text style={styles.error}>{errors.surveyorMobile}</Text> : null}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleStep7Submit}>
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 8: Remarks ── */}
        {step === 8 && (
          <>
            <Text style={styles.title}>Remarks</Text>

            <PickerField label="Need to Change EB Connected Load"
              selectedValue={remarks.changeLoad}
              onValueChange={(val) => handleRemarksChange("changeLoad", val)}
              options={["Yes", "No"]} error={errors.changeLoad} />

            <PickerField label="Need Name Change in EB"
              selectedValue={remarks.nameChangeEB}
              onValueChange={(val) => handleRemarksChange("nameChangeEB", val)}
              options={["Yes", "No"]} error={errors.nameChangeEB} />

            <PickerField label="Need Name Change In Bank Passbook"
              selectedValue={remarks.nameChangeBank}
              onValueChange={(val) => handleRemarksChange("nameChangeBank", val)}
              options={["Yes", "No"]} error={errors.nameChangeBank} />

            <PickerField label="Need To Change 1 Phase to 3 Phase"
              selectedValue={remarks.change1to3Phase}
              onValueChange={(val) => handleRemarksChange("change1to3Phase", val)}
              options={["Yes", "No"]} error={errors.change1to3Phase} />

            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Remarks <Text style={styles.star}>*</Text></Text>
              <TextInput
                placeholder="Enter remarks..."
                style={[styles.input, styles.textArea]}
                value={remarks.remarksText}
                onChangeText={(t: string) => handleRemarksChange("remarksText", t)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.remarksText ? <Text style={styles.error}>{errors.remarksText}</Text> : null}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleStep8Submit}>
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </>
        )}

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

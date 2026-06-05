import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Switch,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import API from '../api/api1';

const TITLE_OPTIONS        = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const LEAD_SOURCE_OPTIONS  = ['None','Advertisement','Cold Call','Employee Referral','External Referral','Online Store','Partner','Public Relations','Sales Mail Alias','Seminar Partner','Internal Seminar','Trade Show','Web Download','Web Research','Chat','Twitter','Facebook'];
const INDUSTRY_OPTIONS     = ['None','Agriculture','Apparel','Banking','Biotechnology','Chemicals','Communications','Construction','Education','Electronics','Energy','Engineering','Entertainment','Environmental','Finance','Food & Beverage','Government','Healthcare','Hospitality','Insurance','Machinery','Manufacturing','Media','Not For Profit','Recreation','Retail','Shipping','Technology','Telecommunications','Transportation','Utilities','Other'];
const LEAD_STATUS_OPTIONS  = ['New Lead','Contacted','Not Contacted','Lost Lead','Pre Qualified','Not Qualified'];
const RATING_OPTIONS       = ['None','Acquired','Active','Market Failed','Project Cancelled','Shut Down'];
const REQ_TYPE_OPTIONS     = ['None','Residential','Commercial','Industrial'];
const SERVICE_TYPE_OPTIONS = ['None','On-Grid','Off-Grid','Hybrid'];
const ROOF_TYPE_OPTIONS    = ['None','RCC','Sheet','Tile','Other'];
const PLANNING_OPTIONS     = ['None','Within 1 Month','1-3 Months','3-6 Months','6-12 Months','More than 1 Year'];
const PURPOSE_OPTIONS      = ['None','Save Electricity Bill','Backup Power','Both'];

const INPUT_FIELDS = [
  'firstName', 'lastName', 'customerName', 'employeeName',
  'phone', 'mobile', 'whatsapp', 'email', 'secondaryEmail',
  'company', 'website', 'fax', 'annualRevenue', 'noOfEmployees',
  'skypeId', 'twitter', 'socialLeadId', 'ebNumbers', 'wattageRequired',
  'monthlyBill', 'street', 'district', 'province', 'country', 'postalCode',
  'description', 'nextFollowUp', 'futureProspect'
];

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: '#F7F7FA' },
  header:             { backgroundColor: '#C8000A', paddingTop: 52, paddingHorizontal: 18, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  subtitleBanner:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FEF3F3', paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5DADA' },
  subtitleText:       { fontSize: 12, color: '#A32D2D', fontWeight: '600' },
  scrollContent:      { padding: 16, paddingBottom: 40 },
  formCard:           { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 14 },
  sectionHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#FEF0F0' },
  sectionTitle:       { fontSize: 13, fontWeight: '800', color: '#C8000A', textTransform: 'uppercase', letterSpacing: 0.8 },
  row:                { flexDirection: 'row', gap: 10 },
  halfField:          { flex: 1 },
  fieldWrapper:       { marginBottom: 14 },
  labelRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  fieldLabel:         { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  requiredStar:       { fontSize: 14, fontWeight: '700', color: '#C8000A', lineHeight: 18 },
  inputBox:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#EAEAEA', borderRadius: 12, backgroundColor: '#FAFAFA', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 13 : 10 },
  inputBoxFocused:    { borderColor: '#C8000A', backgroundColor: '#fff', shadowColor: '#C8000A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
  inputBoxFilled:     { borderColor: '#D0D0D0', backgroundColor: '#fff' },
  inputBoxMultiline:  { alignItems: 'flex-start', paddingTop: 12 },
  inputIcon:          { width: 20, marginRight: 8 },
  prefixText:         { fontSize: 13, color: '#888', fontWeight: '600', marginRight: 2 },
  textInput:          { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '500', padding: 0 },
  textInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  dropdownText:       { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  dropdownList:       { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#F0D0D0', borderRadius: 12, marginTop: 4, shadowColor: '#C8000A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 5, zIndex: 999 },
  dropdownItem:       { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#FAF0F0' },
  dropdownItemActive: { backgroundColor: '#FEF3F3' },
  dropdownItemText:   { fontSize: 14, color: '#333', fontWeight: '500' },
  dropdownItemActive2:{ color: '#C8000A', fontWeight: '700' },
  toggleRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  toggleHint:         { fontSize: 11, color: '#bbb', marginTop: 2 },
  requiredNote:       { fontSize: 11, color: '#bbb', marginBottom: 20, marginLeft: 4 },
  submitBtn:          { backgroundColor: '#C8000A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#C8000A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginBottom: 14 },
  submitBtnDisabled:  { backgroundColor: '#E08888', shadowOpacity: 0, elevation: 0 },
  submitBtnInner:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitBtnText:      { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  cancelLink:         { alignItems: 'center', paddingVertical: 8 },
  cancelLinkText:     { fontSize: 13, color: '#aaa', fontWeight: '600', textDecorationLine: 'underline' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={15} color="#C8000A" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, required }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {required ? <Text style={styles.requiredStar}> *</Text> : null}
    </View>
  );
}

function InlineDropdown({ options, value, onChange, placeholder, icon }) {
  const [open, setOpen] = useState(false);
  function toggle() { setOpen(function(v) { return !v; }); }
  function select(opt) {
    onChange(opt === 'None' ? '' : opt);
    setOpen(false);
  }
  return (
    <View>
      <TouchableOpacity
        style={[styles.inputBox, open && styles.inputBoxFocused, value && styles.inputBoxFilled]}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={17} color={open ? '#C8000A' : '#bbb'} style={styles.inputIcon} />
        <Text style={[styles.dropdownText, !value && { color: '#ccc' }]}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#bbb" />
      </TouchableOpacity>
      {open ? (
        <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {options.map(function(opt) {
            var isActive = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                onPress={function() { select(opt); }}
              >
                <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemActive2]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ✅ FIX: focusedField global state நீக்கி, local isFocused state use பண்றோம்
function Field({
  label, placeholder, icon, value, onChange,
  keyboard, maxLength, required, prefix, multiline, autoCapitalize,
  inputRef, onSubmitEditing,
}) {
  var hasValue = value && value.length > 0;
  var cap = autoCapitalize !== undefined ? autoCapitalize : (keyboard === 'phone-pad' ? 'none' : 'words');

  return (
    <View style={styles.fieldWrapper}>
      <FieldLabel label={label} required={required} />
      <View style={[
        styles.inputBox,
        hasValue && styles.inputBoxFilled,
        multiline && styles.inputBoxMultiline
      ]}>
        <Ionicons name={icon} size={17} color="#bbb" style={styles.inputIcon} />
        {prefix ? <Text style={styles.prefixText}>{prefix}</Text> : null}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, multiline && styles.textInputMultiline]}
          placeholder={placeholder}
          placeholderTextColor="#ccc"
          value={value || ''}
          onChangeText={onChange}
          keyboardType={keyboard || 'default'}
          maxLength={maxLength}
          autoCapitalize={cap}
          returnKeyType={multiline ? 'default' : 'next'}
          onSubmitEditing={onSubmitEditing}
          multiline={!!multiline}
          numberOfLines={multiline ? 3 : 1}
          blurOnSubmit={false}
        />
        {hasValue && !multiline ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={17} color="#ccc" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ToggleField({ label, hint, value, onChange }) {
  return (
    <View style={[styles.fieldWrapper, styles.toggleRow]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E0E0E0', true: '#F5BABA' }}
        thumbColor={value ? '#C8000A' : '#ccc'}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateLeadScreen
// ─────────────────────────────────────────────────────────────────────────────
function CreateLeadScreen({ navigation }) {

  const inputRefs = useRef({});
  const btnScale  = useRef(new Animated.Value(1));

  // ── UI state ──
  var [creating, setCreating] = useState(false);
  // focusedField / setFocusedField நீக்கிட்டோம் ✅

  // ── Lead Information ──
  var [title,          setTitle]          = useState('');
  var [firstName,      setFirstName]      = useState('');
  var [lastName,       setLastName]       = useState('');
  var [customerName,   setCustomerName]   = useState('');
  var [employeeName,   setEmployeeName]   = useState('');
  var [phone,          setPhone]          = useState('');
  var [mobile,         setMobile]         = useState('');
  var [whatsapp,       setWhatsapp]       = useState('');
  var [email,          setEmail]          = useState('');
  var [secondaryEmail, setSecondaryEmail] = useState('');
  var [company,        setCompany]        = useState('');
  var [website,        setWebsite]        = useState('');
  var [fax,            setFax]            = useState('');
  var [leadSource,     setLeadSource]     = useState('');
  var [leadStatus,     setLeadStatus]     = useState('New Lead');
  var [industry,       setIndustry]       = useState('');
  var [rating,         setRating]         = useState('');
  var [annualRevenue,  setAnnualRevenue]  = useState('');
  var [noOfEmployees,  setNoOfEmployees]  = useState('');
  var [emailOptOut,    setEmailOptOut]    = useState(false);
  var [socialLeadId,   setSocialLeadId]   = useState('');
  var [skypeId,        setSkypeId]        = useState('');
  var [twitter,        setTwitter]        = useState('');

  // ── Requirements ──
  var [requirementType,   setRequirementType]   = useState('');
  var [serviceType,       setServiceType]       = useState('');
  var [ebNumbers,         setEbNumbers]         = useState('');
  var [wattageRequired,   setWattageRequired]   = useState('');
  var [typeOfRoof,        setTypeOfRoof]        = useState('');
  var [planningToInstall, setPlanningToInstall] = useState('');
  var [monthlyBill,       setMonthlyBill]       = useState('');
  var [purposeOfSolar,    setPurposeOfSolar]    = useState('');

  // ── Address ──
  var [street,     setStreet]     = useState('');
  var [district,   setDistrict]   = useState('');
  var [province,   setProvince]   = useState('');
  var [country,    setCountry]    = useState('');
  var [postalCode, setPostalCode] = useState('');

  // ── Description ──
  var [description, setDescription] = useState('');

  // ── Follow Up ──
  var [nextFollowUp,   setNextFollowUp]   = useState('');
  var [futureProspect, setFutureProspect] = useState('');

  // ── Developer ──
  var [sitesurveyRequested, setSitesurveyRequested] = useState(false);
  var [taskCompleted,       setTaskCompleted]       = useState(false);
  var [quoteRequested,      setQuoteRequested]      = useState(false);

  const handleNextField = (fieldKey) => {
    const currentIndex = INPUT_FIELDS.indexOf(fieldKey);
    if (currentIndex !== -1 && currentIndex < INPUT_FIELDS.length - 1) {
      const nextFieldKey = INPUT_FIELDS[currentIndex + 1];
      if (inputRefs.current[nextFieldKey]) {
        inputRefs.current[nextFieldKey].focus();
      }
    }
  };

  function onPressIn()  { Animated.spring(btnScale.current, { toValue: 0.96, useNativeDriver: true }).start(); }
  function onPressOut() { Animated.spring(btnScale.current, { toValue: 1,    useNativeDriver: true }).start(); }

  var isFormValid = ((firstName && firstName.trim().length > 0) || (lastName && lastName.trim().length > 0)) && (mobile && mobile.trim().length >= 10);

  async function handleCreate() {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert('Required', 'First Name or Last Name is required.');
      return;
    }
    if ((mobile || '').trim().length < 10) {
      Alert.alert('Required', 'Enter a valid 10-digit mobile number.');
      return;
    }
    setCreating(true);
    try {
      await API.post('/order/add', {
        title: title || '',
        firstName: (firstName || '').trim(),
        lastName: (lastName || '').trim(),
        customerName: (customerName || '').trim(),
        employeeName: (employeeName || '').trim(),
        phone: (phone || '').trim(),
        mobile: (mobile || '').trim(),
        whatsappNumber: (whatsapp || '').trim(),
        email: (email || '').trim(),
        secondaryEmail: (secondaryEmail || '').trim(),
        company: (company || '').trim(),
        website: (website || '').trim(),
        fax: (fax || '').trim(),
        leadSource: leadSource || '',
        leadStatus: leadStatus || 'New Lead',
        industry: industry || '',
        rating: rating || '',
        annualRevenue: (annualRevenue || '').trim(),
        noOfEmployees: (noOfEmployees || '').trim(),
        emailOptOut: emailOptOut || false,
        socialLeadId: (socialLeadId || '').trim(),
        skypeId: (skypeId || '').trim(),
        twitter: (twitter || '').trim(),
        requirementType: requirementType || '',
        serviceType: serviceType || '',
        ebNumbers: (ebNumbers || '').trim(),
        wattageRequired: (wattageRequired || '').trim(),
        typeOfRoof: typeOfRoof || '',
        planningToInstall: planningToInstall || '',
        monthlyBill: (monthlyBill || '').trim(),
        purposeOfSolar: purposeOfSolar || '',
        street: (street || '').trim(),
        district: (district || '').trim(),
        province: (province || '').trim(),
        country: (country || '').trim(),
        postalCode: (postalCode || '').trim(),
        description: (description || '').trim(),
        nextFollowUp: (nextFollowUp || '').trim(),
        futureProspect: (futureProspect || '').trim(),
        sitesurveyRequested: sitesurveyRequested || false,
        taskCompleted: taskCompleted || false,
        quoteRequested: quoteRequested || false,
      });
      Alert.alert('✓ Lead Created', 'New lead has been created successfully!', [
        { text: 'OK', onPress: function() { navigation.goBack(); } },
      ]);
    } catch (e) {
      Alert.alert('Error', (e && e.response && e.response.data && e.response.data.message) || 'Failed to create lead. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Lead</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.subtitleBanner}>
        <Ionicons name="add-circle-outline" size={16} color="#C8000A" />
        <Text style={styles.subtitleText}>Fill in the customer details below</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* SECTION 1 — LEAD INFORMATION */}
          <View style={styles.formCard}>
            <SectionHeader icon="person-circle-outline" title="Lead Information" />

            <View style={styles.fieldWrapper}>
              <FieldLabel label="Title" />
              <InlineDropdown options={TITLE_OPTIONS} value={title} onChange={setTitle} placeholder="Select title" icon="chevron-down-circle-outline" />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldWrapper, styles.halfField]}>
                <Field label="First Name" required placeholder="First name" icon="person-outline" value={firstName} onChange={setFirstName} autoCapitalize="words" inputRef={(ref) => { inputRefs.current.firstName = ref; }} onSubmitEditing={() => handleNextField('firstName')} />
              </View>
              <View style={[styles.fieldWrapper, styles.halfField]}>
                <Field label="Last Name" placeholder="Last name" icon="person-outline" value={lastName} onChange={setLastName} autoCapitalize="words" inputRef={(ref) => { inputRefs.current.lastName = ref; }} onSubmitEditing={() => handleNextField('lastName')} />
              </View>
            </View>

            <Field label="Customer Name"   placeholder="Enter customer name"   icon="person-outline"        value={customerName}   onChange={setCustomerName}   inputRef={(ref) => { inputRefs.current.customerName = ref; }}   onSubmitEditing={() => handleNextField('customerName')} />
            <Field label="Employee Name"   placeholder="Enter employee name"   icon="id-card-outline"       value={employeeName}   onChange={setEmployeeName}   inputRef={(ref) => { inputRefs.current.employeeName = ref; }}   onSubmitEditing={() => handleNextField('employeeName')} />
            <Field label="Phone"           placeholder="Landline number"       icon="call-outline"           value={phone}          onChange={setPhone}          keyboard="phone-pad" inputRef={(ref) => { inputRefs.current.phone = ref; }}          onSubmitEditing={() => handleNextField('phone')} />
            <Field label="Mobile"          placeholder="10-digit mobile"       icon="phone-portrait-outline" value={mobile}         onChange={setMobile}         keyboard="phone-pad" maxLength={10} required inputRef={(ref) => { inputRefs.current.mobile = ref; }}         onSubmitEditing={() => handleNextField('mobile')} />
            <Field label="WhatsApp Number" placeholder="WhatsApp number"       icon="logo-whatsapp"          value={whatsapp}       onChange={setWhatsapp}       keyboard="phone-pad" maxLength={10} inputRef={(ref) => { inputRefs.current.whatsapp = ref; }}       onSubmitEditing={() => handleNextField('whatsapp')} />
            <Field label="Email"           placeholder="email@example.com"     icon="mail-outline"           value={email}          onChange={setEmail}          keyboard="email-address" autoCapitalize="none" inputRef={(ref) => { inputRefs.current.email = ref; }}          onSubmitEditing={() => handleNextField('email')} />
            <Field label="Secondary Email" placeholder="secondary@example.com" icon="mail-unread-outline"    value={secondaryEmail} onChange={setSecondaryEmail} keyboard="email-address" autoCapitalize="none" inputRef={(ref) => { inputRefs.current.secondaryEmail = ref; }} onSubmitEditing={() => handleNextField('secondaryEmail')} />
            <Field label="Company"         placeholder="Company name"          icon="business-outline"       value={company}        onChange={setCompany}        inputRef={(ref) => { inputRefs.current.company = ref; }}        onSubmitEditing={() => handleNextField('company')} />
            <Field label="Website"         placeholder="https://example.com"   icon="globe-outline"          value={website}        onChange={setWebsite}        keyboard="url" autoCapitalize="none" inputRef={(ref) => { inputRefs.current.website = ref; }}        onSubmitEditing={() => handleNextField('website')} />
            <Field label="Fax"             placeholder="Fax number"            icon="print-outline"          value={fax}            onChange={setFax}            keyboard="phone-pad" inputRef={(ref) => { inputRefs.current.fax = ref; }}            onSubmitEditing={() => handleNextField('fax')} />

            <View style={styles.fieldWrapper}>
              <FieldLabel label="Lead Source" />
              <InlineDropdown options={LEAD_SOURCE_OPTIONS} value={leadSource} onChange={setLeadSource} placeholder="Select lead source" icon="funnel-outline" />
            </View>
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Lead Status" />
              <InlineDropdown options={LEAD_STATUS_OPTIONS} value={leadStatus} onChange={setLeadStatus} placeholder="Select status" icon="flag-outline" />
            </View>
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Industry" />
              <InlineDropdown options={INDUSTRY_OPTIONS} value={industry} onChange={setIndustry} placeholder="Select industry" icon="briefcase-outline" />
            </View>

            <Field label="Annual Revenue (₹)" placeholder="Enter amount"    icon="cash-outline"   value={annualRevenue} onChange={setAnnualRevenue} keyboard="numeric" prefix="₹ " inputRef={(ref) => { inputRefs.current.annualRevenue = ref; }} onSubmitEditing={() => handleNextField('annualRevenue')} />
            <Field label="No. of Employees"   placeholder="Employee count"  icon="people-outline" value={noOfEmployees} onChange={setNoOfEmployees} keyboard="numeric"          inputRef={(ref) => { inputRefs.current.noOfEmployees = ref; }} onSubmitEditing={() => handleNextField('noOfEmployees')} />

            <View style={styles.fieldWrapper}>
              <FieldLabel label="Rating" />
              <InlineDropdown options={RATING_OPTIONS} value={rating} onChange={setRating} placeholder="Select rating" icon="star-outline" />
            </View>

            <Field label="Skype ID"       placeholder="Skype username" icon="logo-skype"          value={skypeId}     onChange={setSkypeId}     autoCapitalize="none" inputRef={(ref) => { inputRefs.current.skypeId = ref; }}     onSubmitEditing={() => handleNextField('skypeId')} />
            <Field label="Twitter"        placeholder="@username"      icon="logo-twitter"         value={twitter}     onChange={setTwitter}     autoCapitalize="none" inputRef={(ref) => { inputRefs.current.twitter = ref; }}     onSubmitEditing={() => handleNextField('twitter')} />
            <Field label="Social Lead ID" placeholder="Social lead ID" icon="share-social-outline" value={socialLeadId} onChange={setSocialLeadId}                    inputRef={(ref) => { inputRefs.current.socialLeadId = ref; }} onSubmitEditing={() => handleNextField('socialLeadId')} />

            <ToggleField label="EMAIL OPT OUT" hint="Customer opted out of email marketing" value={emailOptOut} onChange={setEmailOptOut} />
          </View>

          {/* SECTION 2 — REQUIREMENTS */}
          <View style={styles.formCard}>
            <SectionHeader icon="flash-outline" title="Requirements" />
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Requirement Type" />
              <InlineDropdown options={REQ_TYPE_OPTIONS} value={requirementType} onChange={setRequirementType} placeholder="Select requirement type" icon="layers-outline" />
            </View>
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Service Type" />
              <InlineDropdown options={SERVICE_TYPE_OPTIONS} value={serviceType} onChange={setServiceType} placeholder="Select service type" icon="grid-outline" />
            </View>
            <Field label="EB Numbers"           placeholder="Enter EB number" icon="document-text-outline" value={ebNumbers}       onChange={setEbNumbers}       inputRef={(ref) => { inputRefs.current.ebNumbers = ref; }}       onSubmitEditing={() => handleNextField('ebNumbers')} />
            <Field label="Wattage Required (kW)" placeholder="e.g. 5 kW"     icon="bulb-outline"          value={wattageRequired} onChange={setWattageRequired} keyboard="numeric" inputRef={(ref) => { inputRefs.current.wattageRequired = ref; }} onSubmitEditing={() => handleNextField('wattageRequired')} />
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Type of Roof" />
              <InlineDropdown options={ROOF_TYPE_OPTIONS} value={typeOfRoof} onChange={setTypeOfRoof} placeholder="Select roof type" icon="home-outline" />
            </View>
            <View style={styles.fieldWrapper}>
              <FieldLabel label="When Are You Planning to Install Solar?" />
              <InlineDropdown options={PLANNING_OPTIONS} value={planningToInstall} onChange={setPlanningToInstall} placeholder="Select timeline" icon="calendar-outline" />
            </View>
            <Field label="Average Monthly Bill (₹)" placeholder="e.g. 3000" icon="receipt-outline" value={monthlyBill} onChange={setMonthlyBill} keyboard="numeric" prefix="₹ " inputRef={(ref) => { inputRefs.current.monthlyBill = ref; }} onSubmitEditing={() => handleNextField('monthlyBill')} />
            <View style={styles.fieldWrapper}>
              <FieldLabel label="Purpose of Solar" />
              <InlineDropdown options={PURPOSE_OPTIONS} value={purposeOfSolar} onChange={setPurposeOfSolar} placeholder="Select purpose" icon="sunny-outline" />
            </View>
          </View>

          {/* SECTION 3 — ADDRESS */}
          <View style={styles.formCard}>
            <SectionHeader icon="location-outline" title="Address Information" />
            <Field label="Street"         placeholder="Street address" icon="map-outline"      value={street}     onChange={setStreet}     inputRef={(ref) => { inputRefs.current.street = ref; }}     onSubmitEditing={() => handleNextField('street')} />
            <Field label="District"       placeholder="District"       icon="navigate-outline"  value={district}   onChange={setDistrict}   inputRef={(ref) => { inputRefs.current.district = ref; }}   onSubmitEditing={() => handleNextField('district')} />
            <Field label="Province/State" placeholder="State"          icon="map-outline"       value={province}   onChange={setProvince}   inputRef={(ref) => { inputRefs.current.province = ref; }}   onSubmitEditing={() => handleNextField('province')} />
            <Field label="Country"        placeholder="Country"        icon="earth-outline"     value={country}    onChange={setCountry}    inputRef={(ref) => { inputRefs.current.country = ref; }}    onSubmitEditing={() => handleNextField('country')} />
            <Field label="Postal Code"    placeholder="PIN code"       icon="pin-outline"       value={postalCode} onChange={setPostalCode} keyboard="numeric" maxLength={6} inputRef={(ref) => { inputRefs.current.postalCode = ref; }} onSubmitEditing={() => handleNextField('postalCode')} />
          </View>

          {/* SECTION 4 — DESCRIPTION */}
          <View style={styles.formCard}>
            <SectionHeader icon="document-outline" title="Description Information" />
            <Field label="Description" placeholder="Add notes or description..." icon="create-outline" value={description} onChange={setDescription} multiline inputRef={(ref) => { inputRefs.current.description = ref; }} />
          </View>

          {/* SECTION 5 — FOLLOW UP */}
          <View style={styles.formCard}>
            <SectionHeader icon="alarm-outline" title="Follow Up Information" />
            <Field label="Next Follow Up"       placeholder="DD/MM/YYYY" icon="calendar-outline" value={nextFollowUp}   onChange={setNextFollowUp}   inputRef={(ref) => { inputRefs.current.nextFollowUp = ref; }}   onSubmitEditing={() => handleNextField('nextFollowUp')} />
            <Field label="Future Prospect Date" placeholder="DD/MM/YYYY" icon="time-outline"     value={futureProspect} onChange={setFutureProspect} inputRef={(ref) => { inputRefs.current.futureProspect = ref; }} onSubmitEditing={() => handleNextField('futureProspect')} />
          </View>

          {/* SECTION 6 — DEVELOPER */}
          <View style={styles.formCard}>
            <SectionHeader icon="code-slash-outline" title="Developer Section" />
            <ToggleField label="SITE SURVEY REQUESTED" value={sitesurveyRequested} onChange={setSitesurveyRequested} />
            <ToggleField label="TASK COMPLETED"        value={taskCompleted}       onChange={setTaskCompleted} />
            <ToggleField label="QUOTE REQUESTED"       value={quoteRequested}      onChange={setQuoteRequested} />
          </View>

          <Text style={styles.requiredNote}>* Required fields</Text>

          <Animated.View style={{ transform: [{ scale: btnScale.current }] }}>
            <TouchableOpacity
              style={[styles.submitBtn, (!isFormValid || creating) && styles.submitBtnDisabled]}
              onPress={handleCreate}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={!isFormValid || creating}
              activeOpacity={0.85}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.submitBtnInner}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Create Lead</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default CreateLeadScreen;
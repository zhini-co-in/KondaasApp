import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, Image, StatusBar,
  Alert, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, TextInput, Linking, Platform, RefreshControl,
} from 'react-native';
import API from '../api/api1';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { USER_DATA } from '../service/localStorage';
import {
  saveAcceptedLead,
  getAcceptedLeads,
  updateAcceptedLeadStatus,
  mergeWithServerLeads,
  clearAllLocalData, // ✅ full local wipe helper (leads + template + form drafts)
  cacheTemplate,      // 👇 புதுசா சேர்த்தது — form template proactive-ஆ cache பண்ண
  getCachedTemplate,  // 👇 புதுசா சேர்த்தது — already cache ஆகி இருக்கானு தேவைப்பட்டா check பண்ண
} from '../service/Localleadsstorage';
import { enqueue, processSyncQueue } from '../service/syncQueue';
import { NativeModules } from 'react-native';
import {
  getDistance, getRoadDistanceKm, useLocationTracking,
  requestLocationPermissions, requestIOSLocationPermission, isGPSEnabled,
  startHighFrequencyTracking,
  stopHighFrequencyTracking,
} from '../service/locationService';
import LeadCard from '../components/LeadCard';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PermissionsAndroid } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled Site-Survey due-check helper
// ─────────────────────────────────────────────────────────────────────────────
const isSurveyDue = (scheduledAt) => {
  if (!scheduledAt) return false;
  const scheduledTime = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduledTime)) return false;
  return Date.now() >= scheduledTime;
};

// ─────────────────────────────────────────────────────────────────────────────
// 👇 புதுசா சேர்த்தது: street + address + district + state-ஐ ஒரே
// readable address string-ஆ combine பண்ற helper.
// ─────────────────────────────────────────────────────────────────────────────
const buildFullAddress = (item) => {
  const parts = [item.street, item.address, item.District, item.state].filter(
    (part) => part && String(part).trim().length > 0
  );
  return parts.length > 0 ? parts.join(', ') : (item.address || '');
};

// ─────────────────────────────────────────────────────────────────────────────
// SurveyerScreen
// ─────────────────────────────────────────────────────────────────────────────
const SurveyerScreen = () => {
  const navigation = useNavigation();
  const route      = useRoute();
  const isMounted  = useRef(true);

  const { currentLocation, startTracking, stopTracking } = useLocationTracking(isMounted);

  // locationRef – stale closure தடுக்க
  const locationRef = useRef(null);
  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  const [isOn, setIsOn]                     = useState(false);
  const [leads, setLeads]                   = useState([]);
  const [acceptedLeads, setAcceptedLeads]   = useState([]);
  const [completedLeads, setCompletedLeads] = useState([]);
  const [leadsLoading, setLeadsLoading]     = useState(false);
  const [activeFilter, setActiveFilter]     = useState('all');
  const [isOnline, setIsOnline]             = useState(true);
  const [pendingCount, setPendingCount]     = useState(0);
  const [uploadedPhoto, setUploadedPhoto]   = useState(null);
  const [refreshing, setRefreshing]         = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectComment, setRejectComment]           = useState('');
  const [rejectLeadId, setRejectLeadId]             = useState(null);

  // acceptedLeadsRef – setState inside setState crash தடுக்க
  const acceptedLeadsRef = useRef([]);
  const isCapturingPhoto = useRef(false);

  // 👇 புதுசா சேர்த்தது — ஒரே நேரத்துல template cache 2 தடவை ஓடாம தடுக்க
  const templateCacheInFlight = useRef(false);

  // acceptedLeads set பண்ணும்போது ref-ஐயும் sync பண்ண
  const setAcceptedLeadsSafe = useCallback((updater) => {
    setAcceptedLeads((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      acceptedLeadsRef.current = next;
      return next;
    });
  }, []);

  // ── Proactive template cache ────────────────────────────────────────────
  // 👇 புதுசா சேர்த்தது: form template-ஐ FormScreen open பண்ணும் வரைக்கும்
  // காத்திருக்காம, SurveyerScreen mount ஆனதும் / net திரும்ப வந்ததும்
  // background-ல் தானாக fetch பண்ணி AsyncStorage-ல் cache பண்ணிடுவோம்.
  // இப்படி பண்ணா, Accept பண்ணதும் odane offline ஆனாலும் Site Observation
  // form template already local-ல் இருக்கும், "No Connection" error வராது.
  const ensureTemplateCached = useCallback(async () => {
    if (templateCacheInFlight.current) return;
    templateCacheInFlight.current = true;
    try {
      const netState = await NetInfo.fetch();
      const online = !!netState.isConnected && netState.isInternetReachable !== false;
      if (!online) return; // net இல்லைனா skip, மறுபடி online ஆனப்போ retry ஆகும்

      const res = await API.get('/template/get/solarv1');
      const templateData = res.data?.data || res.data?.template || res.data;
      if (templateData?.schema && templateData?.uischema) {
        await cacheTemplate(templateData);
        console.log('[SurveyerScreen] Form template cached proactively ✅');
      }
    } catch (e) {
      // fail ஆனா silent — FormScreen open பண்ணும்போது இன்னொரு தடவை
      // try ஆகும் (அதுவும் fail ஆனா cached version fallback ஆகும்)
      console.log('[SurveyerScreen] Proactive template cache failed:', e?.message);
    } finally {
      templateCacheInFlight.current = false;
    }
  }, []);

  // ── Net watcher ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener(async (state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) {
        const result = await processSyncQueue();
        if (result.synced > 0) {
          await fetchAndMergeLeads();
        }
        setPendingCount(0);
        ensureTemplateCached(); // 👈 net திரும்ப வந்ததும் template refresh/cache பண்ணு
      }
    });
    return () => unsub();
  }, []);

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    restoreState();
    ensureTemplateCached(); // 👈 app open ஆன உடனே (online-ஆ இருந்தா) template cache பண்ணு
    return () => {
      isMounted.current = false;
      stopTracking();
      stopHighFrequencyTracking();
    };
  }, []);

  // ── Android permissions ───────────────────────────────────────────────────
  useEffect(() => {
    const autoSetup = async () => {
      if (Platform.OS !== 'android') return;
      try { await NativeModules.StartStopService?.requestBatteryOptimization?.(); } catch (e) {}
      const granted = await requestLocationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Location permission is required.', [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
      }
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);
    };
    autoSetup();
  }, []);

  // useFocusEffect – setState inside setState CRASH FIX + auto refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      // ✅ Photo எடுக்கும்போது refresh skip பண்ணு
      if (!isCapturingPhoto.current) {
        fetchAndMergeLeads();
      }

      const completedIds = route.params?.completedIds;
      if (!completedIds || completedIds.length === 0) return;
      navigation.setParams({ completedIds: null });

      const toMove = acceptedLeadsRef.current.filter((l) =>
        completedIds.includes(l.id)
      );
      setAcceptedLeadsSafe((prev) =>
        prev.filter((l) => !completedIds.includes(l.id))
      );
      if (toMove.length > 0) {
        setCompletedLeads((c) => [
          ...c.filter((cl) => !toMove.some((m) => m.id === cl.id)),
          ...toMove.map((l) => ({ ...l, status: 'completed' })),
        ]);
      }
    }, [route.params?.completedIds])
  );

  // ── Restore state ─────────────────────────────────────────────────────────
  const restoreState = async () => {
    const saved = await AsyncStorage.getItem('surveyer_is_on');
    if (saved === 'true') {
      setIsOn(true);
      if (Platform.OS === 'android') NativeModules.StartStopService?.startService();
      startTracking();
    }
    await loadLocalLeads();
    await fetchAndMergeLeads();
  };

  // ── Load local ────────────────────────────────────────────────────────────
  const loadLocalLeads = async () => {
    const local = await getAcceptedLeads();
    if (!isMounted.current) return;

    const accepted  = local.filter((l) => l.status === 'accepted' || l.status === 'inprogress');
    const completed = local.filter((l) => l.status === 'completed');

    acceptedLeadsRef.current = accepted;
    setAcceptedLeads(accepted);
    setCompletedLeads(completed);
  };

  // ── Fetch + merge ─────────────────────────────────────────────────────────
  const fetchAndMergeLeads = async () => {
    setLeadsLoading(true);
    try {
      const surveyorNumber = await getSurveyorNumber();

      const res = await API.get('/order/surveyor', {
        params: { surveyorNumber },
      });

      const rawData = Array.isArray(res.data?.deals) ? res.data.deals : [];

      const storedRejected = await AsyncStorage.getItem('rejected_lead_ids');
      const rejectedIds    = storedRejected ? JSON.parse(storedRejected) : [];

      const mapped = rawData.map((item) => {
        const rawStreet   = item.street || null;
        const rawDistrict = item.district || item.District || null;
        const rawState    = item.state || item.State || null;
        const rawAddress  = item.address || null;

        const fullAddress = buildFullAddress({
          street:   rawStreet,
          address:  rawAddress,
          District: rawDistrict,
          state:    rawState,
        });

        return {
          id:         item._id,
          dealId:     item.deal_id,
          name:       item.deal_name || item.name || '—',
          phone:      item.mobile,
          city:       item.city,
          comment:    item.comment,
          street:     rawStreet,
          District:   rawDistrict,
          state:      rawState,

          referredBy: item.referredBy || item.referred_by || item.Referred_By || null,
          serviceAgentName: item.ServiceAgentName || item.serviceAgentName || null,
          subDistrict: item.SubDistrict || item.subDistrict || null,
          date:       item.assignedAt,
          time:       item.time,
          latitude:   item.latitude,
          longitude:  item.longitude,
          whatsappNo: item.whatsappNo,
          email:      item.email,
          address:    fullAddress,
          status:     item.siteSurveyStatus ?? 'notassigned',

          scheduledAt: item.siteSurveyDateTime || null,
          siteSurveyAssignedBy: item.CreatedBy || item.createdBy || null,
          leadSource:           item.leadSource || item.Lead_Source || null,
          productType:            item.productType,
          orderType:               item.orderType,
          projectType:             item.projectType,
          projectModel:            item.projectModel,
          inverterConnectionType:  item.inverterConnectionType,
          inverterCapacity:        item.inverterCapacity,
          solarPanelModel:         item.solarPanelModel,
          solarPanelBrand:         item.solarPanelBrand,
          noOfPanels:              item.noOfPanels,
          roofType:                item.roofType,
          country: item.country || null,
          zipCode: item.postalCode || item.zipCode || item.Zip_Postal_Code || null,
          home_location:   item.home_location || null,
          office_location: item.office_location || null,
        };
      });

      if (!isMounted.current) return;

      setLeads(
        mapped.filter((l) => l.status === 'notassigned' && !rejectedIds.includes(l.id))
      );

      const serverNonNew = mapped.filter((l) => l.status !== 'notassigned');
      const merged       = await mergeWithServerLeads(serverNonNew);

      const accepted  = merged.filter((l) => l.status === 'accepted' || l.status === 'inprogress');
      const completed = merged.filter((l) => l.status === 'completed');

      acceptedLeadsRef.current = accepted;
      setAcceptedLeads(accepted);
      setCompletedLeads(completed);

    } catch (err) {
    } finally {
      if (isMounted.current) setLeadsLoading(false);
    }
  };

  // ── Try API ───────────────────────────────────────────────────────────────
  const tryApi = async (fn) => {
    try { await fn(); }
    catch (e) { console.log('[SurveyerScreen] API failed (offline):', e?.message); }
  };

  // ── Helper: get surveyor number ───────────────────────────────────────────
  const getSurveyorNumber = async () => {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA);
      const parsed   = userData ? JSON.parse(userData) : null;
      return parsed?.UserInfo?.phoneNo || '';
    } catch (e) {
      return '';
    }
  };

  // ── Auto-open Settings ────────────────────────────────────────────────────
  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings().catch(() => {
        Alert.alert('Error', 'Unable to open settings');
      });
    }
  };

  // ── Camera permission ─────────────────────────────────────────────────────
  const requestCameraPermission = async () => {
    if (Platform.OS !== 'android') return { granted: true, neverAskAgain: false };
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title:           'Camera Permission Required',
          message:         'We need camera access to take survey photos.',
          buttonNegative:  'Cancel',
          buttonPositive:  'Allow',
        }
      );
      return {
        granted:       granted === PermissionsAndroid.RESULTS.GRANTED,
        neverAskAgain: granted === 'never_ask_again',
        status:        granted,
      };
    } catch (err) {
      return { granted: false, neverAskAgain: false, status: 'error' };
    }
  };

  // ── Gallery permission ────────────────────────────────────────────────────
  const requestGalleryPermission = async () => {
    if (Platform.OS !== 'android') return { granted: true, neverAskAgain: false };
    try {
      const permission =
        Platform.Version >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const granted = await PermissionsAndroid.request(permission, {
        title:           'Gallery Permission Required',
        message:         'We need access to your gallery to select photos for surveys.',
        buttonNegative:  'Cancel',
        buttonPositive:  'Allow',
      });
      return {
        granted:       granted === PermissionsAndroid.RESULTS.GRANTED,
        neverAskAgain: granted === 'never_ask_again',
        status:        granted,
      };
    } catch (err) {
      return { granted: false, neverAskAgain: false, status: 'error' };
    }
  };

  // ── Accept ────────────────────────────────────────────────────────────────
  const handleAccept = async (item) => {
    await saveAcceptedLead(item);
    setLeads((prev) => prev.filter((l) => l.id !== item.id));

    setAcceptedLeadsSafe((prev) => {
      if (prev.some((l) => l.id === item.id)) return prev;
      return [...prev, { ...item, status: 'accepted' }];
    });

    // 👇 புதுசா சேர்த்தது: Accept பண்ணதும் form template இன்னும் cache
    // ஆகலைனா, ஒரு தடவை (best-effort, silent) try பண்ணிடுவோம்.
    getCachedTemplate().then((cached) => {
      if (!cached) ensureTemplateCached();
    });

    const surveyorNumber = await getSurveyorNumber();
    const acceptedAt     = Date.now();
    const payload        = { mobile: item.phone, surveyorNumber };

    await enqueue(`accept_${item.id}`, 'ACCEPT_LEAD', payload);

    if (isOnline) {
      tryApi(() => API.post('/order/accept', payload));
      tryApi(() => API.put('/order/updatestatus', { id: item.dealId, status: 'accepted' }));
      tryApi(() => API.post('/order/sync-status', {
        customerMobile: item.phone,
        surveyorNumber,
        status:     'accepted',
        receivedAt: acceptedAt,
      }));
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = (id) => {
    setRejectLeadId(id);
    setRejectComment('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectComment.trim()) {
      Alert.alert('Error', 'Please enter a reason for rejection.');
      return;
    }

    const lead = leads.find((l) => l.id === rejectLeadId);
    if (!lead) return;

    if (!isOnline) {
      Alert.alert('No Connection', 'Rejecting a lead requires internet connection.');
      return;
    }

    const surveyorNumber = await getSurveyorNumber();

    try {
      await API.post('/order/reject', {
        customerMobile: lead.phone,
        name:           lead.name,      // 👈 customerName -> name
        address:        lead.address,   // 👈 customerAddress -> address
        surveyorNumber,
        comment:    rejectComment.trim(),
        receivedAt: Date.now(),
      });

      if (lead.dealId) {
        try {
          await API.delete('/order/delete', { data: { dealId: lead.dealId } });
        } catch (delErr) {
          console.log
        }
      }

      setLeads((prev) => prev.filter((l) => l.id !== rejectLeadId));

      const existing    = await AsyncStorage.getItem('rejected_lead_ids');
      const rejectedIds = existing ? JSON.parse(existing) : [];
      if (!rejectedIds.includes(rejectLeadId)) {
        rejectedIds.push(rejectLeadId);
        await AsyncStorage.setItem('rejected_lead_ids', JSON.stringify(rejectedIds));
      }

      setRejectModalVisible(false);
      setRejectLeadId(null);
      setRejectComment('');
      Alert.alert('Success', 'Lead rejected successfully.');
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to reject.');
    }
  };


  // handleToggle-ல:
  const handleToggle = async () => {
    if (!isOn) {
      isCapturingPhoto.current = true;        // ← flag set
      const uploadSuccess = await takeAndUploadPhoto();
      isCapturingPhoto.current = false;       // ← flag clear

      if (!uploadSuccess) return;
      if (Platform.OS === 'android') {
        const gpsOn = await isGPSEnabled();
        if (!gpsOn) {
          Alert.alert('Location is Off', 'Please turn on GPS to continue.', [
            {
              text: 'Open Settings',
              onPress: () =>
                Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
                  .catch(() => Linking.openSettings()),
            },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        NativeModules.StartStopService?.startService();
      } else if (Platform.OS === 'ios') {
        const granted = await requestIOSLocationPermission();
        if (!granted) {
          Alert.alert('Permission Required', 'Location permission is required.', [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]);
          return;
        }
      }

      setIsOn(true);
      await AsyncStorage.setItem('surveyer_is_on', 'true');
      startTracking();
      fetchAndMergeLeads();
      ensureTemplateCached(); // 👈 duty ON ஆனதும் கூட ஒரு தடவை template cache try பண்ணு
    } else {
      setIsOn(false);
      await AsyncStorage.setItem('surveyer_is_on', 'false');
      stopTracking();
      stopHighFrequencyTracking();
      if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            stopTracking();
            stopHighFrequencyTracking();
            if (Platform.OS === 'android') NativeModules.StartStopService?.stopService();

            // ✅ 1. leads:accepted / leads:template / leads:forms clear
            await clearAllLocalData();

            // ✅ 2. மத்த manual AsyncStorage keys clear
            await AsyncStorage.multiRemove([
              USER_DATA,
              'rejected_lead_ids',
              'surveyer_is_on',
            ]);

            // ✅ 3. dynamic site_distance_<leadId> keys ellam scan panni remove pannu
            const allKeys = await AsyncStorage.getAllKeys();
            const siteDistanceKeys = allKeys.filter((k) => k.startsWith('site_distance_'));
            if (siteDistanceKeys.length > 0) {
              await AsyncStorage.multiRemove(siteDistanceKeys);
            }

            // ✅ 4. in-memory state ellam reset pannu (next login-la stale UI varakudathu)
            acceptedLeadsRef.current = [];
            setLeads([]);
            setAcceptedLeadsSafe([]);
            setCompletedLeads([]);
            setIsOn(false);
            setUploadedPhoto(null);
            setActiveFilter('all');

            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (e) {
            Alert.alert('Error', 'Failed to logout.');
          }
        },
      },
    ]);
  };

  // ── Daily toggle photo upload (surveyor check-in) ─────────────────────────
  const takeAndUploadPhoto = async () => {
    try {
      const perm = await requestCameraPermission();

      if (perm.neverAskAgain) {
        Alert.alert('Camera Blocked', 'Enable camera in app settings.', [
          { text: 'Open Settings', onPress: openAppSettings },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false;
      }
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return false;
      }

      // ✅ FIX 1: Camera init-க்கு சிறிய delay கொடு
      await new Promise((res) => setTimeout(res, 300));

      // ✅ FIX 2: Promise wrap வேண்டாம் — directly await பண்ணு
      const response = await launchCamera({
        mediaType: 'photo',
        cameraType: 'back',
        quality: 0.3,
        saveToPhotos: true,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (response.didCancel) return false;

      if (response.errorCode) {
        Alert.alert('Camera Error', response.errorMessage || 'Failed to open camera');
        return false;
      }

      const photo = response.assets?.[0];
      if (!photo?.uri) {
        Alert.alert('Error', 'No photo captured. Please try again.');
        return false;
      }

      const phoneNo = await getSurveyorNumber();
      if (!phoneNo) {
        Alert.alert('Error', 'Surveyor phone number not found.');
        return false;
      }

      const filename = photo.uri.split('/').pop();
      const match    = /\.(\w+)$/.exec(filename);
      const type     = match ? `image/${match[1]}` : 'image/jpeg';

      const now  = new Date();
      const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
      ].join('-');

      const formData = new FormData();
      formData.append('photo',   { uri: photo.uri, name: filename, type });
      formData.append('phoneNo', phoneNo);
      formData.append('time',    time);

      // ✅ FIX 3: timeout கொடு — network slow-ஆ இருந்தா hang ஆகாம
      const res = await API.post('/notification/daily-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });

      if (res.data?.success) {
        Alert.alert;
        return true;
      } else {
        throw new Error(res.data?.message || 'Upload failed');
      }

    } catch (err) {
      // ✅ FIX 4: user cancel-ஐ error-ஆ காட்டாதே
      if (err?.message?.includes('cancelled') || err?.code === 'E_PICKER_CANCELLED') {
        return false;
      }
      Alert.alert(
        'Upload Failed',
        err?.response?.data?.message || err?.message || 'Could not upload photo. Please try again.'
      );
      return false;
    }
  };

  // ── Manual camera upload button ───────────────────────────────────────────
  const handleUploadPress = async () => {
    try {
      const result = await requestCameraPermission();

      if (result.neverAskAgain) {
        Alert.alert('Camera Blocked', 'Enable camera in app settings.', [
          { text: 'Open Settings', onPress: openAppSettings },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }

      launchCamera(
        { mediaType: 'photo', cameraType: 'back', quality: 0.8, saveToPhotos: true },
        async (response) => {
          if (response.didCancel) return;
          if (response.errorCode) {
            Alert.alert('Camera Error', response.errorMessage || response.errorCode);
            return;
          }

          const photo = response.assets?.[0];
          if (!photo?.uri) return;

          try {
            const surveyorNumber = await getSurveyorNumber();
            const filename       = photo.uri.split('/').pop();
            const match          = /\.(\w+)$/.exec(filename);
            const type           = match ? `image/${match[1]}` : 'image/jpeg';

            const formData = new FormData();
            formData.append('photo',   { uri: photo.uri, name: filename, type });
            formData.append('phoneNo', surveyorNumber);

            const res = await API.post('/notification/upload-photo', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.success) {
              Alert.alert('Uploaded ✅', 'Photo synced successfully!');
            } else {
              throw new Error(res.data?.message || 'Upload failed');
            }
          } catch (e) {
            Alert.alert('Upload Failed', e?.message || 'Could not upload photo.');
          }
        }
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to launch camera.');
    }
  };


  // ── Start / Resume ────────────────────────────────────────────────────────
  const handleStart = async (id) => {
    const lead = acceptedLeadsRef.current.find((l) => l.id === id);
    if (!lead) return;
    const alreadyInProgress = acceptedLeadsRef.current.find(
      (l) => l.status === 'inprogress' && l.id !== id
    );
    if (alreadyInProgress) {
      Alert.alert(
        'One Lead at a Time!',
        `Please complete "${alreadyInProgress.name}" before starting a new lead.`,
        [{ text: 'OK, Got It' }]
      );
      return;
    }

    // STEP 1: ETA + Maps URL calculation
    let etaText  = 'N/A';
    let totalMins = 0;
    let distMeters = null;             // 👈 outer scope-க்கு தூக்கினோம் — கீழ site-distance store பண்ண இதுவே reuse ஆகும்
    const hasLatLong = lead.latitude && lead.longitude;

    if (locationRef.current && hasLatLong) {
      distMeters = Math.round(getDistance(
        locationRef.current.latitude, locationRef.current.longitude,
        parseFloat(lead.latitude), parseFloat(lead.longitude)
      ));
      const speed = distMeters <= 300 ? 1.4 : 8.3;
      totalMins = Math.round(distMeters / speed / 60);
      if (totalMins < 1) {
        etaText = 'Less than a minute';
      } else if (totalMins < 60) {
        etaText = `${totalMins} min`;
      } else {
        const hrs  = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        etaText = mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
      }
    }

    if (locationRef.current && hasLatLong) {
      try {
        const roadKm = await getRoadDistanceKm(
          locationRef.current.latitude, locationRef.current.longitude,
          parseFloat(lead.latitude), parseFloat(lead.longitude)
        );
        const siteKm = roadKm !== null ? roadKm : (distMeters !== null ? distMeters / 1000 : null);
        if (siteKm !== null) {
          await AsyncStorage.setItem(`site_distance_${id}`, String(siteKm));
        }
      } catch (e) {
        if (distMeters !== null) {
          try { await AsyncStorage.setItem(`site_distance_${id}`, String(distMeters / 1000)); } catch (e2) {}
        }
      }
    }

    let mapsUrl = '';
    if (locationRef.current && hasLatLong) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${locationRef.current.latitude},${locationRef.current.longitude}&destination=${lead.latitude},${lead.longitude}`;
    } else if (hasLatLong) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;
    } else if (lead.address || lead.city) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address || lead.city)}`;
    }

    // STEP 2: Status update
    await updateAcceptedLeadStatus(id, 'inprogress');

    setAcceptedLeadsSafe((prev) =>
      prev.map((l) => l.id === id ? { ...l, status: 'inprogress' } : l)
    );

    await enqueue(`status_inprogress_${id}`, 'STATUS_UPDATE', {
      mobile: lead.phone, status: 'inprogress',
    });

    if (isOnline) {
      const surveyorNumber = await getSurveyorNumber();
      const startAt = Date.now();
      const dueAt   = startAt + (totalMins * 60 * 1000);

      tryApi(() => API.put('/order/updatestatus', { id: lead.dealId, status: 'inprogress' }));
      tryApi(() => API.post('/order/inprogress', { mobile: lead.phone, surveyorNumber }));
      tryApi(() => API.post('/order/sync-status', {
        customerMobile: lead.phone,
        surveyorNumber,
        status: 'inprogress',
        startAt,
        dueAt,
      }));

      try {
        await API.post('/notification/trigger', {
          surveyorNumber,
          customerMobile: lead.whatsappNo || lead.phone,
          name:           lead.name,
          scenarioType:   1,
          eta:            totalMins,
          mapsUrl,
        });
      } catch (e) {
      }
    } else {
      await enqueue(`notif_start_${id}`, 'NOTIFICATION', {
        customerMobile: lead.whatsappNo || lead.phone,
        name:           lead.name,
        scenarioType:   1,
        eta:            totalMins,
        mapsUrl,
      });
    }

    startHighFrequencyTracking(() => locationRef.current);

    navigation.navigate('InProgress', {
      lead:            { ...lead, status: 'inprogress', dealId: lead.dealId },
      initialLocation: locationRef.current,
    });
  };

  // ── Pull to refresh ──────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAndMergeLeads();
    setRefreshing(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* OFF STATE */}
      {!isOn && (
        <LinearGradient colors={['#F00001', '#B00100']} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.offLogoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ position: 'absolute', top: 50, right: 20, alignItems: 'center', zIndex: 10 }}>
            <View style={styles.offToggleBtn}>
              <Switch
                trackColor={{ false: '#ffffff88', true: '#fff' }}
                thumbColor="#ED1C25" value={isOn} onValueChange={handleToggle}
              />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingTop: 60, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#fff']} tintColor="#fff" />
            }
          >
            <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 20 }}>
              {uploadedPhoto ? (
                <Image
                  source={{ uri: uploadedPhoto }}
                  style={[styles.logo, { borderRadius: 10 }]}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={require('../../assets/images/kondass.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
            </View>

            <View style={styles.offTextContainer}>
              <Text style={styles.welcome}>Welcome!</Text>
              <Text style={styles.message}>Let's get started! Turn on availability!</Text>
            </View>

            {leads.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: 10 }]}>
                  <View style={[styles.sectionDot, { backgroundColor: '#fff' }]} />
                  <Text style={[styles.sectionTitle, { color: '#fff' }]}>New Leads</Text>
                </View>
                {leadsLoading
                  ? <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
                  : leads.map((item) => (
                      <LeadCard
                        key={item.id}
                        item={item}
                        cardType="unaccepted"
                        currentLocation={locationRef.current}
                        onAccept={handleAccept}
                        onReject={handleReject}
                        isDue={isSurveyDue(item.scheduledAt)}
                      />
                    ))
                }
              </>
            )}
          </ScrollView>
        </LinearGradient>
      )}

      {/* ON STATE */}
      {isOn && (
        <>
          <View style={styles.fixedTopBar}>
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="#ED1C25" />
            </TouchableOpacity>
            <Switch
              trackColor={{ false: '#ccc', true: 'red' }}
              thumbColor="#fff" value={isOn} onValueChange={handleToggle}
            />
          </View>

          {!isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.offlineBannerText}>Offline</Text>
            </View>
          )}

          <ScrollView
            style={{ flex: 1, backgroundColor: '#F5F5F5' }}
            contentContainerStyle={{ paddingTop: !isOnline ? 120 : 90, paddingBottom: 30 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ED1C25']} tintColor="#ED1C25" />
            }
          >
            {/* New Leads */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#ED1C25' }]} />
              <Text style={styles.sectionTitle}>Leads - New</Text>
            </View>

            {leadsLoading && (
              <ActivityIndicator size="large" color="#ED1C25" style={{ marginTop: 30 }} />
            )}
            {!leadsLoading && leads.length === 0 && (
              <Text style={styles.emptyText}>No new leads available.</Text>
            )}
            {!leadsLoading && leads.map((item) => (
              <LeadCard
                key={item.id} item={item} currentLocation={locationRef.current}
                cardType="unaccepted" onAccept={handleAccept} onReject={handleReject}
                isDue={isSurveyDue(item.scheduledAt)}
              />
            ))}

            {/* Accepted / Completed */}
            {(acceptedLeads.length > 0 || completedLeads.length > 0) && (
              <>
                <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.sectionDot, {
                      backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#fd9104',
                    }]} />
                    <Text style={styles.sectionTitle}>
                      {activeFilter === 'completed' ? 'Leads - Completed' : 'Leads - Accepted'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('all')}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                        backgroundColor: activeFilter === 'all' ? '#ED1C25' : '#e5e7eb',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: 'bold',
                        color: activeFilter === 'all' ? '#fff' : '#555',
                      }}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setActiveFilter('completed')}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                        backgroundColor: activeFilter === 'completed' ? '#22c55e' : '#e5e7eb',
                      }}
                    >
                      <Text style={{
                        fontSize: 12, fontWeight: 'bold',
                        color: activeFilter === 'completed' ? '#fff' : '#555',
                      }}>Completed</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {activeFilter === 'all' && (
                  <>
                    {acceptedLeads.map((item) => (
                      <LeadCard
                        key={item.id}
                        item={item}
                        cardType="accepted"
                        currentLocation={locationRef.current}
                        onStart={handleStart}
                        isDue={isSurveyDue(item.scheduledAt)}
                      />
                    ))}
                    {completedLeads.length > 0 && (
                      <>
                        <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.sectionDot, { backgroundColor: '#22c55e' }]} />
                            <Text style={styles.sectionTitle}>Leads - Completed</Text>
                          </View>
                        </View>
                        {completedLeads.map((item) => (
                          <LeadCard
                            key={item.id} item={item}
                            currentLocation={locationRef.current} cardType="completed"
                          />
                        ))}
                      </>
                    )}
                    {acceptedLeads.length === 0 && completedLeads.length === 0 && (
                      <Text style={styles.emptyText}>No leads yet.</Text>
                    )}
                  </>
                )}

                {activeFilter === 'completed' && (
                  completedLeads.length > 0
                    ? completedLeads.map((item) => (
                        <LeadCard
                          key={item.id} item={item}
                          currentLocation={locationRef.current} cardType="completed"
                        />
                      ))
                    : <Text style={styles.emptyText}>No completed leads yet.</Text>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible} transparent animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Reject Reason</Text>
            <Text style={styles.modalLabel}>Comment</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Type your comment here."
              placeholderTextColor="#aaa"
              multiline numberOfLines={4}
              value={rejectComment}
              onChangeText={setRejectComment}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1, backgroundColor: '#aaa' }]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectLeadId(null);
                  setRejectComment('');
                }}
              >
                <Text style={styles.modalSaveBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { flex: 1 }]}
                onPress={confirmReject}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SurveyerScreen;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  logo:          { width: 200, height: 100 },
  offLogoutBtn:  { position: 'absolute', top: 55, left: 20, zIndex: 10 },
  offToggleBtn:  {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
    elevation: 4,
  },
  offTextContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcome:          { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  message:          { marginTop: 10, color: '#ffffffcc', textAlign: 'center', paddingHorizontal: 30 },
  fixedTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#fff', elevation: 6,
  },
  offlineBanner: {
    position: 'absolute', top: 90, left: 0, right: 0, zIndex: 99,
    backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 15, paddingTop: 16, paddingBottom: 6,
  },
  sectionDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  emptyText: {
    textAlign: 'center', marginTop: 40,
    color: '#999', fontSize: 14, paddingHorizontal: 30,
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 12,
    borderRadius: 12, padding: 14, elevation: 3,
  },
  rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  referredBadge: {
    backgroundColor: '#FCEBEB', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start',
  },
  referredText:   { fontSize: 11, color: '#A32D2D' },
  date:           { fontSize: 11, color: '#888' },
  userRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E6F1FB', marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:     { fontSize: 16, fontWeight: '600', color: '#185FA5' },
  name:           { fontSize: 16, fontWeight: 'bold' },
  subText:        { fontSize: 12, color: '#555' },
  iconContainer:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn:        { padding: 4 },
  commentRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginTop: 8,
  },
  comment:  { flex: 1, fontSize: 12, color: '#555' },
  seeMore:  { fontSize: 12 },
  completedPill: {
    backgroundColor: '#EAF3DE', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  completedPillText: { color: '#3B6D11', fontSize: 12, fontWeight: '600' },
  startBtn: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff', width: '85%',
    borderRadius: 12, padding: 20, elevation: 10,
  },
  modalTitle: {
    fontSize: 18, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 16, color: '#222',
  },
  modalLabel: { fontSize: 13, color: '#444', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, color: '#333',
    textAlignVertical: 'top', minHeight: 90, marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#ED1C25', paddingVertical: 13,
    borderRadius: 8, alignItems: 'center',
  },
  modalSaveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  uploadIconBtn:    { marginTop: 10, alignItems: 'center' },
});
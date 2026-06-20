import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from './localStorage';

// ==================== GET USER PHONE ====================

export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    return data ? JSON.parse(data)?.UserInfo?.phoneNo || '' : '';
  } catch (e) {
    console.error('getUserPhone error:', e);
    return '';
  }
};

// ==================== SAVE SCANNED PRODUCT (SIMPLE) ====================

export const saveScannedProduct = async (rawValue, location = null) => {
  try {
    const phoneNo = await getUserPhone();
    if (!phoneNo) {
      console.warn('⚠️ Phone number not found');
      return null;
    }

    if (!rawValue) {
      console.warn('⚠️ Scanned value is empty');
      return null;
    }

    // Simple Payload - Raw value மட்டும் அனுப்புறோம்
    const payload = {
      mobile: phoneNo.toString().trim(),
      rawValue: rawValue.toString().trim(),           // ← முக்கியம்
      scannedAt: new Date().toISOString(),
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
    };

    console.log('📤 Sending Raw Payload:', JSON.stringify(payload, null, 2));

    const res = await API.post('/logistic/products', payload);

    console.log('✅ Saved Successfully:', res.status);
    return res.data;

  } catch (err) {
    console.error('❌ saveScannedProduct ERROR:', err?.response?.data || err.message);

    if (err?.response?.data && typeof err.response.data === 'string' && 
        err.response.data.includes('<!DOCTYPE')) {
      console.error('🔴 Backend returning HTML! Check ngrok URL or Server is running.');
    }

    return null;
  }
};

// Optional: Get scanned products
export const getScannedProducts = async () => {
  try {
    const phoneNo = await getUserPhone();
    if (!phoneNo) return [];

    const res = await API.get('/logistic/products', {
      params: { phoneNo: phoneNo.toString().trim() },
    });
    return res.data ?? [];
  } catch (err) {
    console.error('getScannedProducts error:', err?.response?.data || err.message);
    return [];
  }
};
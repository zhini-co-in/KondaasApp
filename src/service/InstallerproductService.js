import { useRef, useState, useEffect } from 'react';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { 
  PermissionsAndroid, 
  Platform, 
  Alert, 
  Linking, 
  DeviceEventEmitter, 
  NativeModules, 
  NativeEventEmitter 
} from 'react-native';
import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from './localStorage';

// ==================== UTILITIES ====================

export const getUserPhone = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_DATA);
    return data ? JSON.parse(data)?.UserInfo?.phoneNo || '' : '';
  } catch (e) {
    return '';
  }
};

/**
 * Parse raw QR / Barcode string into key-value object
 * Example input:
 *   "Product: Voltage Inverter\nPrice: ₹5000\nMfg Date: 12-06-2026\nContact: 98765 43210"
 */
export const parseQRData = (raw = '') => {
  const result = {};
  if (!raw) return result;

  raw.split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key   = line.substring(0, idx).trim();
    const value = line.substring(idx + 1).trim();
    if (key) result[key] = value;
  });

  return result;
};

// ==================== SAVE SCANNED PRODUCT ====================

/**
 * POST scanned product data to backend
 * Endpoint: POST /logistic/products
 *
 * @param {string} rawValue   - raw string from QR / barcode
 * @param {object|null} location - { latitude, longitude } from locationRef
 * @returns {object|null}     - API response json or null on failure
 */
const parseMfgDate = (mfgStr) => {
  if (!mfgStr) return new Date().toISOString().split('T')[0];
  const parts = mfgStr.split('/');
  if (parts.length === 3) {
    const [yy, mm, dd] = parts;
    return `20${yy}-${mm}-${dd}`;
  }
  return mfgStr;
};

//--mainqrdb---//
export const saveScannedProduct = async (rawValue, location = null) => {
  try {
    const phoneNo = await getUserPhone();
    if (!phoneNo) {
      console.warn('⚠️ phoneNo empty');
      return null;
    }

    // ✅ QR data — JSON format-ஆ or plain text-ஆ check பண்ணு
    let productName      = rawValue;
    let productPrice     = 0;
    let manufacturedDate = new Date().toISOString().split('T')[0];

    try {
      const json = JSON.parse(rawValue);
      // JSON format QR
      productName      = json.productName      ?? rawValue;
      productPrice     = parseFloat(json.productPrice ?? 0);
      manufacturedDate = json.manufacturedDate  ?? manufacturedDate;
    } catch {
      // Plain text QR — parseQRData use பண்ணு
      const parsed     = parseQRData(rawValue);
      productName      = parsed['Product']  ?? rawValue;
      productPrice     = parseFloat(parsed['Price']?.replace(/[^0-9.]/g, '') ?? '0');
      manufacturedDate = parseMfgDate(parsed['Mfg Date'] ?? '');
    }

    const payload = {
      mobile:           phoneNo.toString().trim(),
      productName,
      productPrice,
      manufacturedDate,
    };

    console.log('📤 Sending:', JSON.stringify(payload));

    const res = await API.post('/installer/products', payload);
    console.log('✅ Saved:', res.status, res.data);
    return res.data;

  } catch (err) {
    console.error('❌ saveScannedProduct error:', err?.response?.data || err.message);
    return null;
  }
};

// ==================== GET ALL PRODUCTS (optional) ====================

/**
 * GET all scanned products for this user
 * Endpoint: GET /logistic/products?phoneNo=XXXXXXXXXX
 */
export const getScannedProducts = async () => {
  try {
    const phoneNo = await getUserPhone();
    if (!phoneNo) return [];

    const res = await API.get('/installer/products', {
      params: { phoneNo: phoneNo.toString().trim() },
    });

    console.log('📋 Products fetched:', res.data?.length);
    return res.data ?? [];

  } catch (err) {
    console.error('❌ getScannedProducts error:', err?.response?.data || err.message);
    return [];
  }
};


// export const getScannedProducts = async () => {
//   try {
//     const phoneNo = await getUserPhone();
//     if (!phoneNo) {
//       console.warn('⚠️ phoneNo empty');
//       // Still try without phoneNo as per your URL
//     }

//     const res = await API.get('/installer/get-products', {
//       params: phoneNo ? { phoneNo: phoneNo.toString().trim() } : {}
//     });

//     console.log('📋 Products fetched:', res.data?.length || 0);

//     // Handle different response formats
//     if (res.data?.success && Array.isArray(res.data.products)) {
//       return res.data.products;
//     } else if (Array.isArray(res.data)) {
//       return res.data;
//     } else if (res.data) {
//       return Array.isArray(res.data.data) ? res.data.data : [res.data];
//     }

//     return [];

//   } catch (err) {
//     console.error('❌ getScannedProducts error:', err?.response?.data || err.message);
//     return [];
//   }
// };
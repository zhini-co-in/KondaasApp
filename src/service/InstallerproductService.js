import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from './localStorage';

// ==================== SAVE SCANNED PRODUCT ====================
export const saveScannedProduct = async (rawValue) => {
  try {
    if (!rawValue) {
      console.warn('⚠️ Scanned value is empty');
      return null;
    }

    const payload = {
      rawValue: rawValue.toString().trim(),
    };

    console.log('📤 Saving Scan:', payload);

    const res = await API.post('/installer/products', payload);

    console.log('✅ Scanned Product Saved');
    return res?.data;

  } catch (err) {
    console.error('❌ saveScannedProduct ERROR:', err?.response?.data || err.message);
    return null;
  }
};

// ==================== GET PRODUCTS FOR INSTALLER ====================
export const getScannedProducts = async () => {
  try {
    const res = await API.get('/installer/get-products');

    console.log('📋 Installer products fetched:', res.data?.length || 0);

    if (res.data?.success && Array.isArray(res.data.products)) {
      return res.data.products;
    }
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data?.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }

    return [];

  } catch (err) {
    console.error('❌ getScannedProducts error:', err?.response?.data || err.message);
    return [];
  }
};

// ==================== GET DROPPED PRODUCTS (New) ====================
export const getDroppedProducts = async () => {
  try {
    const res = await API.get('/installer/get-products');

    let all = [];
    if (res.data?.success && Array.isArray(res.data.products)) {
      all = res.data.products;
    } else if (Array.isArray(res.data)) {
      all = res.data;
    } else if (res.data?.data && Array.isArray(res.data.data)) {
      all = res.data.data;
    }

    const dropped = all.filter((p) => p.status === 'dropped');
    console.log('📦 Dropped products fetched:', dropped.length);

    return dropped;

  } catch (err) {
    console.error('❌ getDroppedProducts error:', err?.response?.data || err.message);
    return [];
  }
};

// ==================== GET LOGISTIC PICKED PRODUCTS ==================== 
export const getLogisticPickedProducts = async () => {
  try {
    const res = await API.get('/installer/get-products');

    let all = [];
    if (res.data?.success && Array.isArray(res.data.products)) {
      all = res.data.products;
    } else if (Array.isArray(res.data)) {
      all = res.data;
    } else if (res.data?.data && Array.isArray(res.data.data)) {
      all = res.data.data;
    }

    const picked = all.filter((p) => p.status === 'picked');
    console.log('🚚 Logistic picked products:', picked.length);
    return picked;

  } catch (err) {
    console.error('❌ getLogisticPickedProducts error:', err?.response?.data || err.message);
    return [];
  }
};

// ==================== UPDATE PRODUCT STATUS ====================
export const updateProductStatus = async (id, status) => {
  try {
    if (!id || !status) {
      console.warn('⚠️ id or status missing');
      return null;
    }

    const payload = { id, status };
    console.log('📤 Updating product status:', payload);

    const res = await API.put('/logistic/update-products', payload);

    console.log('✅ Product status updated:', res?.data);
    return res?.data;

  } catch (err) {
    console.error('❌ updateProductStatus ERROR:', err?.response?.data || err.message);
    return null;
  }
};
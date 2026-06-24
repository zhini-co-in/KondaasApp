import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from './localStorage';

// ==================== GET USER PHONE ====================
export const getUserPhone = async () => {
  try {
    const userDataStr = await AsyncStorage.getItem(USER_DATA);
    const userData = userDataStr ? JSON.parse(userDataStr) : null;

    return (
      userData?.UserInfo?.phoneNo ||
      userData?.phoneNo ||
      userData?.mobile ||
      userData?.phone ||
      userData?.mobileNo ||
      ''
    );
  } catch (e) {
    console.error('getUserPhone error:', e);
    return '';
  }
};

// ==================== SAVE SCANNED PRODUCT ====================
export const saveScannedProduct = async (rawValue, location = null) => {
  try {
    if (!rawValue) {
      console.warn('⚠️ Scanned value is empty');
      return null;
    }

    const phoneNo = await getUserPhone();

    const payload = {
      rawValue: rawValue.toString().trim(),
      status: 'picked',
      scannedBy: phoneNo,
      ...(location && {
        deliveryLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      }),
    };

    console.log('📤 Sending Payload:', payload);

    const res = await API.post('/logistic/products', payload);

    console.log(
      '✅ Saved Successfully:',
      res?.status,
      '| _id:',
      res?.data?._id || res?.data?.id
    );

    return res?.data;
  } catch (err) {
    console.error(
      '❌ saveScannedProduct ERROR:',
      err?.response?.data || err.message
    );
    return null;
  }
};

// ==================== CONFIRM DELIVERY TO WAREHOUSE ====================
export const confirmDeliveryToWarehouse = async (products) => {
  try {
    if (!products || products.length === 0) {
      console.warn('⚠️ No products to deliver');
      return null;
    }

    const allProducts = await getScannedProducts();

    const results = await Promise.all(
      products.map(async (p) => {
        const rawCode = (p.rawCode || p.displayText || '').trim();

        const dbProduct = allProducts.find((dbP) => {
          const dbRaw = (dbP.rawValue || '').trim();
          return (
            dbRaw === rawCode ||
            dbRaw.startsWith(rawCode) ||
            rawCode.startsWith(dbRaw.split('\n')[0])
          );
        });

        const id = p._id || p.id || dbProduct?._id;

        if (!id) {
          console.warn('⚠️ No _id found for product');
          return null;
        }

        const res = await API.put('/logistic/update-products', {
          id: id.toString(),
          status: 'dropped',
        });

        return res?.data;
      })
    );

    return results;
  } catch (err) {
    console.error(
      '❌ confirmDeliveryToWarehouse ERROR:',
      err?.response?.data || err.message
    );
    return null;
  }
};

// ==================== GET ALL PRODUCTS FROM DB ====================
export const getScannedProducts = async () => {
  try {
    const res = await API.get('/installer/get-products');

    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.data?.products)) return res.data.products;
    if (Array.isArray(res.data?.data)) return res.data.data;

    return [];
  } catch (err) {
    console.error(
      'getScannedProducts error:',
      err?.response?.data || err.message
    );
    return [];
  }
};
import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from './localStorage';

// ==================== SAVE SCANNED PRODUCT ====================
export const saveScannedProduct = async (rawValue, location = null) => {
  try {
    if (!rawValue) {
      console.warn('⚠️ Scanned value is empty');
      return null;
    }

    // ✅ User phone number எடு
    const userDataStr = await AsyncStorage.getItem(USER_DATA);
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    console.log('👤 USER_DATA:', userData); // ← phone key என்னன்னு பாரு
    const phoneNo = userData?.phoneNo || userData?.mobile || userData?.phone || userData?.mobileNo || null;

    const payload = {
      rawValue: rawValue.toString().trim(),
      status: 'picked',
      scannedBy: phoneNo, // ✅ Phone number
      ...(location && {
        deliveryLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      }),
    };

    console.log('📤 Sending Payload:', payload);

    const res = await API.post('/logistic/products', payload);

    console.log('✅ Saved Successfully:', res?.status, '| _id:', res?.data?._id || res?.data?.id);
    return res?.data;

  } catch (err) {
    console.error('❌ saveScannedProduct ERROR:', err?.response?.data || err.message);
    return null;
  }
};

// ==================== CONFIRM DELIVERY TO WAREHOUSE ====================
// ==================== CONFIRM DELIVERY TO WAREHOUSE ====================
export const confirmDeliveryToWarehouse = async (products) => {
  try {
    if (!products || products.length === 0) {
      console.warn('⚠️ No products to deliver');
      return null;
    }

    const payload = {
      products: products.map(p => ({
        rawValue: p.rawCode || p.displayText || p,
        deal_id: p.deal_id || null
      })),
      status: "DELIVERED_TO_WAREHOUSE",
      deliveredAt: new Date().toISOString(),
    };

    console.log('📤 Confirming Delivery:', payload);

    const res = await API.put('/logistic/update-products', payload);
        console.log('✅ Updated:', id, '→ dropped');
        return res?.data;

  } catch (err) {
    console.error('❌ confirmDeliveryToWarehouse ERROR:', err?.response?.data || err.message);
    return null;
  }
};

// ==================== GET ALL PRODUCTS FROM DB ====================
// export const getScannedProducts = async () => {
//   try {
//     // Same endpoint installer uses — all products in DB
//     const res = await API.get('/installer/get-products');
//     console.log('📋 Fetched from DB:', res?.data?.length || 0);
//     if (Array.isArray(res.data)) return res.data;
//     if (Array.isArray(res.data?.products)) return res.data.products;
//     if (Array.isArray(res.data?.data)) return res.data.data;
//     return [];
//   } catch (err) {
//     console.error('❌ getScannedProducts error:', err?.response?.data || err.message);
//     return [];
//   }
// };

// ==================== GET NEW ASSIGNED CARDS FROM ADMIN ====================
export const getNewAssignedCards = async () => {
  try {
    const userDataStr = await AsyncStorage.getItem(USER_DATA);
    const userData = userDataStr ? JSON.parse(userDataStr) : {};
    const mobile = userData?.UserInfo?.phoneNo || 
                   userData?.phoneNo || 
                   userData?.mobile || 
                   userData?.phone || '';

    if (!mobile) {
      console.warn('⚠️ Mobile number not found');
      return [];
    }

    console.log('📱 Fetching deals for mobile:', mobile);

    const res = await API.get(`/logistic/deals?mobile=${mobile}`);

    const deals = Array.isArray(res.data?.data) ? res.data.data : 
                  Array.isArray(res.data) ? res.data : [];

    console.log('🆕 New Assigned Cards Loaded:', deals.length);
    return deals;

  } catch (err) {
    console.error('❌ getNewAssignedCards ERROR:', err?.response?.data || err.message);
    return [];
  }
};

// ==================== ACCEPT ASSIGNED DEAL ====================
export const acceptAssignedDeal = async (dealId) => {
  try {
    if (!dealId) {
      console.warn('⚠️ Deal ID missing');
      return null;
    }

    const payload = { 
      id: dealId.toString(), 
      status: 'accepted' 
    };

    console.log('📤 Accepting Deal:', payload);

    const res = await API.put('/logistic/update-products', payload);

    console.log('✅ Deal Accepted Successfully');
    return res?.data;

  } catch (err) {
    console.error('❌ acceptAssignedDeal ERROR:', err?.response?.data || err.message);
    return null;
  }
};

export const updateLogisticsStatus = async (deal_id, status) => {
  try {
    if (!deal_id || !status) {
      console.warn('⚠️ Missing deal_id or status');
      return null;
    }

    const payload = { deal_id, status };

    console.log('📤 Updating status:', payload);

    // Try all possible paths
    const urls = [
      '/update-status',
      '/logistic/update-status',
      '/logistic/deals/update-status',
      '/api/update-status'
    ];

    let res = null;
    for (const url of urls) {
      try {
        res = await API.put(url, payload);
        console.log(`✅ SUCCESS with URL: ${url}`);
        break;
      } catch (e) {
        console.log(`❌ Failed: ${url}`);
      }
    }

    if (res) {
      console.log('✅ Status Updated:', status);
      return res?.data;
    } else {
      console.error('❌ All URLs failed - Check backend router');
      return null;
    }

  } catch (err) {
    console.error('❌ updateLogisticsStatus ERROR:', err?.response?.data || err.message);
    return null;
  }
};
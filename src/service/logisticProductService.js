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

    const userDataStr = await AsyncStorage.getItem(USER_DATA);
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    console.log('👤 USER_DATA:', userData);
    const phoneNo = userData?.phoneNo || userData?.mobile || userData?.phone || userData?.mobileNo || null;

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

    console.log('✅ Saved Successfully:', res?.status, '| _id:', res?.data?._id || res?.data?.id);
    return res?.data;

  } catch (err) {
    console.error('❌ saveScannedProduct ERROR:', err?.response?.data || err.message);
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
    return res?.data;

  } catch (err) {
    console.error('❌ confirmDeliveryToWarehouse ERROR:', err?.response?.data || err.message);
    return null;
  }
};

// ==================== NORMALIZE RAW DISPATCH → CARD SHAPE ====================
// 🆕 Maps the real /dispatches/my-dispatches response shape (dispatch_number,
// driver_name, vehicle_number, packages[]...) into the flat shape the UI
// components (LogisticDealCard / LogisticCardTrackingModal) already expect.
const normaliseDispatch = (raw) => {
  const packages = raw.packages || [];

  // All product names across all packages (for chips display)
  const productNames = packages.flatMap(pkg =>
    (pkg.package_items || []).map(item => item.product_name)
  );

  // Address from first package's billing/shipping street
  const firstPkg = packages[0] || {};
  const address = firstPkg.shipping_street || firstPkg.billing_street || 'Address not available';

  return {
    deal_id: raw.dispatch_number || raw._id,   // shown as #DIS-0027
    _id: raw._id,
    status: 'pending',                          // ⚠️ dispatch_status "Ready" is backend-side wording;
                                                 // confirm with backend how accept/pickup/deliver map here
    dispatch_status: raw.dispatch_status,        // keep raw value too, for reference/debugging
    address,
    assignedAt: raw.createdAt,
    driverName: raw.driver_name,
    vehicleNumber: raw.vehicle_number,
    deliveryMethod: raw.delivery_method,
    products_info: productNames,                 // used by chips in LogisticDealCard
    packages,                                     // full package breakdown for "View details"
  };
};

// ==================== GET NEW ASSIGNED CARDS FROM ADMIN (dispatches) ====================
// 🆕 OFFLINE-SAFE CACHE
// Every successful fetch is mirrored into AsyncStorage. If a later fetch
// fails (no network, server down, etc.), we return the last known-good list
// from cache instead of an empty array — so a pull-to-refresh while offline
// can no longer wipe cards that are already showing on screen.
const ASSIGNED_CARDS_CACHE_KEY = 'cached_assigned_cards';

const cacheAssignedCards = async (cards) => {
  try {
    await AsyncStorage.setItem(ASSIGNED_CARDS_CACHE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.warn('[getNewAssignedCards] cacheAssignedCards error:', e.message);
  }
};

const getCachedAssignedCards = async () => {
  try {
    const raw = await AsyncStorage.getItem(ASSIGNED_CARDS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[getNewAssignedCards] getCachedAssignedCards error:', e.message);
    return [];
  }
};

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
      // 🆕 still fall back to cache rather than wiping the screen
      return await getCachedAssignedCards();
    }

    console.log('📱 Fetching dispatches for driver_mobile:', mobile);

    const res = await API.get(`/logistic/my-dispatches?driver_mobile=${mobile}`);

    const rawDeals = Array.isArray(res.data?.data) ? res.data.data : [];

    console.log('🆕 New Assigned Cards Loaded:', rawDeals.length);

    const normalised = rawDeals.map(normaliseDispatch);

    // 🆕 fetch succeeded — refresh the offline cache for next time
    await cacheAssignedCards(normalised);

    return normalised;

  } catch (err) {
    console.error('❌ getNewAssignedCards ERROR:', err?.response?.data || err.message);
    // 🆕 network/server failure — DON'T return [] (that wipes the screen).
    // Return whatever we last successfully fetched instead.
    const cached = await getCachedAssignedCards();
    console.log('📦 getNewAssignedCards: serving', cached.length, 'card(s) from offline cache');
    return cached;
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

    const res = await API.put('/logistic/update-status', payload);
    console.log('✅ Status Updated:', status);
    return res?.data;

  } catch (err) {
    console.error(
      '❌ updateLogisticsStatus ERROR:',
      err?.response?.status,
      err?.response?.data || err.message
    );
    return null;
  }
};
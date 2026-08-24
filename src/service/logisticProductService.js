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

    console.log('📱 Fetching dispatches for driver_mobile:', mobile);

    const res = await API.get(`/logistic/my-dispatches?driver_mobile=${mobile}`);

    // 🆕 add here — check raw response shape first
    console.log('🔍 RAW RES:', JSON.stringify(res, null, 2));

    const rawDeals = Array.isArray(res.data?.data) ? res.data.data : [];

    // 🆕 add here — check if rawDeals actually has packages before normalising
    console.log('🔍 rawDeals[0]:', JSON.stringify(rawDeals[0], null, 2));

    console.log('🆕 New Assigned Cards Loaded:', rawDeals.length);

    const normalised = rawDeals.map(normaliseDispatch);

    // 🆕 add here — check output AFTER normalising, this is what UI actually gets
    console.log('🔍 Sample normalised card:', JSON.stringify(normalised[0], null, 2));

    return normalised;

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

    const res = await API.put('/logistic/update-status', payload);
    console.log('✅ Status Updated:', status);
    return res?.data;

  } catch (err) {
    // 🆕 print the REAL server error — status code + body — instead of
    // silently trying more URLs. This is what tells us auth vs validation vs 404.
    console.error(
      '❌ updateLogisticsStatus ERROR:',
      err?.response?.status,
      err?.response?.data || err.message
    );
    return null;
  }
};
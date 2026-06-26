// utils/notificationService.js
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import {
  saveAcceptedLead,
  getAcceptedLeads
} from '../service/Localleadsstorage';

export async function createNotificationChannel() {
  await notifee.createChannel({
    id: 'custom_sound_channel_v2',
    name: 'Lead Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'kondaas',
  });
  await notifee.createChannel({
    id: 'weekly_summary_channel_v1',
    name: 'Weekly Summary',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

export async function showLeadNotification(data) {
  if (!data) return;

  //
  if (data.type === 'weekly_summary') {
    console.log('[notificationService] Weekly summary â€” skipping lead UI');
    return;
  }

  //
  if (!data.leadId && !data.customerMobile) {
    console.log('[notificationService] No leadId/mobile â€” skipping');
    return;
  }

  // Inside his frontend showLeadNotification(data) function:
await notifee.displayNotification({
  id: data.deal_id || String(Date.now()), // 👈 Changed from data.leadId
  title: '🔔 New Lead Nearby!',
  body: `👤 ${data.customer_name || 'Customer'}  ⚡ ${data.kilovolt || 'N/A'} kV`,
  data: {
    leadId:         data.deal_id          || '', // 👈 Maps backend keys
    customerMobile: data.customer_mobile  || '', 
    customerName:   data.customer_name    || '',
    address:        data.customer_address || '',
    kilovolt:       data.kilovolt         || '',
  },
  android: {
    channelId: 'custom_sound_channel_v2',
    // ... everything else stays exactly the same
    style: {
      type: AndroidStyle.BIGTEXT,
      text:
        `👤 Name      : ${data.customer_name || 'Unknown'}\n` +
        `📍 Address   : ${data.customer_address || 'N/A'}\n` +
        `⚡ Kilovolts : ${data.kilovolt || 'N/A'} kV\n`,
    },
  },
});
}

async function getSurveyorNumber() {
  try {
    const raw    = await AsyncStorage.getItem(USER_DATA);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.UserInfo?.phoneNo || '';
  } catch (e) {
    console.log('[notificationService] getSurveyorNumber error:', e?.message);
    return '';
  }
}

async function handleNotificationAccept(notifData) {
  const mobile = notifData?.customerMobile;
  if (!mobile) return;

  try {
    const surveyorNumber = await getSurveyorNumber();

    // Duplicate guard
    const allLeads   = await getAcceptedLeads();
    const alreadySaved = allLeads.some((l) => l.phone === mobile);

    if (!alreadySaved) {
      await saveAcceptedLead({
        id:     notifData.leadId       || mobile,
        phone:  mobile,
        name:   notifData.customerName || '',
        address: notifData.address     || '',
        status: 'accepted',
      });
    }

    await API.post('/order/accept', { mobile, surveyorNumber });
    await API.put('/order/updatestatus', { mobile, status: 'accepted' });

    console.log('âœ… Accept done:', mobile);
  } catch (e) {
    console.error('[notificationService] Accept error:', e?.message);
  }
}

async function handleNotificationReject(mobile) {
  if (!mobile) return;

  try {
    await API.post('/order/reject', {
      mobile,
      reason: 'Rejected via notification',
    });
    console.log('âŒ Reject done:', mobile);
  } catch (e) {
    console.error('[notificationService] Reject error:', e?.message);
  }
}

export function registerNotificationHandlers() {

  // Background
// Background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;

  const notifData = detail?.notification?.data;
  const actionId  = detail?.pressAction?.id;
  if (!notifData) return;

  // âœ… weekly_summary notification-à®•à¯à®•à¯ accept/reject à®µà¯‡à®£à¯à®Ÿà®¾à®®à¯
  if (notifData.type === 'weekly_summary') {
    await notifee.cancelNotification(detail.notification.id);
    return;
  }

  if (actionId === 'accept') await handleNotificationAccept(notifData);
  if (actionId === 'reject') await handleNotificationReject(notifData?.customerMobile);

  await notifee.cancelNotification(detail.notification.id);
});

// 
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;

  const notifData = detail?.notification?.data;
  const actionId  = detail?.pressAction?.id;
  if (!notifData) return;

  // 
  if (notifData.type === 'weekly_summary') {
    await notifee.cancelNotification(detail.notification.id);
    return;
  }

  if (actionId === 'accept') await handleNotificationAccept(notifData);
  if (actionId === 'reject') await handleNotificationReject(notifData?.customerMobile);

  await notifee.cancelNotification(detail.notification.id);
});
}

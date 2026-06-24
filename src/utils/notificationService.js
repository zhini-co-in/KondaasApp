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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Show Notification
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function showLeadNotification(data) {
  if (!data) return;

  // âœ… weekly_summary à®µà®¨à¯à®¤à®¾ skip à®ªà®£à¯à®£à¯
  if (data.type === 'weekly_summary') {
    console.log('[notificationService] Weekly summary â€” skipping lead UI');
    return;
  }

  // âœ… leadId à®‡à®²à¯à®²à®©à¯à®©à®¾ valid lead à®‡à®²à¯à®²à¯ˆ
  if (!data.leadId && !data.customerMobile) {
    console.log('[notificationService] No leadId/mobile â€” skipping');
    return;
  }

  await notifee.displayNotification({
    id: data.leadId || String(Date.now()),
    title: 'ðŸ”” New Lead Nearby!',
    body: `ðŸ‘¤ ${data.customerName || 'Customer'}  âš¡ ${data.kilovolt || 'N/A'} kV`,
    data: {
      leadId:         data.leadId         || '',
      customerMobile: data.customerMobile || '',
      customerName:   data.customerName   || '',
      address:        data.address        || '',
      kilovolt:       data.kilovolt       || '',
    },
    android: {
      channelId:     'custom_sound_channel_v2',
      importance:    AndroidImportance.HIGH,
      pressAction:   { id: 'default' },
      showTimestamp: true,
      actions: [
        { title: 'âœ… Accept', pressAction: { id: 'accept' } },
        { title: 'âŒ Reject', pressAction: { id: 'reject' } },
      ],
      style: {
        type: AndroidStyle.BIGTEXT,
        text:
          `ðŸ‘¤ Name      : ${data.customerName || 'Unknown'}\n` +
          `ðŸ“ Address   : ${data.address      || 'N/A'}\n`    +
          `âš¡ Kilovolts : ${data.kilovolt      || 'N/A'} kV\n`,
      },
    },
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper â€” Surveyor number
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Accept handler
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reject handler
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Register handlers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// Foreground â€” same guard
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;

  const notifData = detail?.notification?.data;
  const actionId  = detail?.pressAction?.id;
  if (!notifData) return;

  // âœ… same check
  if (notifData.type === 'weekly_summary') {
    await notifee.cancelNotification(detail.notification.id);
    return;
  }

  if (actionId === 'accept') await handleNotificationAccept(notifData);
  if (actionId === 'reject') await handleNotificationReject(notifData?.customerMobile);

  await notifee.cancelNotification(detail.notification.id);
});
}

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

  // Skip weekly summaries
  if (data.type === 'weekly_summary') {
    console.log('[notificationService] Weekly summary – skipping lead UI');
    return;
  }

  // Validate required fields
  if (!data.leadId && !data.customerMobile && !data.deal_id) {
    console.log('[notificationService] No leadId/mobile – skipping');
    return;
  }

  // ✅ ACTION BUTTONS - Accept & Reject
  const actions = [
    {
      title: '✅ Accept',
      id: 'accept',
      foreground: true,
      authenticationRequired: false,
    },
    {
      title: '❌ Reject',
      id: 'reject',
      foreground: true,
      authenticationRequired: false,
    },
  ];

  await notifee.displayNotification({
    id: data.deal_id || String(Date.now()),
    title: '🔔 New Lead Nearby!',
    body: `👤 ${data.customer_name || 'Customer'}  ⚡ ${data.kilovolt || 'N/A'} kV`,
    data: {
      leadId:         data.deal_id          || '', 
      customerMobile: data.customer_mobile  || '', 
      customerName:   data.customer_name    || '',
      address:        data.customer_address || '',
      kilovolt:       data.kilovolt         || '',
      type:           data.type             || 'ASSIGNMENT',
    },
    android: {
      channelId: 'custom_sound_channel_v2',
      actions: actions, // ✅ ADD BUTTONS HERE
      style: {
        type: AndroidStyle.BIGTEXT,
        text:
          `👤 Name      : ${data.customer_name || 'Unknown'}\n` +
          `📍 Address   : ${data.customer_address || 'N/A'}\n` +
          `⚡ Kilovolts : ${data.kilovolt || 'N/A'} kV\n`,
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
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

    console.log('✅ Accept done:', mobile);
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
    console.log('❌ Reject done:', mobile);
  } catch (e) {
    console.error('[notificationService] Reject error:', e?.message);
  }
}

export function registerNotificationHandlers() {

  // Background handler
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS) return;

    const notifData = detail?.notification?.data;
    const actionId  = detail?.pressAction?.id;
    if (!notifData) return;

    // Skip weekly summary notifications
    if (notifData.type === 'weekly_summary') {
      await notifee.cancelNotification(detail.notification.id);
      return;
    }

    // Handle accept action
    if (actionId === 'accept') {
      console.log('[notificationService] Accept action triggered (background)');
      await handleNotificationAccept(notifData);
    }
    
    // Handle reject action
    if (actionId === 'reject') {
      console.log('[notificationService] Reject action triggered (background)');
      await handleNotificationReject(notifData?.customerMobile);
    }

    await notifee.cancelNotification(detail.notification.id);
  });

  // Foreground handler
  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS) return;

    const notifData = detail?.notification?.data;
    const actionId  = detail?.pressAction?.id;
    if (!notifData) return;

    // Skip weekly summary notifications
    if (notifData.type === 'weekly_summary') {
      await notifee.cancelNotification(detail.notification.id);
      return;
    }

    // Handle accept action
    if (actionId === 'accept') {
      console.log('[notificationService] Accept action triggered (foreground)');
      await handleNotificationAccept(notifData);
    }
    
    // Handle reject action
    if (actionId === 'reject') {
      console.log('[notificationService] Reject action triggered (foreground)');
      await handleNotificationReject(notifData?.customerMobile);
    }

    await notifee.cancelNotification(detail.notification.id);
  });
}
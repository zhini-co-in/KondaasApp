// utils/notificationService.js
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USER_DATA } from '../service/localStorage';
import { saveAcceptedLead, getAcceptedLeads } from '../service/LocalleadsStorage';

// ─────────────────────────────────────────────────────────────────
// Channel — App start-ல் ஒரே ஒரு தடவை create பண்ணு
// ─────────────────────────────────────────────────────────────────
export async function createNotificationChannel() {
  await notifee.createChannel({
    id: 'custom_sound_channel_v2',
    name: 'Lead Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'kondaas',
  });
}

// ─────────────────────────────────────────────────────────────────
// Show Notification
// ─────────────────────────────────────────────────────────────────
export async function showLeadNotification(data) {
  if (!data) return;

  // ✅ weekly_summary வந்தா skip பண்ணு
  if (data.type === 'weekly_summary') {
    console.log('[notificationService] Weekly summary — skipping lead UI');
    return;
  }

  // ✅ leadId இல்லன்னா valid lead இல்லை
  if (!data.leadId && !data.customerMobile) {
    console.log('[notificationService] No leadId/mobile — skipping');
    return;
  }

  await notifee.displayNotification({
    id: data.leadId || String(Date.now()),
    title: '🔔 New Lead Nearby!',
    body: `👤 ${data.customerName || 'Customer'}  ⚡ ${data.kilovolt || 'N/A'} kV`,
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
        { title: '✅ Accept', pressAction: { id: 'accept' } },
        { title: '❌ Reject', pressAction: { id: 'reject' } },
      ],
      style: {
        type: AndroidStyle.BIGTEXT,
        text:
          `👤 Name      : ${data.customerName || 'Unknown'}\n` +
          `📍 Address   : ${data.address      || 'N/A'}\n`    +
          `⚡ Kilovolts : ${data.kilovolt      || 'N/A'} kV\n`,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Helper — Surveyor number
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// Accept handler
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// Reject handler
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// Register handlers — App.js-ல் ஒரே ஒரு தடவை call பண்ணு
// ─────────────────────────────────────────────────────────────────
export function registerNotificationHandlers() {

  // Background
// Background
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;

  const notifData = detail?.notification?.data;
  const actionId  = detail?.pressAction?.id;
  if (!notifData) return;

  // ✅ weekly_summary notification-க்கு accept/reject வேண்டாம்
  if (notifData.type === 'weekly_summary') {
    await notifee.cancelNotification(detail.notification.id);
    return;
  }

  if (actionId === 'accept') await handleNotificationAccept(notifData);
  if (actionId === 'reject') await handleNotificationReject(notifData?.customerMobile);

  await notifee.cancelNotification(detail.notification.id);
});

// Foreground — same guard
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;

  const notifData = detail?.notification?.data;
  const actionId  = detail?.pressAction?.id;
  if (!notifData) return;

  // ✅ same check
  if (notifData.type === 'weekly_summary') {
    await notifee.cancelNotification(detail.notification.id);
    return;
  }

  if (actionId === 'accept') await handleNotificationAccept(notifData);
  if (actionId === 'reject') await handleNotificationReject(notifData?.customerMobile);

  await notifee.cancelNotification(detail.notification.id);
});
}
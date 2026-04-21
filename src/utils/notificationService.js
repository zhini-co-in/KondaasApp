// utils/notificationService.js
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import API from '../api/api1';
import { saveAcceptedLead, getAcceptedLeads } from '../service/Localleadsstorage';

export async function createNotificationChannel() {
  await notifee.createChannel({
    id: 'custom_sound_channel_v2',
    name: 'Lead Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'kondaas',
  });
}

export async function showLeadNotification(data) {
  if (!data) return;

  await createNotificationChannel();

  await notifee.displayNotification({
    id: data.leadId || String(Date.now()),
    title: '🔔 New Lead Nearby!',
    body: `${data.customerName || 'Customer'} is ${data.distance || '0'} km away`,
    data: {
      leadId: data.leadId || '',
      customerMobile: data.customerMobile || '',  // ✅ mobile = phone (SurveyerScreen போல)
    },
    android: {
      channelId: 'custom_sound_channel_v2',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      actions: [
        { title: '✅ Accept', pressAction: { id: 'accept' } },
        { title: '❌ Reject', pressAction: { id: 'reject' } },
      ],
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// ✅ SurveyerScreen handleAccept / handleReject — same logic
// ─────────────────────────────────────────────────────────────────
async function handleNotificationAccept(mobile) {
  try {
    // 1. Status update — SurveyerScreen updateOrderStatus போல
    await API.put('/order/updatestatus', { mobile, status: 'accepted' });

    // 2. Local storage save — SurveyerScreen handleAccept போல
    const allLeads = await getAcceptedLeads();
    const alreadySaved = allLeads.some((l) => l.phone === mobile);
    if (!alreadySaved) {
      await saveAcceptedLead({ phone: mobile }); // minimal save
    }

    console.log('✅ Notification Accept done:', mobile);
  } catch (e) {
    console.error('Accept API Error:', e);
  }
}

async function handleNotificationReject(mobile) {
  try {
    // SurveyerScreen confirmReject போல — reject endpoint
    await API.post('/order/reject', {
      mobile,
      reason: 'Rejected via notification',
    });

    console.log('❌ Notification Reject done:', mobile);
  } catch (e) {
    console.error('Reject API Error:', e);
  }
}

// ─────────────────────────────────────────────────────────────────
// ✅ Background + Foreground event listener — App.js ல call பண்ணு
// ─────────────────────────────────────────────────────────────────
export function registerNotificationHandlers() {

  // 🔴 Background (app closed / background)
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const mobile = detail?.notification?.data?.customerMobile;
    if (!mobile) return;

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'accept') {
      await handleNotificationAccept(mobile);
      await notifee.cancelNotification(detail.notification.id);
    }

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'reject') {
      await handleNotificationReject(mobile);
      await notifee.cancelNotification(detail.notification.id);
    }
  });

  // 🟢 Foreground (app open)
  notifee.onForegroundEvent(({ type, detail }) => {
    const mobile = detail?.notification?.data?.customerMobile;
    if (!mobile) return;

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'accept') {
      handleNotificationAccept(mobile);
      notifee.cancelNotification(detail.notification.id);
    }

    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'reject') {
      handleNotificationReject(mobile);
      notifee.cancelNotification(detail.notification.id);
    }
  });
}
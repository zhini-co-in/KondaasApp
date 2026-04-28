// utils/notificationService.js
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
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
    body: `👤 ${data.customerName || 'Customer'}  ⚡ ${data.kilovolts || 'N/A'} kV`,
    data: {
      leadId: data.leadId || '',
      customerMobile: data.customerMobile || '',
    },
    android: {
      channelId: 'custom_sound_channel_v2',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      showTimestamp: true,

      actions: [
        {
          title: '✅ Accept',
          pressAction: { id: 'accept' },
        },
        {
          title: '❌ Reject',
          pressAction: { id: 'reject' },
        },
      ],

      // ✅ Expanded view — Name, Address, Kilovolts மட்டும்
      style: {
        type: AndroidStyle.BIGTEXT,
        text: 
          `👤 Name     : ${data.customerName || 'Unknown'}\n` +
          `📍 Address  : ${data.address || 'N/A'}\n` +
          `⚡ Kilovolts: ${data.kilovolt || 'N/A'} \n`,
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Accept / Reject handlers — same as before
// ─────────────────────────────────────────────────────────────────
async function handleNotificationAccept(mobile) {
  try {
    await API.put('/order/updatestatus', { mobile, status: 'accepted' });

    const allLeads = await getAcceptedLeads();
    const alreadySaved = allLeads.some((l) => l.phone === mobile);
    if (!alreadySaved) {
      await saveAcceptedLead({ phone: mobile });
    }

    console.log('✅ Accept done:', mobile);
  } catch (e) {
    console.error('Accept API Error:', e);
  }
}

async function handleNotificationReject(mobile) {
  try {
    await API.post('/order/reject', {
      mobile,
      reason: 'Rejected via notification',
    });

    console.log('❌ Reject done:', mobile);
  } catch (e) {
    console.error('Reject API Error:', e);
  }
}

// ─────────────────────────────────────────────────────────────────
// Background + Foreground handlers — App.js ல call பண்ணு
// ─────────────────────────────────────────────────────────────────
export function registerNotificationHandlers() {

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
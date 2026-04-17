// utils/notificationService.js
import notifee, { AndroidImportance } from '@notifee/react-native';
import axios from 'axios';

export async function createNotificationChannel() {
  await notifee.createChannel({
    id: 'custom_sound_channel_v2',
    name: 'Lead Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'kondaas',
  });
}

export async function showLeadNotification(data) {
  // ✅ data இல்லன்னா return
  if (!data) return;

  await createNotificationChannel();

  await notifee.displayNotification({
    id: data.leadId || String(Date.now()),
    title: '🔔 New Lead Nearby!',
    body: `${data.customerName || 'Customer'} is ${data.distance || '0'} km away`,
    data: {
      leadId: data.leadId || '',
      customerMobile: data.customerMobile || '',
    },
    android: {
      channelId: 'custom_sound_channel_v2',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
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
    },
  });
}

export async function callUpdateAPI(leadId, status) {
  try {
    await axios.put(
      'https://kondaas-api.trisentrix-dev.workers.dev/order/updatestatus',
      { leadId, status }
    );
  } catch (e) {
    console.error('API Error:', e);
  }
}
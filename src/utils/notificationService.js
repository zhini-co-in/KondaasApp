// utils/notificationService.js
import notifee, { AndroidImportance, AndroidStyle, EventType } from '@notifee/react-native';
import API from '../api/api1';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { USER_DATA } from '../service/localStorage';
import {
  saveAcceptedLead,
  getAcceptedLeads,
} from '../service/Localleadsstorage';
import { enqueue } from '../service/syncQueue';

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

// 🛑 Duplicate notification guard
const recentlyShown = new Set();

export async function showLeadNotification(data) {
  if (!data) return;

  if (data.type === 'weekly_summary') {
    console.log('[notificationService] Weekly summary – skipping lead UI');
    return;
  }

  if (!data.leadId && !data.customerMobile && !data.deal_id) {
    console.log('[notificationService] No leadId/mobile – skipping');
    return;
  }

  const uniqueId = data.deal_id || data.customerMobile;
  if (recentlyShown.has(uniqueId)) {
    console.log('[notificationService] Duplicate skip:', uniqueId);
    return;
  }
  recentlyShown.add(uniqueId);
  setTimeout(() => recentlyShown.delete(uniqueId), 5000);

  const actions = [
    { title: '✅ Accept', pressAction: { id: 'accept' } },
    { title: '❌ Reject', pressAction: { id: 'reject' } },
  ];

  await notifee.displayNotification({
    id: uniqueId,
    title: '🔔 New Lead Nearby!',
    body: `👤 ${data.customer_name || 'Customer'}  ⚡ ${data.kilovolt || 'N/A'} kV`,
    data: {
      leadId:         data.deal_id          || '',
      dealId:         data.deal_id          || '',   // ✅ needed for updatestatus
      customerMobile: data.customer_mobile  || '',
      customerName:   data.customer_name    || '',
      address:        data.customer_address || '',
      kilovolt:       data.kilovolt         || '',
      type:           data.type             || 'ASSIGNMENT',
    },
    android: {
      channelId: 'custom_sound_channel_v2',
      actions: actions,
      style: {
        type: AndroidStyle.BIGTEXT,
        text:
          `👤 Name      : ${data.customer_name || 'Unknown'}\n` +
          `📍 Address   : ${data.customer_address || 'N/A'}\n` +
          `⚡ Kilovolts : ${data.kilovolt || 'N/A'} kV\n`,
      },
      pressAction: { id: 'default', launchActivity: 'default' },
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

async function isOnlineNow() {
  const state = await NetInfo.fetch();
  return !!state.isConnected && !!state.isInternetReachable;
}

// ── ACCEPT — same logic as SurveyerScreen.handleAccept ──────────────────────
async function handleNotificationAccept(notifData) {
  const mobile = notifData?.customerMobile;
  const dealId = notifData?.dealId || notifData?.leadId;
  if (!mobile) return;

  try {
    const surveyorNumber = await getSurveyorNumber();
    const acceptedAt     = Date.now();

    // local save (duplicate guard)
    const allLeads     = await getAcceptedLeads();
    const alreadySaved = allLeads.some((l) => l.phone === mobile);
    if (!alreadySaved) {
      await saveAcceptedLead({
        id:      dealId || mobile,
        dealId:  dealId || '',
        phone:   mobile,
        name:    notifData.customerName || '',
        address: notifData.address      || '',
        status:  'accepted',
      });
    }

    const payload = { mobile, surveyorNumber };

    // ✅ offline-safe, same as screen
    await enqueue(`accept_${dealId || mobile}`, 'ACCEPT_LEAD', payload);

    if (await isOnlineNow()) {
      try {
        const r1 = await API.post('/order/accept', payload);
        console.log('✅ accept:', r1?.data);

        const r2 = await API.put('/order/updatestatus', { id: dealId, status: 'accepted' });
        console.log('✅ updatestatus:', r2?.data);

        const r3 = await API.post('/order/sync-status', {
          customerMobile: mobile,
          surveyorNumber,
          status:     'accepted',
          receivedAt: acceptedAt,
        });
        console.log('✅ sync-status:', r3?.data);
      } catch (apiErr) {
        console.error('[notificationService] Accept API error:', apiErr?.response?.data || apiErr?.message);
      }
    } else {
      console.log('[notificationService] Offline — queued for later sync');
    }
  } catch (e) {
    console.error('[notificationService] Accept error:', e?.message);
  }
}

// ── REJECT — same logic/fields as SurveyerScreen.confirmReject ──────────────
async function handleNotificationReject(notifData) {
  const mobile = notifData?.customerMobile;
  if (!mobile) return;

  try {
    const surveyorNumber = await getSurveyorNumber();

    const r = await API.post('/order/reject', {
      customerMobile: mobile,
      name:           notifData?.customerName || '',
      address:        notifData?.address      || '',
      surveyorNumber,
      comment:        'Rejected via notification',
      receivedAt:     Date.now(),
    });
    console.log('❌ reject:', r?.data);
  } catch (e) {
    console.error('[notificationService] Reject error:', e?.response?.data || e?.message);
  }
}

export function registerNotificationHandlers() {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS) return;
    const notifData = detail?.notification?.data;
    const actionId  = detail?.pressAction?.id;
    if (!notifData) return;

    if (notifData.type === 'weekly_summary') {
      await notifee.cancelNotification(detail.notification.id);
      return;
    }

    if (actionId === 'accept') await handleNotificationAccept(notifData);
    if (actionId === 'reject') await handleNotificationReject(notifData);

    await notifee.cancelNotification(detail.notification.id);
  });

  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type !== EventType.ACTION_PRESS) return;
    const notifData = detail?.notification?.data;
    const actionId  = detail?.pressAction?.id;
    if (!notifData) return;

    if (notifData.type === 'weekly_summary') {
      await notifee.cancelNotification(detail.notification.id);
      return;
    }

    if (actionId === 'accept') await handleNotificationAccept(notifData);
    if (actionId === 'reject') await handleNotificationReject(notifData);

    await notifee.cancelNotification(detail.notification.id);
  });
}
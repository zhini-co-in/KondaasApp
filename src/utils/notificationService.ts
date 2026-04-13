import notifee, { AndroidImportance } from '@notifee/react-native';

export async function createNotificationChannel(): Promise<void> {
  await notifee.createChannel({
    id: 'custom_sound_channel_v2',
    name: 'KondaasApp Notifications',
    sound: 'kondaas',
    importance: AndroidImportance.HIGH,
  });
}

export async function sendNotification(title: string, body: string): Promise<void> {
  await createNotificationChannel();

  await notifee.displayNotification({
    title: title,
    body: body,
    android: {
      channelId: 'custom_sound_channel',
      sound: 'kondaas',
      pressAction: { id: 'default' },
    },
  });
}
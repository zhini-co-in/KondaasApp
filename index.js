import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import codePush from "@revopush/react-native-code-push";
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { showLeadNotification, callUpdateAPI } from './src/utils/notificationService';
import BackgroundGeolocation from 'react-native-background-geolocation';
import { sendLocation } from './src/service/locationService';

const codePushOptions = { 
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME, 
  installMode: codePush.InstallMode.ON_NEXT_RESUME,
  mandatoryInstallMode: codePush.InstallMode.IMMEDIATE 
};

// ✅ Background FCM handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔥 FCM Background received:', JSON.stringify(remoteMessage));
  await showLeadNotification(remoteMessage.data);
});

// ✅ Background notification action handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS) {
    const { pressAction, notification } = detail;
    const { leadId } = notification.data;

    if (pressAction.id === 'accept') {
      await callUpdateAPI(leadId, 'accepted');
    } else if (pressAction.id === 'reject') {
      await callUpdateAPI(leadId, 'rejected');
    }

    await notifee.cancelNotification(notification.id);
  }
});
const HeadlessTask = async (event) => {
  if (event.name === 'heartbeat' || event.name === 'location') {
    const location = event.params;
    if (location?.coords) {
      const { latitude, longitude } = location.coords;
      const lastSentRef = { current: 0 };
      await sendLocation(latitude, longitude, location.timestamp, lastSentRef);
    }
  }
};
BackgroundGeolocation.registerHeadlessTask(HeadlessTask);

AppRegistry.registerComponent(appName, () => codePush(codePushOptions)(App));
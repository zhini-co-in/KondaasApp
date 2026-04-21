import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import codePush from "@revopush/react-native-code-push";
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { showLeadNotification } from './src/utils/notificationService';
import API from './src/api/api1'; // ✅ direct API use பண்றோம்

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

// ✅ Background notification action handler — mobile use பண்றோம்
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS) {
    const { pressAction, notification } = detail;
    const mobile = notification?.data?.customerMobile; // ✅ leadId இல்ல, mobile எடு

    if (!mobile) return;

    if (pressAction.id === 'accept') {
      await API.put('/order/updatestatus', { mobile, status: 'accepted' });
    } else if (pressAction.id === 'reject') {
      await API.post('/order/reject', { 
        mobile, 
        reason: 'Rejected via notification' 
      });
    }

    await notifee.cancelNotification(notification.id);
  }
});

AppRegistry.registerComponent(appName, () => codePush(codePushOptions)(App));
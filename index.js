import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import codePush from "@revopush/react-native-code-push";
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { showLeadNotification } from './src/utils/notificationService';
import API from './src/api/api1';
import { initCrashLogger } from './src/utils/crashLogger'; // 👈 ADD THIS

const codePushOptions = { 
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME, 
  installMode: codePush.InstallMode.ON_NEXT_RESUME,
  mandatoryInstallMode: codePush.InstallMode.IMMEDIATE 
};

initCrashLogger(); // 👈 ADD THIS — global crash handler + auto network sync start aagum

// Background FCM handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔥 FCM Background received:', JSON.stringify(remoteMessage));
  await showLeadNotification(remoteMessage.data);
});

AppRegistry.registerComponent(appName, () => codePush(codePushOptions)(App));
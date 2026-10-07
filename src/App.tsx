import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme, AppState } from 'react-native';          // 👈 AppState add
import { lightTheme, darkTheme, PaperDefaultTheme } from './theme';
// @ts-ignore
import RootStack from './navigation';

import codePush from "@revopush/react-native-code-push";
// @ts-ignore
import { initSyncQueue, teardownSyncQueue } from './service/syncQueueService';
import { initDeliveryQueueSync, teardownDeliveryQueueSync } from './components/DispatchForm';
import messaging from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';

import NetInfo from '@react-native-community/netinfo';
// @ts-ignore
import { processSyncQueue } from './service/syncQueue';

// 👇 ADD
import { getAuth, onIdTokenChanged } from '@react-native-firebase/auth';
// @ts-ignore
import { getFreshToken, syncTokenToServer } from './api/apiClient';

// @ts-ignore
import {
  createNotificationChannel,
  requestNotificationPermission,
  registerNotificationHandlers,
  showLeadNotification,
} from './utils/notificationService';

const queryClient = new QueryClient();

let App = () => {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    crashlytics().setCrashlyticsCollectionEnabled(true);
    crashlytics().log('App started');

    codePush.sync({
      updateDialog: true,
      installMode: codePush.InstallMode.IMMEDIATE,
    });
    createNotificationChannel();
    initSyncQueue();
    initDeliveryQueueSync();

    // 👇 token sync helper (queue-ku munnaadi eppavum idhu run aaganum)
    const syncToken = async () => {
      try {
        const t = await getFreshToken(false);
        if (t) await syncTokenToServer(t);
      } catch (e) {}
    };

    // 👇 CHANGED: token sync → apparam queue
    const runSync = async () => {
      await syncToken();
      await processSyncQueue();
    };

    const unsubscribeNetSync = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        runSync();
      }
    });
    NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        runSync();
      }
    });

    // 👇 ADD: token hourly rotate aana odane DB update
    const unsubToken = onIdTokenChanged(getAuth(), (user) => {
      if (user) syncToken();
    });

    // 👇 ADD: background → foreground vandha catch-up
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncToken();
    });

    requestNotificationPermission();
    registerNotificationHandlers();

    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📩 FCM Foreground:', JSON.stringify(remoteMessage));
      await showLeadNotification(remoteMessage.data);
    });

    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('App opened from background via notification:', remoteMessage);
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('App opened from quit state via notification:', remoteMessage);
        }
      });

    return () => {
      teardownSyncQueue();
      teardownDeliveryQueueSync();
      unsubscribeNetSync();
      unsubToken();            // 👈 add
      appStateSub.remove();    // 👈 add
      unsubscribeForeground();
      unsubscribeOpenedApp();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={PaperDefaultTheme}>
        <SafeAreaProvider>
          <NavigationContainer theme={theme}>
            <RootStack />
          </NavigationContainer>
        </SafeAreaProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
};

App = codePush(App);

export default App;
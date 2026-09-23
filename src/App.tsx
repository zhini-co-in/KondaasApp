import React, { useEffect } from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, PaperDefaultTheme } from './theme';
// @ts-ignore
import RootStack from './navigation';

import codePush from "@revopush/react-native-code-push";
// @ts-ignore
import { initSyncQueue, teardownSyncQueue } from './service/syncQueueService';
import messaging from '@react-native-firebase/messaging';
import crashlytics from '@react-native-firebase/crashlytics';   // ← add pannunga

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
    // ========== Crashlytics Setup ==========
    crashlytics().setCrashlyticsCollectionEnabled(true);
    crashlytics().log('App started');
    // Optional: later login aana setUserId call pannunga
    // crashlytics().setUserId('user_123');
    // ======================================

    codePush.sync({
      updateDialog: true,
      installMode: codePush.InstallMode.IMMEDIATE,
    });
    createNotificationChannel();
    initSyncQueue();

    // FCM permission + token
    requestNotificationPermission();

    // Accept/Reject button handlers
    registerNotificationHandlers();

    // Foreground FCM message
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📩 FCM Foreground:', JSON.stringify(remoteMessage));
      await showLeadNotification(remoteMessage.data);
    });

    // Background notification open
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('App opened from background via notification:', remoteMessage);
    });

    // Quit state notification open
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('App opened from quit state via notification:', remoteMessage);
        }
      });

    return () => {
      teardownSyncQueue();
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

// Attach Revopush CodePush
App = codePush(App);

export default App;
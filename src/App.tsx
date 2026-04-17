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
import { createNotificationChannel } from './utils/notificationService';

const queryClient = new QueryClient();

let App = () => {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    codePush.sync({
      updateDialog: true,
      installMode: codePush.InstallMode.IMMEDIATE,
    });
  createNotificationChannel();
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

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import codePush from "@revopush/react-native-code-push"; // Use the Revopush SDK

const codePushOptions = { 
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME, 
  installMode: codePush.InstallMode.ON_NEXT_RESUME,
  mandatoryInstallMode: codePush.InstallMode.IMMEDIATE 
};

// Register the wrapped version of your app
AppRegistry.registerComponent(appName, () => codePush(codePushOptions)(App));

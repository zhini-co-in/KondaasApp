import { NativeModules, Platform } from 'react-native';

const { StartStopServiceModule } = NativeModules;

export default {
  startService: () => {
    if (Platform.OS === 'ios' && StartStopServiceModule) {
      StartStopServiceModule.startService();
    }
  },
  stopService: () => {
    if (Platform.OS === 'ios' && StartStopServiceModule) {
      StartStopServiceModule.stopService();
    }
  },
};
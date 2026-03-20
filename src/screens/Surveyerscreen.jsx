import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Image,
  StatusBar,
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import BackgroundGeolocation from 'react-native-background-geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { USER_DATA } from '../service/localStorage';

const ServerScreen = () => {
  const navigation = useNavigation();
  const [isOn, setIsOn] = useState(false);

  // 📍 Request location permission (foreground & background)
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const background = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
      return (
        fine === PermissionsAndroid.RESULTS.GRANTED &&
        background === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true;
  };

  // 🔘 Start background location tracking
  const startBackgroundTracking = () => {
    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5,
      stopOnTerminate: false,
      startOnBoot: true,
      debug: false,
    }).then(state => {
      if (!state.enabled) {
        BackgroundGeolocation.start();
      }
    });

    BackgroundGeolocation.onLocation(
      location => {
        console.log('Live Location:', location.coords);
        // You can send location to server here
      },
      error => {
        console.log('Location Error:', error);
      }
    );
  };

  // 🔘 Stop background location tracking
  const stopBackgroundTracking = () => {
    BackgroundGeolocation.stop();
  };

  // 🔘 Toggle
  const handleToggle = async () => {
    if (!isOn) {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Enable location permission',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      setIsOn(true);
      startBackgroundTracking(); // 🔴 Start live tracking
    } else {
      setIsOn(false);
      stopBackgroundTracking(); // 🔴 Stop tracking
    }
  };

  // 🔴 Logout
  const handleLogout = () => {
  Alert.alert(
    'Logout',
    'Are you sure you want to logout?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(USER_DATA); // clear stored user
            console.log('User logged out, data cleared.');

            // Reset navigation stack to Login screen
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }], // make sure your login screen name is correct
            });
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]
  );
};

  // 🚀 Auto check when screen loads (optional)
  useEffect(() => {
    // Could check initial GPS permission or last toggle state
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Logout Icon */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={28} color="#ED1C25" />
      </TouchableOpacity>

      {/* Toggle */}
      <View style={styles.toggleContainer}>
        <Switch
          trackColor={{ false: '#ccc', true: 'red' }}
          thumbColor="#fff"
          value={isOn}
          onValueChange={handleToggle}
        />
      </View>

      {!isOn ? (
        <>
          <LinearGradient
            colors={['#F00001', '#B00100']}
            style={styles.header}
          >
            <Image
              source={require('../../assets/images/kondass.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </LinearGradient>

          <View style={styles.offContainer}>
            <Text style={styles.welcome}>Welcome Vinay!</Text>
            <Text style={styles.message}>
              Let’s get started! Turn on availability!
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.onContainer}>
          <Text style={styles.onText}>
            Server is ON (GPS Active) 📍
          </Text>
        </View>
      )}
    </View>
  );
};

export default ServerScreen;

const styles = StyleSheet.create({
  header: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logo: {
    width: 200,
    height: 100,
  },
  toggleContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  logoutButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  offContainer: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  message: {
    marginTop: 10,
    color: '#E53935',
  },
  onContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'green',
  },
});
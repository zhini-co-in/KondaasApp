import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const MapScreen = () => {
  const navigation = useNavigation();
  const { latitude, longitude, address, city } = useRoute().params || {};

  useEffect(() => {
  let url = latitude && longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address || city || '')}`;

  // Replace current screen (remove MapScreen from stack)
  navigation.replace('InProgressScreen'); // <-- unga previous screen name

  setTimeout(() => {
    Linking.openURL(url);
  }, 300);

}, []);

  return (
    <View style={styles.container}>
      <Text>Opening Maps...</Text>
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
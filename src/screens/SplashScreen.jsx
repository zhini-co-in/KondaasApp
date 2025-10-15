import React, { useEffect } from 'react';
import {
  Image,
  Text,
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Kondaas } from '../constants/ImageConstant';
import FontStyles from '../constants/fonts';

const SplashScreen = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // Navigate to Intro after 2 seconds
    const timeout = setTimeout(() => {
      navigation.replace('Intro');
    }, 2000);

    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fb0404" barStyle="light-content" />

      <View style={styles.imageContainer}>
        <Image
          source={Kondaas}
          style={styles.centerImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.bottomText}>Powered by Trisentrix | Version 1.0</Text>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fb0404',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerImage: {
    width: 250,
    height: 250,
  },
  bottomText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: FontStyles.POPPINS500,
    fontWeight: '400',
    padding: 12,
  },
});

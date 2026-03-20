import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import PanelDetailScreen from '../screens/PanelDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SplashScreen from '../screens/SplashScreen';
import IntroScreen from '../screens/IntroScreen';
import LoginScreen from '../screens/LoginScreen';
import OtpScreen from '../screens/OtpScreen';
import MainScreen from '../screens/MainScreen';
import ProductsHomeScreen from '../screens/ProductsHomeScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ProductsList from '../screens/ProductsList';
import KondaasAssuredScreen from '../screens/KondaasAssuredScreen';
import PowerGeneration from '../screens/PowerGeneration';
import KondaaAboutScreen from '../screens/KondaaAboutScreen';
import SupportScreen from '../screens/SupportScreen';
import CreateTicketScreen from '../screens/CreateTicketScreen';
import ReferAndEarnScreen from '../screens/ReferAndEarnScreen';
import ReferFriendScreen from '../screens/ReferFriendScreen';
import TermsConditionsScreen from '../screens/TermsConditionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import Surveyerscreen from "../screens/Surveyerscreen";

import { SCREEN_NAMES } from '../constants/screenNames';
const Stack = createNativeStackNavigator();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName={SCREEN_NAMES.SPLASH} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={SCREEN_NAMES.SPLASH} component={SplashScreen} />
      <Stack.Screen name={SCREEN_NAMES.INTRO} component={IntroScreen} />
      <Stack.Screen name={SCREEN_NAMES.LOGIN} component={LoginScreen} />
      <Stack.Screen name={SCREEN_NAMES.OTP} component={OtpScreen} />
      <Stack.Screen name={SCREEN_NAMES.MAIN} component={MainScreen} />
      <Stack.Screen name={SCREEN_NAMES.PRODUCTS_HOME} component={ProductsHomeScreen} />
      <Stack.Screen name={SCREEN_NAMES.PRODUCT_DETAIL} component={ProductDetailScreen} />
      <Stack.Screen name={SCREEN_NAMES.PRODUCTS_LIST} component={ProductsList} />
      <Stack.Screen name={SCREEN_NAMES.KONDAAS_ASSURED} component={KondaasAssuredScreen} />
      <Stack.Screen name={SCREEN_NAMES.POWER_GENERATION} component={PowerGeneration} />
      <Stack.Screen name={SCREEN_NAMES.KONDA_ABOUT} component={KondaaAboutScreen} />
      <Stack.Screen name={SCREEN_NAMES.SUPPORT} component={SupportScreen} />
      <Stack.Screen name={SCREEN_NAMES.CREATE_TICKET} component={CreateTicketScreen} />
      <Stack.Screen name={SCREEN_NAMES.REFER_AND_EARN} component={ReferAndEarnScreen} />
      <Stack.Screen name={SCREEN_NAMES.REFER_FRIEND} component={ReferFriendScreen} />
      <Stack.Screen name={SCREEN_NAMES.TERMS_CONDITIONS} component={TermsConditionsScreen} />
      <Stack.Screen name={SCREEN_NAMES.PROFILE} component={ProfileScreen} />
      <Stack.Screen name={SCREEN_NAMES.HOME} component={DashboardScreen} />
      <Stack.Screen name={SCREEN_NAMES.DETAIL} component={PanelDetailScreen} />
      <Stack.Screen name={SCREEN_NAMES.SETTINGS} component={SettingsScreen} />
      <Stack.Screen name={SCREEN_NAMES.SURVEYER_SCREEN} component={Surveyerscreen} />
    </Stack.Navigator>
  );
}

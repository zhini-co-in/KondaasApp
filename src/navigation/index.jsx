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

const Stack = createNativeStackNavigator();

export default function RootStack() {
  return (
    <Stack.Navigator initialRouteName="splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="splash" component={SplashScreen} />
      <Stack.Screen name="Intro" component={IntroScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpScreen" component={OtpScreen} />
      <Stack.Screen name="mainScreen" component={MainScreen} />
       <Stack.Screen name="ProductsHomeScreen" component={ProductsHomeScreen} />
         <Stack.Screen name="ProductDetailScreen" component={ProductDetailScreen} />
          <Stack.Screen name="ProductListScreen" component={ProductsList} />
          <Stack.Screen name="KondaasAssuredScreen" component={KondaasAssuredScreen} />
           <Stack.Screen name="PowerGenerationScreen" component={PowerGeneration} />
      <Stack.Screen name="Home" component={DashboardScreen} />
      <Stack.Screen name="Detail" component={PanelDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

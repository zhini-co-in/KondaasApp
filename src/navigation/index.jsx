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
import FormScreen from "../screens/FormScreen";

import { SCREEN_NAMES } from '../constants/screenNames';
import InProgressScreen from '../screens/InProgressScreen';
import MapScreen from '../service/MapScreen';
import AdminScreen from '../screens/AdminScreen';
import LogisticScreen from '../screens/LogisticScreen';
import CreateLeadScreen from '../screens/CreateLeadScreen';
import InstallerScreen from '../screens/InstallerScreen';
import FilterScreen from '../screens/FilterScreen';
import EmployeeFilterScreen from '../screens/EmployeeFilterScreen';
import Leadfulldetailsscreen from '../screens/Leadfulldetailsscreen';
import LogisticStatusScreen from '../screens/LogisticStatusScreen';
import InstallerStatusScreen from '../screens/InstallerStatusScreen';
import CreateEmployeeScreen from '../screens/CreateEmployeeScreen';
import EmployeeListScreen from '../screens/EmployeeListScreen';

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
      <Stack.Screen name="Form" component={FormScreen} />
      <Stack.Screen name="InProgress" component={InProgressScreen} />
      <Stack.Screen name="MapView" component={MapScreen} />
      <Stack.Screen name={SCREEN_NAMES.ADMIN_SCREEN} component={AdminScreen} />
<Stack.Screen name={SCREEN_NAMES.LOGISTIC_SCREEN} component={LogisticScreen} />
<Stack.Screen name={SCREEN_NAMES.INSTALLER_SCREEN} component={InstallerScreen} />
<Stack.Screen
  name="CreateLead"
  component={CreateLeadScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen name="AdminDashboard"  component={AdminScreen} options={{ headerShown: false }} />
<Stack.Screen name="FilterScreen"    component={FilterScreen} options={{ headerShown: false }} />
<Stack.Screen name="EmployeeFilter"  component={EmployeeFilterScreen} options={{ headerShown: false }} />
<Stack.Screen name="LeadFullDetailsScreen" component={Leadfulldetailsscreen} options={{ headerShown: false }} />
<Stack.Screen name="LogisticStatusScreen" component={LogisticStatusScreen} />
<Stack.Screen name="InstallerStatusScreen" component={InstallerStatusScreen} />
<Stack.Screen
     name="CreateEmployeeScreen"
     component={CreateEmployeeScreen}
     options={{ headerShown: false }}
   />
   <Stack.Screen name="EmployeeListScreen" component={EmployeeListScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

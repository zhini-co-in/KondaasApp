import { DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { DefaultTheme as PaperDefaultTheme } from 'react-native-paper';

// Navigation themes
export const lightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: '#ffffff',
    primary: '#0A84FF',
    card: '#ffffff',
    text: '#111827'
  }
};

export const darkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: '#0b1220',
    primary: '#0A84FF',
    card: '#071027',
    text: '#e6eef8'
  }
};

// Paper theme (basic)
export { PaperDefaultTheme };

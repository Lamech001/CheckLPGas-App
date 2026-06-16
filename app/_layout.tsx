import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import 'react-native-reanimated';


import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { CacheProvider } from '@/contexts/CacheContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { sessionManager } from '@/services/sessionManager';

// Initial route is index (WelcomeScreen) by default

// Inner component that uses theme
function AppContent() {
  const { isDarkMode } = useTheme();

  // Initialize session manager for rich, smooth session handling
  useEffect(() => {
    sessionManager.initialize();
    return () => sessionManager.cleanup();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setBarStyle('dark-content', true);
      RNStatusBar.setTranslucent(false);
    }
  }, []);

  return (
    <NavigationThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <StatusBar style="dark" />
      <DeepLinkHandler>

        <ConnectionIndicator />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="role-select" />
          <Stack.Screen name="consumer/login" />
          <Stack.Screen name="consumer/signup" />
          <Stack.Screen name="supplier/login" />
          <Stack.Screen name="supplier/signup" />
          <Stack.Screen name="supplier/dashboard" />
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </DeepLinkHandler>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <CacheProvider warmOnMount={true}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </CacheProvider>
  );
}

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AppStatusBar } from '@/components/AppStatusBar';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { DeepLinkHandler } from '@/components/DeepLinkHandler';
import { CacheProvider } from '@/contexts/CacheContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { sessionManager } from '@/services/sessionManager';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Inner component that uses theme
function AppContent() {
  const { isDarkMode } = useTheme();

  // Initialize session manager for rich, smooth session handling
  useEffect(() => {
    sessionManager.initialize();
    return () => sessionManager.cleanup();
  }, []);

  return (
    <NavigationThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
      <DeepLinkHandler>
        <AppStatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#1A2A53' : '#2E7D32'} />
        <ConnectionIndicator />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="role-select" options={{ headerShown: false, title: 'Select Role' }} />
          <Stack.Screen name="consumer/signup" options={{ headerShown: false, title: 'Sign Up' }} />
          <Stack.Screen name="supplier/signup" options={{ headerShown: false, title: 'Supplier Sign Up' }} />
          <Stack.Screen name="supplier/dashboard" options={{ headerShown: false, title: 'Supplier Dashboard' }} />
          <Stack.Screen name="consumer/login" options={{ headerShown: false, title: 'Login' }} />
          <Stack.Screen name="verify-email" options={{ headerShown: false, title: 'Verify Email' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
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

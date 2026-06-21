import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StatusBar as RNStatusBar } from "react-native";
import "react-native-reanimated";

import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { DeepLinkHandler } from "@/components/DeepLinkHandler";
import { CacheProvider } from "@/contexts/CacheContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { setupNotifications } from "@/services/notificationService";
import { getPersistentSession } from "@/services/persistenceSessionService";
import { sessionManager } from "@/services/sessionManager";
import { useRouter } from "expo-router";

// Initial route is index (WelcomeScreen) by default

// Inner component that uses theme
function AppContent() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // Initialize session manager for rich, smooth session handling
  useEffect(() => {
    sessionManager.initialize();
    return () => sessionManager.cleanup();
  }, []);

  // Initialize push notifications globally
  useEffect(() => {
    setupNotifications().catch((error: Error) => {
      console.error('[RootLayout] Failed to setup notifications:', error);
    });
  }, []);

  // WhatsApp-like persistence:
  // If a verified consumer session marker exists on this device,
  // skip login and go straight to the consumer dashboard.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const session = await getPersistentSession();
        if (cancelled) return;

        if (
          session?.role === "consumer" &&
          session?.emailVerified &&
          session?.uid
        ) {
          router.replace("/(tabs)");
        }
      } catch {
        // Ignore and fall back to normal navigation
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setBarStyle("dark-content", true);
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

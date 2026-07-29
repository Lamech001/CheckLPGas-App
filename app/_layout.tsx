import { Stack, useRouter } from "expo-router";

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
import {
    initializeTokenRefresh,
    stopTokenRefresh,
} from "@/services/tokenRefreshService";

// Initial route is index (WelcomeScreen) by default

// Global handler to catch Firestore SDK assertion errors that escape as uncaught promise rejections
if (
  typeof global !== "undefined" &&
  typeof global.addEventListener === "function"
) {
  global.addEventListener("unhandledrejection", (event: any) => {
    const msg = event?.reason?.message || event?.reason?.toString() || "";
    if (
      msg.includes("INTERNAL ASSERTION FAILED") ||
      (msg.includes("FIRESTORE") && msg.includes("Unexpected state"))
    ) {
      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }
  });
}

// Inner component that uses theme
function AppContent() {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // Initialize session manager and token refresh for rich, smooth session handling
  useEffect(() => {
    sessionManager.initialize();
    initializeTokenRefresh();
    return () => {
      sessionManager.cleanup();
      stopTokenRefresh();
    };
  }, []);

  // Initialize push notifications globally
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await setupNotifications();
      } catch (error: any) {
        // Suppress Firebase initialization errors that occur during hot reload
        // These are non-critical and notifications will work on proper app restart
        if (error?.message?.includes("Default FirebaseApp is not initialized")) {
          console.warn("[RootLayout] Firebase not ready for notifications (hot reload - will work on restart)");
        } else {
          console.error("[RootLayout] Failed to setup notifications:", error);
        }
      }
    };
    
    initNotifications();
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
    <>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
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
    </>
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

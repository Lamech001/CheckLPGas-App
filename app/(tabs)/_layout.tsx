import { auth } from '@/config/firebase';
import { canAccessVerifiedRole } from '@/services/authVerifiedGuardService';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';

export default function TabLayout() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | null = null;

    const run = async () => {
      try {
        // Verified-only gate using local persistence marker
        const ok = await canAccessVerifiedRole('consumer');
        if (!ok) {
          if (isActive) {
            setLoading(false);
            setAuthChecked(true);
            router.replace('/consumer/login');
          }
          return;
        }

        // Now listen to Firebase auth changes with timeout
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
          if (!isActive) return;
          setUser(currentUser);
          setLoading(false);
          setAuthChecked(true);
          
          // Only redirect to login if we don't have a local session marker
          // This prevents premature redirects during Firebase auth initialization
          if (!currentUser) {
            canAccessVerifiedRole('consumer').then(hasSession => {
              if (!hasSession && isActive) {
                router.replace('/consumer/login');
              }
            });
          }
        });

        unsubscribe = unsubscribeAuth;

        // Set a timeout to prevent indefinite loading if Firebase auth is slow
        const timeoutId = setTimeout(() => {
          if (isActive && loading) {
            setLoading(false);
            setAuthChecked(true);
            // If we have a local session but Firebase auth is slow, allow access
            canAccessVerifiedRole('consumer').then(hasSession => {
              if (hasSession && isActive) {
                // Allow access with cached data while Firebase auth initializes
                console.log('[TabLayout] Using cached session while Firebase auth initializes');
              } else if (isActive) {
                router.replace('/consumer/login');
              }
            });
          }
        }, 3000); // 3 second timeout for Firebase auth initialization

        return () => {
          clearTimeout(timeoutId);
        };
      } catch {
        if (isActive) {
          setLoading(false);
          setAuthChecked(true);
          router.replace('/consumer/login');
        }
      }
    };

    run();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, [router]);

  // Show loading indicator while checking auth state
  if (loading && !authChecked) {
    return null;
  }

  // Allow access if we have either Firebase user OR local session
  // This enables WhatsApp-like offline behavior
  if (!user && !authChecked) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Hide bottom navigation - use hamburger menu instead
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="chat" />
    </Tabs>
  );
}

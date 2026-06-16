import { auth } from '@/config/firebase';
import { canAccessVerifiedRole } from '@/services/authVerifiedGuardService';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';

export default function TabLayout() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      try {
        // Verified-only gate using local persistence marker
        const ok = await canAccessVerifiedRole('consumer');
        if (!ok) {
          if (isActive) {
            router.replace('/consumer/login');
          }
          return;
        }

        // Now listen to Firebase auth changes
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          if (!isActive) return;
          setUser(currentUser);
          setLoading(false);
          if (!currentUser) {
            router.replace('/consumer/login');
          }
        });

        return unsubscribe;
      } catch {
        if (isActive) {
          router.replace('/consumer/login');
        }
      }
    };

    run();

    return () => {
      isActive = false;
    };
  }, [router]);

  // Show nothing while checking auth state to prevent flash of content
  if (loading || !user) {
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

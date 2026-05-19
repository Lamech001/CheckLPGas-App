import { auth } from '@/config/firebase';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';

export default function TabLayout() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        // Redirect to welcome screen if not authenticated
        router.replace('/');
      }
    });

    return unsubscribe;
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
    </Tabs>
  );
}

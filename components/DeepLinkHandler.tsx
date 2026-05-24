import { auth } from '@/config/firebase';
import { AppColors, AppSizes } from '@/constants/appTheme';
import * as Linking from 'expo-linking';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Handle deep link when app is opened from a link
    const handleDeepLink = async (url: string) => {
      // Parse the URL
      const { path, queryParams } = Linking.parse(url);
      
      // Check if this is a Firebase email verification link
      if (queryParams?.mode === 'verifyEmail' && queryParams?.oobCode) {
        const oobCode = queryParams.oobCode as string;
        
        // Navigate to verify-email screen first for better UX
        // The verify-email screen will handle the verification state
        router.push({
          pathname: '/verify-email',
          params: { 
            verifying: 'true',
            oobCode: oobCode
          }
        });
      }
    };

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened from a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
      setIsReady(true);
    });

    // Also check auth state on mount
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Auth state changed
    });

    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, [router]);

  // Show loading only during initial auth check, not during deep link handling
  // Deep links now navigate to verify-email screen for better UX
  if (verifying && !isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={AppColors.success} />
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.white,
  },
  message: {
    marginTop: AppSizes.spacingXLarge,
    fontSize: AppSizes.fontXLarge,
    color: AppColors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: AppSizes.spacingXLarge,
  },
});

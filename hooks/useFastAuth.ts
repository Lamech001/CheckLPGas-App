/**
 * useFastAuth - Ultra-fast authentication with instant response
 * Uses cached credentials for immediate UI, validates in background
 */

import { auth } from '@/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';

interface FastAuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useFastAuth(): FastAuthState {
  const [state, setState] = useState<FastAuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check current auth state immediately
    const currentUser = auth.currentUser;
    
    if (currentUser) {
      // User is already signed in from persistent storage
      // Show immediately, don't wait for Firebase to "confirm"
      setState({
        user: currentUser,
        isLoading: false,
        isAuthenticated: true,
      });
    }

    // Still listen for auth changes to handle edge cases
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({
        user,
        isLoading: false,
        isAuthenticated: !!user,
      });
    });

    return unsubscribe;
  }, []);

  return state;
}

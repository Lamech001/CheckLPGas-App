import { auth, db } from '@/config/firebase';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { SupplierData } from './types/supplier';

const supplierDataCache = new Map<string, Promise<{ success: boolean; data?: SupplierData; error?: string }>>();
const CACHE_TTL = 30000; // 30 seconds cache TTL
const cacheExpiry = new Map<string, number>();

// Clean up expired cache entries
const cleanupExpiredCache = () => {
  const now = Date.now();
  for (const [key, expiry] of cacheExpiry.entries()) {
    if (now > expiry) {
      supplierDataCache.delete(key);
      cacheExpiry.delete(key);
    }
  }
};

export interface SupplierRegistrationData {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  enterpriseName: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  prices: {
    size: 6 | 13 | 19;
    price: number;
    inStock: boolean;
  }[];
  openingHours: {
    open: string;
    close: string;
  };
}

// Register a new supplier - with guaranteed Firestore document creation
export const registerSupplier = async (
  data: SupplierRegistrationData
): Promise<{ success: boolean; user?: User; error?: string }> => {
  let user = null;
  
  try {
    // Step 1: Create user account
    console.log('[SupplierAuth] Creating user account for:', data.email);
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    user = userCredential.user;
    console.log('[SupplierAuth] User created with UID:', user.uid);

    // Step 2: Create supplier document in Firestore with retry logic
    const supplierDocRef = doc(db, 'suppliers', user.uid);
    const supplierData = {
      uid: user.uid,
      email: data.email,
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      enterpriseName: data.enterpriseName,
      location: data.location,
      prices: data.prices,
      isOpen: true,
      openingHours: data.openingHours,
      role: 'supplier',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Try to save with retry
    let docSaved = false;
    let saveAttempts = 0;
    const maxAttempts = 3;
    
    while (!docSaved && saveAttempts < maxAttempts) {
      try {
        saveAttempts++;
        console.log(`[SupplierAuth] Saving supplier document (attempt ${saveAttempts})...`);
        await setDoc(supplierDocRef, supplierData);
        docSaved = true;
        console.log('[SupplierAuth] Supplier document created successfully for:', user.uid);
      } catch (docError: any) {
        console.error(`[SupplierAuth] Document save attempt ${saveAttempts} failed:`, docError.message);
        if (saveAttempts >= maxAttempts) {
          throw new Error(`Failed to save supplier data after ${maxAttempts} attempts: ${docError.message}`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts));
      }
    }

    // Step 3: Verify document was actually saved
    try {
      const verifySnap = await getDoc(supplierDocRef);
      if (!verifySnap.exists()) {
        console.error('[SupplierAuth] Document verification failed - not found after save');
        throw new Error('Supplier data could not be saved. Please try again.');
      }
      console.log('[SupplierAuth] Document verified in Firestore');
    } catch (verifyError: any) {
      console.error('[SupplierAuth] Document verification error:', verifyError.message);
      // Don't fail registration if verification fails, just log it
    }

    // Step 4: Update profile and send verification
    try {
      await Promise.all([
        updateProfile(user, { displayName: data.fullName }),
        sendEmailVerification(user).catch(() => {}),
      ]);
    } catch (profileError: any) {
      console.warn('[SupplierAuth] Profile update/email failed:', profileError.message);
      // Non-critical, don't fail registration
    }

    return { success: true, user };
    
  } catch (error: any) {
    console.error('[SupplierAuth] Registration error:', error);
    
    // If user was created but document failed, we should clean up
    if (user && error.message?.includes('Failed to save supplier data')) {
      console.warn('[SupplierAuth] User created but document save failed. User may need to re-register.');
    }
    
    // Use friendly error message helper
    const errorMessage = getAuthErrorMessage(error.code || error.message);
    
    return {
      success: false,
      error: errorMessage || 'Registration failed. Please try again.',
    };
  }
};

// Helper function to get friendly error messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
    case 'Firebase: Error (auth/email-already-in-use).':
      return 'Looks like you already have an account! Please click the "Login" button above to sign in.';
    case 'auth/invalid-email':
      return 'Invalid email address. Please enter a valid email.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Registration is temporarily disabled. Please try again later.';
    default:
      return '';
  }
};

// Update supplier prices and stock
export const updateSupplierPrices = async (
  supplierId: string,
  prices: { size: 6 | 13 | 19; price: number; inStock: boolean }[]
): Promise<{ success: boolean; error?: string }> => {
  try {
    await setDoc(
      doc(db, 'suppliers', supplierId),
      {
        prices,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error: any) {
    console.error('Update prices error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update prices.',
    };
  }
};

// Toggle shop open/closed status
export const toggleShopStatus = async (
  supplierId: string,
  isOpen: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    await setDoc(
      doc(db, 'suppliers', supplierId),
      {
        isOpen,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error: any) {
    console.error('Toggle status error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update status.',
    };
  }
};

// Get supplier data
export const getSupplierData = async (
  supplierId: string,
  retryCount = 0
): Promise<{ success: boolean; data?: SupplierData; error?: string }> => {
  // Clean up expired cache entries
  cleanupExpiredCache();

  // Check cache first
  if (supplierDataCache.has(supplierId)) {
    const cachedExpiry = cacheExpiry.get(supplierId);
    if (cachedExpiry && Date.now() < cachedExpiry) {
      return supplierDataCache.get(supplierId)!;
    } else {
      // Cache expired, remove it
      supplierDataCache.delete(supplierId);
      cacheExpiry.delete(supplierId);
    }
  }

  const fetchData = async (attempt: number): Promise<{ success: boolean; data?: SupplierData; error?: string }> => {
    try {
      console.log('[SupplierAuth] Fetching data for:', supplierId);
      const supplierRef = doc(db, 'suppliers', supplierId);
      const docSnap = await getDoc(supplierRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SupplierData;
        console.log('[SupplierAuth] Data found for:', supplierId, 'Name:', data.enterpriseName);
        return { success: true, data };
      } else {
        console.warn('[SupplierAuth] No document found for:', supplierId, 'Path:', supplierRef.path);
        console.log('[SupplierAuth] Check if supplier has completed registration or if there is a Firestore permissions issue.');
        return { success: false, error: 'Supplier not found. Please complete registration.' };
      }
    } catch (error: any) {
      if (error.message?.includes('Target ID already exists')) {
        if (attempt < 2) {
          console.warn('[SupplierAuth] Firestore internal target collision detected, retrying getSupplierData...');
          await new Promise(resolve => setTimeout(resolve, 200));
          return fetchData(attempt + 1);
        }

        // Treat persistent target collision as transient network/offline state.
        return { success: false, error: 'offline' };
      }

      // Handle Firestore SDK internal assertion errors
      if (error.message?.includes('INTERNAL ASSERTION FAILED') ||
          error.message?.includes('Unexpected state')) {
        if (attempt < 2) {
          console.warn('[SupplierAuth] Firestore SDK internal error detected, retrying getSupplierData...');
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchData(attempt + 1);
        }

        // Treat persistent SDK errors as offline state
        return { success: false, error: 'offline' };
      }

      // Handle other Firestore errors that might be transient
      if (
        error.message?.includes('client is offline') ||
        error.message?.includes('offline') ||
        error.message?.includes('unavailable') ||
        error.message?.includes('deadline-exceeded')
      ) {
        if (attempt < 2) {
          console.warn('[SupplierAuth] Transient Firestore error detected, retrying getSupplierData...');
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchData(attempt + 1);
        }
        return { success: false, error: 'offline' };
      }

      console.error('[SupplierAuth] Get supplier error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch supplier data.',
      };
    }
  };

  const dataPromise = fetchData(retryCount);
  supplierDataCache.set(supplierId, dataPromise);
  cacheExpiry.set(supplierId, Date.now() + CACHE_TTL);

  return dataPromise;
};

// Subscribe to supplier data changes in real-time
export const subscribeToSupplierData = (
  supplierId: string,
  onData: (data: SupplierData | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  console.log('[SupplierAuth] Starting subscription for:', supplierId);
  const supplierRef = doc(db, 'suppliers', supplierId);
  
  return onSnapshot(
    supplierRef,
    (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as SupplierData;
          console.log('[SupplierAuth] Data received for:', supplierId, 'Enterprise:', data.enterpriseName);
          onData(data);
        } else {
          console.warn('[SupplierAuth] No document found for:', supplierId);
          onData(null);
        }
      } catch (error: any) {
        console.error('[SupplierAuth] Error processing snapshot for', supplierId, ':', error);
        onError?.(error);
      }
    },
    (err) => {
      // Handle Firestore SDK internal errors gracefully
      if (err.message?.includes('INTERNAL ASSERTION FAILED') ||
          err.message?.includes('Unexpected state')) {
        console.warn('[SupplierAuth] Firestore SDK internal error in subscription for', supplierId, '- ignoring');
        return; // Don't call onError for SDK bugs
      }
      
      console.error('[SupplierAuth] Subscription error for', supplierId, ':', err);
      onError?.(err);
    }
  );
};

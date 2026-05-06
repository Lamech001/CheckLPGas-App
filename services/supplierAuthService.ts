import { auth, db } from '@/config/firebase';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { SupplierData } from './types/supplier';

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

// Register a new supplier - OPTIMIZED for speed (under 5 seconds)
// Runs operations in parallel where possible
export const registerSupplier = async (
  data: SupplierRegistrationData
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    // Step 1: Create user account (required before other operations)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    const user = userCredential.user;

    // Step 2: Run profile update and Firestore creation in PARALLEL
    // This saves ~1-2 seconds vs running sequentially
    await Promise.all([
      // Update profile
      updateProfile(user, {
        displayName: data.fullName,
      }),
      // Create supplier document in Firestore
      setDoc(doc(db, 'suppliers', user.uid), {
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
      }),
    ]);

    // Step 3: Send email verification (non-blocking, fire and forget)
    // Don't wait for this to complete - speeds up registration
    sendEmailVerification(user).catch(() => {});

    return { success: true, user };
  } catch (error: any) {
    console.error('Supplier registration error:', error);
    return {
      success: false,
      error: error.message || 'Registration failed. Please try again.',
    };
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
  supplierId: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'suppliers', supplierId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() };
    } else {
      return { success: false, error: 'Supplier not found' };
    }
  } catch (error: any) {
    console.error('Get supplier error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch supplier data.',
    };
  }
};

// Subscribe to supplier data changes in real-time
export const subscribeToSupplierData = (
  supplierId: string,
  onData: (data: SupplierData | null) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const supplierRef = doc(db, 'suppliers', supplierId);
  
  return onSnapshot(
    supplierRef,
    (snapshot: { exists(): boolean; data(): unknown }) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as SupplierData);
      } else {
        onData(null);
      }
    },
    (err: Error) => {
      console.error('Supplier subscription error:', err);
      onError?.(err);
    }
  );
};

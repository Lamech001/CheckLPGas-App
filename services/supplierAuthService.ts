import { auth, db } from "@/config/firebase";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { SupplierData } from "./types/supplier";

const supplierDataCache = new Map<
  string,
  Promise<{ success: boolean; data?: SupplierData; error?: string }>
>();

const SUPPLIER_DASHBOARD_CACHE_PREFIX = "cache_supplier_dashboard_";
const SUPPLIER_DASHBOARD_CACHE_VERSION = "1.0";
// How long we keep supplier dashboard cached offline (ms)
const SUPPLIER_DASHBOARD_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

type CachedSupplierDashboardEntry = {
  version: string;
  timestamp: number;
  data: SupplierData;
};

function getSupplierDashboardCacheKey(supplierId: string) {
  return `${SUPPLIER_DASHBOARD_CACHE_PREFIX}${supplierId}`;
}

async function getCachedSupplierDashboardData(
  supplierId: string,
): Promise<SupplierData | null> {
  try {
    const key = getSupplierDashboardCacheKey(supplierId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedSupplierDashboardEntry = JSON.parse(raw);
    if (parsed?.version !== SUPPLIER_DASHBOARD_CACHE_VERSION) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
    if (Date.now() - (parsed?.timestamp ?? 0) > SUPPLIER_DASHBOARD_CACHE_TTL) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

async function setCachedSupplierDashboardData(
  supplierId: string,
  data: SupplierData,
): Promise<void> {
  try {
    const key = getSupplierDashboardCacheKey(supplierId);
    const entry: CachedSupplierDashboardEntry = {
      version: SUPPLIER_DASHBOARD_CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Silent fail - caching must not break login/dashboard
  }
}

async function clearCachedSupplierDashboardData(
  supplierId: string,
): Promise<void> {
  try {
    const key = getSupplierDashboardCacheKey(supplierId);
    await AsyncStorage.removeItem(key);
  } catch {
    // Silent fail
  }
}

export { clearCachedSupplierDashboardData };

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
  data: SupplierRegistrationData,
): Promise<{ success: boolean; user?: User; error?: string }> => {
  let user = null;

  try {
    // Step 1: Create user account

    const userCredential = await createUserWithEmailAndPassword(
      auth,

      data.email,

      data.password,
    );

    user = userCredential.user;

    // Step 2: Create supplier document in Firestore with retry logic

    const supplierDocRef = doc(db, "suppliers", user.uid);

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

      role: "supplier",

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

        await setDoc(supplierDocRef, supplierData);

        docSaved = true;

        // Verify the document was created

        const verifyDoc = await getDoc(supplierDocRef);

        if (!verifyDoc.exists()) {
          console.error(
            "[SupplierAuth] Document verification failed - document not found after creation",
          );

          throw new Error("Document creation verification failed");
        }
      } catch (docError: any) {
        console.error(
          `[SupplierAuth] Document save attempt ${saveAttempts} failed:`,
          docError.message,
        );

        if (saveAttempts >= maxAttempts) {
          throw new Error(
            `Failed to save supplier data after ${maxAttempts} attempts: ${docError.message}`,
          );
        }

        // Wait before retry

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * saveAttempts),
        );
      }
    }

    // Step 3: Verify document was actually saved

    try {
      const verifySnap = await getDoc(supplierDocRef);

      if (!verifySnap.exists()) {
        console.error(
          "[SupplierAuth] Document verification failed - not found after save",
        );

        throw new Error("Supplier data could not be saved. Please try again.");
      }
    } catch (verifyError: any) {
      console.error(
        "[SupplierAuth] Document verification error:",
        verifyError.message,
      );

      // Don't fail registration if verification fails, just log it
    }

    // Step 4: Update profile and send verification

    try {
      await Promise.all([
        updateProfile(user, { displayName: data.fullName }),

        sendEmailVerification(user).catch(() => {}),
      ]);
    } catch (profileError: any) {
      // Non-critical, don't fail registration
    }

    return { success: true, user };
  } catch (error: any) {
    console.error("[SupplierAuth] Registration error:", error);

    // If user was created but document failed, we should clean up

    if (user && error.message?.includes("Failed to save supplier data")) {
      // User created but document save failed
    }

    // Use friendly error message helper

    const errorMessage = getAuthErrorMessage(error.code || error.message);

    return {
      success: false,

      error: errorMessage || "Registration failed. Please try again.",
    };
  }
};

// Helper function to get friendly error messages

const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case "auth/email-already-in-use":

    case "Firebase: Error (auth/email-already-in-use).":
      return 'Looks like you already have an account! Please click the "Login" button above to sign in.';

    case "auth/invalid-email":
      return "Invalid email address. Please enter a valid email.";

    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";

    case "auth/operation-not-allowed":
      return "Registration is temporarily disabled. Please try again later.";

    default:
      return "";
  }
};

// Update supplier prices and stock

export const updateSupplierPrices = async (
  supplierId: string,

  prices: { size: 6 | 13 | 19; price: number; inStock: boolean }[],
): Promise<{ success: boolean; error?: string }> => {
  try {
    await setDoc(
      doc(db, "suppliers", supplierId),

      {
        prices,

        updatedAt: serverTimestamp(),
      },

      { merge: true },
    );

    return { success: true };
  } catch (error: any) {
    console.error("Update prices error:", error);

    return {
      success: false,

      error: error.message || "Failed to update prices.",
    };
  }
};

// Toggle shop open/closed status

export const toggleShopStatus = async (
  supplierId: string,

  isOpen: boolean,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await setDoc(
      doc(db, "suppliers", supplierId),

      {
        isOpen,

        updatedAt: serverTimestamp(),
      },

      { merge: true },
    );

    return { success: true };
  } catch (error: any) {
    console.error("Toggle status error:", error);

    return {
      success: false,

      error: error.message || "Failed to update status.",
    };
  }
};

// Get supplier data

export const getSupplierData = async (
  supplierId: string,

  retryCount = 0,
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

  const fetchData = async (
    attempt: number,
  ): Promise<{ success: boolean; data?: SupplierData; error?: string }> => {
    try {
      const supplierRef = doc(db, "suppliers", supplierId);

      const docSnap = await getDoc(supplierRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SupplierData;

        return { success: true, data };
      } else {
        console.warn(
          "[SupplierAuth] No document found for:",
          supplierId,
          "Path:",
          supplierRef.path,
        );

        // Try to list all documents in suppliers collection to debug

        try {
          const { collection, getDocs } = await import("firebase/firestore");

          const suppliersRef = collection(db, "suppliers");

          const querySnapshot = await getDocs(suppliersRef);

          querySnapshot.forEach((doc: any) => {
            // Existing supplier found
          });
        } catch (listError) {
          console.error("[SupplierAuth] Error listing suppliers:", listError);
        }

        return {
          success: false,
          error: "Supplier not found. Please complete registration.",
        };
      }
    } catch (error: any) {
      if (error.message?.includes("Target ID already exists")) {
        if (attempt < 2) {
          console.warn(
            "[SupplierAuth] Firestore internal target collision detected, retrying getSupplierData...",
          );

          await new Promise((resolve) => setTimeout(resolve, 200));

          return fetchData(attempt + 1);
        }

        // Treat persistent target collision as transient network/offline state.

        return { success: false, error: "offline" };
      }

      // Handle Firestore SDK internal assertion errors

      if (
        error.message?.includes("INTERNAL ASSERTION FAILED") ||
        error.message?.includes("Unexpected state")
      ) {
        if (attempt < 2) {
          console.warn(
            "[SupplierAuth] Firestore SDK internal error detected, retrying getSupplierData...",
          );

          await new Promise((resolve) => setTimeout(resolve, 500));

          return fetchData(attempt + 1);
        }

        // Treat persistent SDK errors as offline state

        return { success: false, error: "offline" };
      }

      // Handle other Firestore errors that might be transient

      if (
        error.message?.includes("client is offline") ||
        error.message?.includes("offline") ||
        error.message?.includes("unavailable") ||
        error.message?.includes("deadline-exceeded")
      ) {
        if (attempt < 2) {
          console.warn(
            "[SupplierAuth] Transient Firestore error detected, retrying getSupplierData...",
          );

          await new Promise((resolve) => setTimeout(resolve, 500));

          return fetchData(attempt + 1);
        }

        return { success: false, error: "offline" };
      }

      console.error("[SupplierAuth] Get supplier error:", error);

      return {
        success: false,

        error: error.message || "Failed to fetch supplier data.",
      };
    }
  };

  // Offline-first: serve cached dashboard data immediately if available.
  // This makes supplier dashboard usable across app restarts.
  const cachedPromise = getCachedSupplierDashboardData(supplierId);

  const dataPromise = (async () => {
    // If we have cached data, return it fast on first paint.
    const cached = await cachedPromise;
    if (cached) {
      // Fire-and-forget attempt to refresh in background
      // (we still return cached immediately for offline experience)
      fetchData(retryCount)
        .then(async (fresh) => {
          if (fresh?.success && fresh.data) {
            await setCachedSupplierDashboardData(supplierId, fresh.data);
          }
        })
        .catch(() => {});

      return { success: true, data: cached } as {
        success: boolean;
        data?: SupplierData;
      };
    }

    // No cache available: do normal fetch.
    const fresh = await fetchData(retryCount);
    if (fresh?.success && fresh.data) {
      await setCachedSupplierDashboardData(supplierId, fresh.data);
    }
    return fresh;
  })();

  supplierDataCache.set(supplierId, dataPromise);

  cacheExpiry.set(supplierId, Date.now() + CACHE_TTL);

  return dataPromise;
};

// Subscribe to supplier data changes in real-time

export const subscribeToSupplierData = (
  supplierId: string,

  onData: (data: SupplierData | null) => void,

  onError?: (error: Error) => void,
): (() => void) => {
  const supplierRef = doc(db, "suppliers", supplierId);

  return onSnapshot(
    supplierRef,

    (snapshot: any) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data() as SupplierData;

          onData(data);
        } else {
          console.warn("[SupplierAuth] No document found for:", supplierId);

          onData(null);
        }
      } catch (error: any) {
        console.error(
          "[SupplierAuth] Error processing snapshot for",
          supplierId,
          ":",
          error,
        );

        onError?.(error);
      }
    },

    (err: any) => {
      // Handle Firestore SDK internal errors gracefully

      if (
        err.message?.includes("INTERNAL ASSERTION FAILED") ||
        err.message?.includes("Unexpected state")
      ) {
        console.warn(
          "[SupplierAuth] Firestore SDK internal error in subscription for",
          supplierId,
          "- ignoring",
        );

        return; // Don't call onError for SDK bugs
      }

      console.error(
        "[SupplierAuth] Subscription error for",
        supplierId,
        ":",
        err,
      );

      onError?.(err);
    },
  );
};

export const updateSupplierProfile = async (
  supplierId: string,
  data: {
    fullName: string;
    enterpriseName: string;
    phoneNumber: string;
    location: string;
    openingHours: { open: string; close: string };
  },
): Promise<{ success: boolean; error?: string }> => {
  try {
    const supplierRef = doc(db, "suppliers", supplierId);

    await updateDoc(supplierRef, {
      fullName: data.fullName,
      enterpriseName: data.enterpriseName,
      phoneNumber: data.phoneNumber,
      location: {
        address: data.location,
      },
      openingHours: data.openingHours,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[SupplierAuth] Error updating supplier profile:", error);
    return {
      success: false,
      error: error.message || "Failed to update profile",
    };
  }
};

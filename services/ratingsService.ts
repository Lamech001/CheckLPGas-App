/**
 * Ratings Service - Handle supplier ratings from consumers
 * Features: Submit ratings, calculate averages, get rating history
 */

import { db } from '@/config/firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

// Type aliases for Firebase types that may not be properly exported
type FirestoreQueryDocumentSnapshot = any;
type FirestoreQuerySnapshot = any;

// Helper to check if error is offline-related
const isOfflineError = (error: any): boolean => {
  return error?.code === 'unavailable' ||
         error?.message?.includes('client is offline') ||
         error?.message?.includes('offline');
};

export interface RatingData {
  id?: string;
  supplierId: string;
  consumerId: string;
  consumerName: string;
  rating: number; // 1-5 stars
  review?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface SupplierRatingStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

const RATINGS_COLLECTION = 'ratings';
const SUPPLIERS_COLLECTION = 'suppliers';

/**
 * Submit or update a rating for a supplier
 */
export const submitRating = async (
  supplierId: string,
  consumerId: string,
  consumerName: string,
  rating: number,
  review?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, error: 'Rating must be between 1 and 5 stars' };
    }

    const ratingId = `${supplierId}_${consumerId}`;
    const ratingRef = doc(db, RATINGS_COLLECTION, ratingId);

    const ratingData: RatingData = {
      supplierId,
      consumerId,
      consumerName,
      rating,
      review: review || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Check if rating already exists
    const existingDoc = await getDoc(ratingRef);
    if (existingDoc.exists()) {
      // Update existing rating
      await updateDoc(ratingRef, {
        rating,
        review: review || '',
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new rating
      await setDoc(ratingRef, ratingData);
    }

    // Recalculate supplier's average rating
    await updateSupplierRatingStats(supplierId);

    return { success: true };
  } catch (error: any) {
    // Handle offline error - rating will sync when back online
    if (isOfflineError(error)) {
      console.log('[Ratings] Offline - rating queued for sync');
      return { success: true }; // Treat as success for offline, it'll sync later
    }
    console.error('[Ratings] Submit rating error:', error);
    return { success: false, error: error.message || 'Failed to submit rating' };
  }
};

/**
 * Get all ratings for a specific supplier
 */
export const getSupplierRatings = async (
  supplierId: string,
  maxResults: number = 50
): Promise<{ success: boolean; ratings?: RatingData[]; error?: string }> => {
  try {
    const ratingsQuery = query(
      collection(db, RATINGS_COLLECTION),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(ratingsQuery);
    const ratings: RatingData[] = [];

    snapshot.forEach((doc: FirestoreQueryDocumentSnapshot) => {
      const data = doc.data() as RatingData;
      ratings.push({
        id: doc.id,
        ...data,
      });
    });

    return { success: true, ratings };
  } catch (error: any) {
    if (isOfflineError(error)) {
      console.log('[Ratings] Offline - returning empty ratings');
      return { success: true, ratings: [] };
    }
    console.error('[Ratings] Get ratings error:', error);
    return { success: false, error: error.message || 'Failed to fetch ratings' };
  }
};

/**
 * Get rating statistics for a supplier
 */
export const getSupplierRatingStats = async (
  supplierId: string
): Promise<{ success: boolean; stats?: SupplierRatingStats; error?: string }> => {
  try {
    const ratingsQuery = query(
      collection(db, RATINGS_COLLECTION),
      where('supplierId', '==', supplierId)
    );

    const snapshot = await getDocs(ratingsQuery);

    let totalRating = 0;
    let totalCount = 0;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    snapshot.forEach((doc: FirestoreQueryDocumentSnapshot) => {
      const data = doc.data() as RatingData;
      const rating = Math.round(data.rating);
      if (rating >= 1 && rating <= 5) {
        totalRating += data.rating;
        totalCount++;
        distribution[rating as keyof typeof distribution]++;
      }
    });

    const stats: SupplierRatingStats = {
      averageRating: totalCount > 0 ? totalRating / totalCount : 0,
      totalRatings: totalCount,
      ratingDistribution: distribution,
    };

    return { success: true, stats };
  } catch (error: any) {
    if (isOfflineError(error)) {
      console.log('[Ratings] Offline - returning zero stats');
      return {
        success: true,
        stats: { averageRating: 0, totalRatings: 0, ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } }
      };
    }
    console.error('[Ratings] Get stats error:', error);
    return { success: false, error: error.message || 'Failed to fetch rating stats' };
  }
};

/**
 * Check if consumer has already rated a supplier
 */
export const hasConsumerRated = async (
  supplierId: string,
  consumerId: string
): Promise<{ success: boolean; rated?: boolean; rating?: RatingData; error?: string }> => {
  try {
    const ratingId = `${supplierId}_${consumerId}`;
    const ratingRef = doc(db, RATINGS_COLLECTION, ratingId);
    const docSnap = await getDoc(ratingRef);

    if (docSnap.exists()) {
      return { 
        success: true, 
        rated: true, 
        rating: { id: docSnap.id, ...docSnap.data() as RatingData } 
      };
    }

    return { success: true, rated: false };
  } catch (error: any) {
    console.error('[Ratings] Check rating error:', error);
    return { success: false, error: error.message || 'Failed to check rating' };
  }
};

/**
 * Delete a rating
 */
export const deleteRating = async (
  supplierId: string,
  consumerId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const ratingId = `${supplierId}_${consumerId}`;
    const ratingRef = doc(db, RATINGS_COLLECTION, ratingId);
    
    await deleteDoc(ratingRef);
    
    // Recalculate supplier's average rating
    await updateSupplierRatingStats(supplierId);

    return { success: true };
  } catch (error: any) {
    console.error('[Ratings] Delete rating error:', error);
    return { success: false, error: error.message || 'Failed to delete rating' };
  }
};

/**
 * Subscribe to real-time rating updates for a supplier
 */
export const subscribeToSupplierRatings = (
  supplierId: string,
  onRatingsUpdate: (ratings: RatingData[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const ratingsQuery = query(
    collection(db, RATINGS_COLLECTION),
    where('supplierId', '==', supplierId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    ratingsQuery,
    (snapshot: FirestoreQuerySnapshot) => {
      const ratings: RatingData[] = [];
      snapshot.forEach((doc: FirestoreQueryDocumentSnapshot) => {
        ratings.push({ id: doc.id, ...doc.data() as RatingData });
      });
      onRatingsUpdate(ratings);
    },
    (error: Error) => {
      console.error('[Ratings] Subscription error:', error);
      onError?.(error);
    }
  );
};

/**
 * Update supplier document with rating statistics
 */
const updateSupplierRatingStats = async (supplierId: string): Promise<void> => {
  try {
    const result = await getSupplierRatingStats(supplierId);
    if (!result.success || !result.stats) return;

    const supplierRef = doc(db, SUPPLIERS_COLLECTION, supplierId);
    const supplierDoc = await getDoc(supplierRef);

    if (supplierDoc.exists()) {
      await updateDoc(supplierRef, {
        rating: result.stats.averageRating,
        totalRatings: result.stats.totalRatings,
        ratingDistribution: result.stats.ratingDistribution,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[Ratings] Update supplier stats error:', error);
  }
};

/**
 * Get top-rated suppliers
 */
export const getTopRatedSuppliers = async (
  minRatings: number = 3,
  maxResults: number = 10
): Promise<{ success: boolean; supplierIds?: string[]; error?: string }> => {
  try {
    const suppliersQuery = query(
      collection(db, SUPPLIERS_COLLECTION),
      where('totalRatings', '>=', minRatings),
      orderBy('rating', 'desc'),
      orderBy('totalRatings', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(suppliersQuery);
    const supplierIds: string[] = [];

    snapshot.forEach((doc: FirestoreQueryDocumentSnapshot) => {
      supplierIds.push(doc.id);
    });

    return { success: true, supplierIds };
  } catch (error: any) {
    console.error('[Ratings] Get top suppliers error:', error);
    return { success: false, error: error.message || 'Failed to fetch top suppliers' };
  }
};

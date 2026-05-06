import { db } from '@/config/firebase';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { CreateReviewData, Review, SupplierRating } from './types/review';

const REVIEWS_COLLECTION = 'reviews';
const SUPPLIERS_COLLECTION = 'suppliers';

// Add a new review
export const addReview = async (
  data: CreateReviewData
): Promise<{ success: boolean; reviewId?: string; error?: string }> => {
  try {
    // Check if review already exists for this order
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('orderId', '==', data.orderId)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return {
        success: false,
        error: 'You have already reviewed this order.',
      };
    }

    // Add review
    const reviewRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
      ...data,
      createdAt: serverTimestamp(),
    });

    // Update supplier's average rating
    await updateSupplierRating(data.supplierId);

    return { success: true, reviewId: reviewRef.id };
  } catch (error: any) {
    console.error('Add review error:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit review.',
    };
  }
};

// Get reviews for a supplier
export const getSupplierReviews = async (
  supplierId: string
): Promise<{ success: boolean; reviews?: Review[]; error?: string }> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const reviews: Review[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Review);
    });

    return { success: true, reviews };
  } catch (error: any) {
    console.error('Get supplier reviews error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch reviews.',
    };
  }
};

// Get reviews by a consumer
export const getConsumerReviews = async (
  consumerId: string
): Promise<{ success: boolean; reviews?: Review[]; error?: string }> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('consumerId', '==', consumerId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const reviews: Review[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Review);
    });

    return { success: true, reviews };
  } catch (error: any) {
    console.error('Get consumer reviews error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch reviews.',
    };
  }
};

// Check if order has been reviewed
export const hasReviewedOrder = async (
  orderId: string
): Promise<boolean> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('orderId', '==', orderId)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Check review error:', error);
    return false;
  }
};

// Update supplier's average rating
export const updateSupplierRating = async (supplierId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('supplierId', '==', supplierId)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // No reviews, reset rating
      await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
        averageRating: 0,
        totalReviews: 0,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    let totalRating = 0;
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    querySnapshot.forEach((doc) => {
      const rating = doc.data().rating;
      totalRating += rating;
      ratingCounts[rating as keyof typeof ratingCounts]++;
    });

    const averageRating = totalRating / querySnapshot.size;

    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      averageRating,
      totalReviews: querySnapshot.size,
      ratingCounts,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Update supplier rating error:', error);
  }
};

// Get supplier rating summary
export const getSupplierRating = async (
  supplierId: string
): Promise<{ success: boolean; rating?: SupplierRating; error?: string }> => {
  try {
    const supplierDoc = await getDoc(doc(db, SUPPLIERS_COLLECTION, supplierId));
    
    if (!supplierDoc.exists()) {
      return {
        success: false,
        error: 'Supplier not found',
      };
    }

    const data = supplierDoc.data();
    const rating: SupplierRating = {
      averageRating: data.averageRating || 0,
      totalReviews: data.totalReviews || 0,
      ratingCounts: data.ratingCounts || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    return { success: true, rating };
  } catch (error: any) {
    console.error('Get supplier rating error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch rating.',
    };
  }
};

// Subscribe to supplier reviews (real-time)
export const subscribeToSupplierReviews = (
  supplierId: string,
  callback: (reviews: Review[]) => void
) => {
  const q = query(
    collection(db, REVIEWS_COLLECTION),
    where('supplierId', '==', supplierId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const reviews: Review[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Review);
    });
    callback(reviews);
  });
};

// Get recent reviews (for display on cards)
export const getRecentReviews = async (
  supplierId: string,
  maxReviews: number = 3
): Promise<{ success: boolean; reviews?: Review[]; error?: string }> => {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc'),
      limit(maxReviews)
    );

    const querySnapshot = await getDocs(q);
    const reviews: Review[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      reviews.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Review);
    });

    return { success: true, reviews };
  } catch (error: any) {
    console.error('Get recent reviews error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch reviews.',
    };
  }
};

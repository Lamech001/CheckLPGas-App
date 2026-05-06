// Review/Rating Types

export interface Review {
  id: string;
  orderId: string;
  consumerId: string;
  consumerName: string;
  supplierId: string;
  rating: number; // 1-5 stars
  comment: string;
  createdAt: Date;
}

export interface CreateReviewData {
  orderId: string;
  consumerId: string;
  consumerName: string;
  supplierId: string;
  rating: number;
  comment: string;
}

export interface SupplierRating {
  averageRating: number;
  totalReviews: number;
  ratingCounts: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export const STAR_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Very Good',
  3: 'Good',
  2: 'Fair',
  1: 'Poor',
};

export const getStarLabel = (rating: number): string => {
  return STAR_LABELS[rating] || 'Unknown';
};

export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

export const getRatingColor = (rating: number): string => {
  if (rating >= 4.5) return '#4CAF50'; // Green
  if (rating >= 3.5) return '#8BC34A'; // Light Green
  if (rating >= 2.5) return '#FFC107'; // Yellow
  if (rating >= 1.5) return '#FF9800'; // Orange
  return '#F44336'; // Red
};

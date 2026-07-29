// Supplier/Gas Dealer Types

export type CylinderSize = 6 | 13 | 19;

export interface GasPrice {
  size: CylinderSize;
  price: number;
  inStock: boolean;
}

export interface SupplierData {
  uid: string;
  email: string;
  fullName?: string;
  enterpriseName: string;
  phoneNumber: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  /** Geohash computed from location.latitude/longitude for efficient geospatial Firestore queries */
  geohash?: string;
  prices: GasPrice[];
  isOpen: boolean;
  openingHours?: {
    open: string;
    close: string;
  };
  // Rating fields
  rating?: number; // Average rating (0-5)
  totalRatings?: number; // Total number of ratings
  ratingDistribution?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierWithDistance extends SupplierData {
  distance: number; // in km
}

export interface FilterState {
  size: CylinderSize | "all";
}

export const CYLINDER_SIZES: { value: CylinderSize | "all"; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: 6, label: "6kg" },
    { value: 13, label: "13kg" },
    { value: 19, label: "19kg" },
  ];

export const DEFAULT_RADIUS_KM = 1;

export const getPriceForSize = (
  prices: GasPrice[],
  size: CylinderSize,
): number | null => {
  const price = prices.find((p) => p.size === size);
  return price?.inStock ? price.price : null;
};

export const formatPrice = (price: number): string => {
  return `Ksh ${price.toLocaleString()}`;
};

export const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${(distance * 1000).toFixed(0)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

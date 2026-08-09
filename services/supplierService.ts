import { db } from "@/config/firebase";

import {
    collection,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";

import { calculateDistance } from "./cachedSupplierService";

import { getGeoBounds } from "@/utils/geohashUtils";
import {
    CylinderSize,
    DEFAULT_RADIUS_KM,
    SupplierData,
    SupplierWithDistance,
} from "./types/supplier";

// Type aliases for Firebase types that may not be properly exported
type FirestoreQueryDocumentSnapshot = any;
type FirestoreQuerySnapshot = any;

// Fetch suppliers within radius using geohash bounding box, then refine with Haversine

export const getSuppliersWithinRadius = async (
  userLat: number,

  userLon: number,

  radiusKm: number = DEFAULT_RADIUS_KM,
): Promise<SupplierWithDistance[]> => {
  try {
    const bounds = getGeoBounds(userLat, userLon, radiusKm);
    const suppliersQuery = query(
      collection(db, "suppliers"),
      where("geohash", ">=", bounds.minGeohash),
      where("geohash", "<=", bounds.maxGeohash),
      orderBy("geohash", "asc"),
    );

    const querySnapshot = await getDocs(suppliersQuery);

    // Use map + filter for better performance

    const suppliers = querySnapshot.docs

      .map((doc: FirestoreQueryDocumentSnapshot) => {
        const data = doc.data() as SupplierData;

        const distance = calculateDistance(
          userLat,

          userLon,

          data.location.latitude,

          data.location.longitude,
        );

        return { data, distance };
      })

      .filter(({ distance }: { distance: number }) => distance <= radiusKm)

      .map(({ data, distance }: { data: SupplierData; distance: number }) => ({
        ...data,
        distance,
      }))

      .sort(
        (a: SupplierWithDistance, b: SupplierWithDistance) =>
          a.distance - b.distance,
      );

    return suppliers;
  } catch {
    // Silently handle error - return empty array

    return [];
  }
};

// Real-time listener for suppliers within radius - using geohash bounding box

export const subscribeToSuppliers = (
  userLat: number,

  userLon: number,

  radiusKm: number,

  callback: (suppliers: SupplierWithDistance[]) => void,
) => {
  const bounds = getGeoBounds(userLat, userLon, radiusKm);
  const suppliersQuery = query(
    collection(db, "suppliers"),
    where("geohash", ">=", bounds.minGeohash),
    where("geohash", "<=", bounds.maxGeohash),
    orderBy("geohash", "asc"),
  );

  return onSnapshot(
    suppliersQuery,
    (snapshot: FirestoreQuerySnapshot) => {
      // Optimized processing with map/filter chain

      const suppliers = snapshot.docs

        .map((doc: FirestoreQueryDocumentSnapshot) => {
          const data = doc.data() as SupplierData;

          const distance = calculateDistance(
            userLat,

            userLon,

            data.location.latitude,

            data.location.longitude,
          );

          return { data, distance };
        })

        .filter(({ distance }: { distance: number }) => distance <= radiusKm)

        .map(
          ({ data, distance }: { data: SupplierData; distance: number }) => ({
            ...data,
            distance,
          }),
        )

        .sort(
          (a: SupplierWithDistance, b: SupplierWithDistance) =>
            a.distance - b.distance,
        );

      callback(suppliers);
    },
    (error: Error) => {
      console.error("Error subscribing to suppliers:", error);

      // Silently handle subscription error

      callback([]);
    },
  );
};

// Filter suppliers by cylinder size

export const filterByCylinderSize = (
  suppliers: SupplierWithDistance[],

  size: CylinderSize | "all",
): SupplierWithDistance[] => {
  if (size === "all") return suppliers;

  return suppliers

    .filter((supplier) =>
      supplier.prices.some((price) => price.size === size && price.inStock),
    )

    .sort((a, b) => a.distance - b.distance);
};

// Get supplier by ID - optimized direct lookup

export const getSupplierById = async (
  supplierId: string,
): Promise<SupplierData | null> => {
  try {
    // Use doc() for direct lookup instead of querying entire collection

    const { doc, getDoc } = await import("firebase/firestore");

    const supplierRef = doc(db, "suppliers", supplierId);

    const supplierSnap = await getDoc(supplierRef);

    if (supplierSnap.exists()) {
      return supplierSnap.data() as SupplierData;
    }

    return null;
  } catch {
    // Silently handle error

    return null;
  }
};

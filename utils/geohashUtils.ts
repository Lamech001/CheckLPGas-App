/**
 * Geohash utility functions for efficient geospatial queries
 * Uses ngeohash library to calculate bounding boxes for Firestore queries
 */

// @ts-ignore - ngeohash doesn't have TypeScript definitions
import ngeohash from "ngeohash";

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  minGeohash: string;
  maxGeohash: string;
}

/**
 * Calculate bounding box for a given center point and radius
 * Returns the geohash range for efficient Firestore queries
 */
export function getGeoBounds(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): GeoBounds {
  // Earth's radius in km
  const EARTH_RADIUS = 6371;

  // Calculate bounding box in degrees
  const latDelta = (radiusKm / EARTH_RADIUS) * (180 / Math.PI);
  const lonDelta =
    ((radiusKm / EARTH_RADIUS) * (180 / Math.PI)) /
    Math.cos((centerLat * Math.PI) / 180);

  const minLat = centerLat - latDelta;
  const maxLat = centerLat + latDelta;
  const minLon = centerLon - lonDelta;
  const maxLon = centerLon + lonDelta;

  // Calculate geohash bounds for the bounding box.
  // Use precision 6 (approximately 1.2km x 0.6km resolution)
  //
  // NOTE: This implementation intentionally uses the caller-provided radius
  // (which should include padding) so that the resulting geohash bounds form a
  // SUPerset candidate set. We then filter precisely by distance in JS.
  const precision = 6;
  const minGeohash = ngeohash.encode(minLat, minLon, precision);
  const maxGeohash = ngeohash.encode(maxLat, maxLon, precision);

  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    minGeohash,
    maxGeohash,
  };
}

/**
 * Generate geohash for a given latitude and longitude
 */
export function generateGeohash(
  lat: number,
  lon: number,
  precision: number = 6,
): string {
  return ngeohash.encode(lat, lon, precision);
}

/**
 * Calculate distance between two points using Haversine formula
 * (kept for client-side verification)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const toRad = (value: number) => value * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

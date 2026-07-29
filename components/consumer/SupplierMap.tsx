import { AppColors, AppSizes } from "@/constants/appTheme";
import {
  CylinderSize,
  formatPrice,
  getPriceForSize,
  SupplierWithDistance,
} from "@/services/types/supplier";
import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";

// Professional attractive map theme with warm colors
const professionalMapStyle = [
  {
    featureType: "all",
    elementType: "geometry",
    stylers: [{ color: "#f5f0e6" }],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#4fc3f7" }, { lightness: 10 }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#0277bd" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#c8e6c9" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#8d6e63" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#6d4c41" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#ffcc80" }, { lightness: 15 }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#a5d6a7" }, { lightness: 10 }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#424242" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#424242" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#e0e0e0" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#bdbdbd" }, { weight: 1 }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "all",
    elementType: "labels.text.fill",
    stylers: [{ color: "#424242" }],
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }, { weight: 2 }],
  },
];

interface SupplierMapProps {
  userLocation: {
    latitude: number;
    longitude: number;
  };
  suppliers: SupplierWithDistance[];
  selectedSize: CylinderSize | "all";
  radiusKm?: number;
  maxMarkers?: number;
}

export const SupplierMap: React.FC<SupplierMapProps> = memo(
  function SupplierMap({
    userLocation,
    suppliers,
    selectedSize,
    radiusKm = 1,
    maxMarkers = 50,
  }) {
    // Calculate delta for radius to fill the map using theme constants
    const [region, setRegion] = useState({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: AppSizes.mapLatitudeDelta,
      longitudeDelta: AppSizes.mapLongitudeDelta,
    });

    // Paginate suppliers to show only the closest ones to avoid performance issues
    const visibleSuppliers = suppliers.slice(0, maxMarkers);

    const getMarkerColor = (supplier: SupplierWithDistance) => {
      if (selectedSize !== "all") {
        const price = getPriceForSize(supplier.prices, selectedSize);
        return price !== null
          ? AppColors.mapSupplierOpen
          : AppColors.mapSupplierClosed;
      }
      return supplier.isOpen
        ? AppColors.mapSupplierOpen
        : AppColors.mapSupplierClosed;
    };

    const getMarkerPrice = (supplier: SupplierWithDistance) => {
      if (selectedSize !== "all") {
        const price = getPriceForSize(supplier.prices, selectedSize);
        return price !== null ? formatPrice(price) : "N/A";
      }

      const inStockPrices = supplier.prices.filter((p) => p.inStock);
      if (inStockPrices.length === 0) return "N/A";
      const minPrice = Math.min(...inStockPrices.map((p) => p.price));
      return formatPrice(minPrice);
    };

    // Validate user location coordinates before rendering
    const safeUserLocation = {
      latitude:
        typeof userLocation?.latitude === "number" &&
        isFinite(userLocation.latitude)
          ? userLocation.latitude
          : -1.286389,
      longitude:
        typeof userLocation?.longitude === "number" &&
        isFinite(userLocation.longitude)
          ? userLocation.longitude
          : 36.817223,
    };

    return (
      <View style={styles.container}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          customMapStyle={professionalMapStyle}
        >
          {/* User Location */}
          <Marker
            coordinate={safeUserLocation}
            pinColor={AppColors.mapUserMarker}
            title="Your Location"
          />

          {/* Radius Circle */}
          <Circle
            center={safeUserLocation}
            radius={radiusKm * 1000}
            strokeColor={AppColors.mapRadiusStroke}
            fillColor={AppColors.mapRadiusFill}
            strokeWidth={AppSizes.mapStrokeWidth}
          />

          {/* Supplier Markers */}
          {visibleSuppliers.map((supplier) => {
            const lat = supplier.location?.latitude;
            const lng = supplier.location?.longitude;

            // Prevent react-native-maps from crashing when coordinates are null/undefined
            if (lat == null || lng == null) return null;

            return (
              <Marker
                key={supplier.uid}
                coordinate={{ latitude: lat, longitude: lng }}
                pinColor={getMarkerColor(supplier)}
                title={supplier.enterpriseName}
                description={`${getMarkerPrice(supplier)} - ${supplier.phoneNumber}`}
              />
            );
          })}
        </MapView>

        {/* Radius Indicator */}
        <View style={styles.radiusIndicator}>
          <Text style={styles.radiusText}>
            Showing suppliers within {radiusKm}km
          </Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  radiusIndicator: {
    position: "absolute",
    top: AppSizes.spacingLarge,
    left: AppSizes.spacingLarge,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: AppSizes.spacingSmall,
    borderRadius: AppSizes.radiusXXLarge,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  radiusText: {
    fontSize: AppSizes.fontSmall,
    fontWeight: "600",
    color: AppColors.white,
  },
});

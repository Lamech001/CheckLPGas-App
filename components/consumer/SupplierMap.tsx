import { AppColors, AppSizes } from '@/constants/appTheme';
import { CylinderSize, formatPrice, getPriceForSize, SupplierWithDistance } from '@/services/types/supplier';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface SupplierMapProps {
  userLocation: {
    latitude: number;
    longitude: number;
  };
  suppliers: SupplierWithDistance[];
  selectedSize: CylinderSize | 'all';
  radiusKm?: number;
}

export const SupplierMap: React.FC<SupplierMapProps> = ({
  userLocation,
  suppliers,
  selectedSize,
  radiusKm = 1,
}) => {
  // Calculate delta for radius to fill the map using theme constants
  const [region, setRegion] = useState({
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    latitudeDelta: AppSizes.mapLatitudeDelta,
    longitudeDelta: AppSizes.mapLongitudeDelta,
  });

  useEffect(() => {
    // Update region when user location changes
    setRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: AppSizes.mapLatitudeDelta,
      longitudeDelta: AppSizes.mapLongitudeDelta,
    });
  }, [userLocation]);

  const getMarkerColor = (supplier: SupplierWithDistance) => {
    if (selectedSize !== 'all') {
      const price = getPriceForSize(supplier.prices, selectedSize);
      return price !== null ? AppColors.mapSupplierOpen : AppColors.mapSupplierClosed;
    }
    return supplier.isOpen ? AppColors.mapSupplierOpen : AppColors.mapSupplierClosed;
  };

  const getMarkerPrice = (supplier: SupplierWithDistance) => {
    if (selectedSize !== 'all') {
      const price = getPriceForSize(supplier.prices, selectedSize);
      return price !== null ? formatPrice(price) : 'N/A';
    }
    
    const inStockPrices = supplier.prices.filter(p => p.inStock);
    if (inStockPrices.length === 0) return 'N/A';
    const minPrice = Math.min(...inStockPrices.map(p => p.price));
    return formatPrice(minPrice);
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
      >
        {/* User Location */}
        <Marker
          coordinate={userLocation}
          pinColor={AppColors.mapUserMarker}
          title="Your Location"
        />

        {/* Radius Circle */}
        <Circle
          center={userLocation}
          radius={radiusKm * 1000}
          strokeColor={AppColors.mapRadiusStroke}
          fillColor={AppColors.mapRadiusFill}
          strokeWidth={AppSizes.mapStrokeWidth}
        />

        {/* Supplier Markers */}
        {suppliers.map((supplier) => (
          <Marker
            key={supplier.uid}
            coordinate={{
              latitude: supplier.location.latitude,
              longitude: supplier.location.longitude,
            }}
            pinColor={getMarkerColor(supplier)}
            title={supplier.enterpriseName}
            description={`${getMarkerPrice(supplier)} - ${supplier.phoneNumber}`}
          />
        ))}
      </MapView>

      {/* Radius Indicator */}
      <View style={styles.radiusIndicator}>
        <Text style={styles.radiusText}>Showing suppliers within {radiusKm}km</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  radiusIndicator: {
    position: 'absolute',
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
    fontWeight: '600',
    color: AppColors.white,
  },
});

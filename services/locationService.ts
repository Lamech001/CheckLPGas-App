import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export const requestLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
};

export const getCurrentLocation = async (): Promise<LocationData | null> => {
  try {
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      Alert.alert(
        'Location Permission Required',
        'We need your location to show nearby gas prices and for your safety. Please enable location services.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Location.enableNetworkProviderAsync() }
        ]
      );
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Try to reverse geocode, but fallback to coordinates if service is unavailable
    let formattedAddress = 'Current Location';
    
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const address = addresses[0];
      if (address) {
        formattedAddress = `${address.city || address.subregion || ''}, ${address.region || address.country || 'Kenya'}`;
      }
    } catch (geoError) {
      // Geocoding failed - use coordinates as fallback
      formattedAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return {
      latitude,
      longitude,
      address: formattedAddress,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
};

export const checkLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
};

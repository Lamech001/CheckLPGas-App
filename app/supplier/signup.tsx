import { AppStatusBar } from '@/components/AppStatusBar';
import { getCurrentLocation } from '@/services/locationService';
import { registerSupplier, SupplierRegistrationData } from '@/services/supplierAuthService';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface PriceInput {
  size: 6 | 13 | 19;
  price: string;
  inStock: boolean;
}

export default function SupplierSignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Form data
  const [enterpriseName, setEnterpriseName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('18:00');

  // Prices for each cylinder size
  const [prices, setPrices] = useState<PriceInput[]>([
    { size: 6, price: '', inStock: true },
    { size: 13, price: '', inStock: true },
    { size: 19, price: '', inStock: true },
  ]);

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setLocation({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
        setAddress(currentLocation.address || 'Current Location');
        Alert.alert('Success', 'Location captured successfully!');
      } else {
        Alert.alert('Error', 'Could not get your location. Please check location permissions.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const updatePrice = (size: number, field: 'price' | 'inStock', value: string | boolean) => {
    setPrices(prev =>
      prev.map(p =>
        p.size === size ? { ...p, [field]: value } : p
      )
    );
  };

  const handleSignup = async () => {
    // Validation
    if (!enterpriseName.trim()) {
      Alert.alert('Error', 'Please enter your enterprise name');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Please set your shop location');
      return;
    }

    // Validate at least one price is set
    const validPrices = prices.filter(p => p.price.trim() !== '' && parseFloat(p.price) > 0);
    if (validPrices.length === 0) {
      Alert.alert('Error', 'Please set prices for at least one cylinder size');
      return;
    }

    setLoading(true);

    try {
      const supplierData: SupplierRegistrationData = {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
        enterpriseName: enterpriseName.trim(),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address.trim() || 'Unknown Location',
        },
        prices: prices
          .filter(p => p.price.trim() !== '')
          .map(p => ({
            size: p.size,
            price: parseFloat(p.price),
            inStock: p.inStock,
          })),
        openingHours: {
          open: openingTime,
          close: closingTime,
        },
      };

      const result = await registerSupplier(supplierData);

      if (result.success) {
        // Navigate to verification screen with email and role
        router.push({
          pathname: '/verify-email',
          params: { 
            email: email.trim(),
            role: 'supplier',
            from: 'supplier'
          }
        });
      } else {
        Alert.alert('Registration Failed', result.error || 'Something went wrong. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <AppStatusBar backgroundColor="#2E7D32" barStyle="light-content" />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <FontAwesome5 name="store" size={24} color="#1976D2" />
          <Text style={styles.infoText}>
            Register your gas supply business to connect with customers in your area.
          </Text>
        </View>

        {/* Enterprise Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enterprise Information</Text>
          
          <View style={styles.inputContainer}>
            <FontAwesome5 name="building" size={16} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enterprise/Shop Name"
              value={enterpriseName}
              onChangeText={setEnterpriseName}
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="user" size={16} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Your Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          <View style={styles.inputContainer}>
            <FontAwesome5 name="envelope" size={16} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="lock" size={16} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputContainer}>
            <FontAwesome5 name="phone" size={16} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Phone Number (e.g., +254712345678)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop Location</Text>
          
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator color="#1976D2" />
            ) : (
              <>
                <FontAwesome5 name="map-marker-alt" size={20} color="#1976D2" />
                <Text style={styles.locationButtonText}>
                  {location ? 'Location Captured ✓' : 'Get Current Location'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {location && (
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>📍 {address}</Text>
              <Text style={styles.coordinatesText}>
                Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {/* Gas Prices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gas Cylinder Refill Prices</Text>
          <Text style={styles.sectionSubtitle}>Set your Refill prices and stock availability</Text>
          
          {prices.map((priceItem) => {
            // Different flame sizes for different cylinder sizes
            const getIconForSize = (size: number) => {
              switch (size) {
                case 6: return 'fire';
                case 13: return 'burn';
                case 19: return 'fire-alt';
                default: return 'fire';
              }
            };
            
            return (
            <View key={priceItem.size} style={styles.priceRow}>
              <View style={styles.sizeLabel}>
                <FontAwesome5 name={getIconForSize(priceItem.size)} size={18} color="#FF6B35" />
                <Text style={styles.sizeText}>{priceItem.size}kg</Text>
              </View>
              
              <TextInput
                style={styles.priceInput}
                placeholder="Refill Price (Ksh)"
                value={priceItem.price}
                onChangeText={(value) => updatePrice(priceItem.size, 'price', value)}
                keyboardType="numeric"
                placeholderTextColor="#666"
              />
              
              <TouchableOpacity
                style={[
                  styles.stockToggle,
                  priceItem.inStock ? styles.inStock : styles.outOfStock,
                ]}
                onPress={() => updatePrice(priceItem.size, 'inStock', !priceItem.inStock)}
              >
                <Text style={styles.stockToggleText}>
                  {priceItem.inStock ? 'In Stock' : 'Out'}
                </Text>
              </TouchableOpacity>
            </View>
            );
          })}
        </View>

        {/* Opening Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opening Hours</Text>
          
          <View style={styles.hoursRow}>
            <View style={styles.hoursInput}>
              <Text style={styles.hoursLabel}>Opens</Text>
              <TextInput
                style={styles.timeInput}
                value={openingTime}
                onChangeText={setOpeningTime}
                placeholder="08:00"
              />
            </View>
            
            <View style={styles.hoursInput}>
              <Text style={styles.hoursLabel}>Closes</Text>
              <TextInput
                style={styles.timeInput}
                value={closingTime}
                onChangeText={setClosingTime}
                placeholder="18:00"
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Register as Supplier</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976D2',
    borderStyle: 'dashed',
    gap: 8,
  },
  locationButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1976D2',
  },
  locationInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sizeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 70,
    gap: 6,
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
  stockToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  inStock: {
    backgroundColor: '#4CAF50',
  },
  outOfStock: {
    backgroundColor: '#f44336',
  },
  stockToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 16,
  },
  hoursInput: {
    flex: 1,
  },
  hoursLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 32,
  },
});

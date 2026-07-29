import { AppStatusBar } from '@/components/AppStatusBar';
import { getCurrentLocation } from '@/services/locationService';
import { registerSupplier, SupplierRegistrationData } from '@/services/supplierAuthService';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
import { SafeAreaView } from 'react-native-safe-area-context';

interface PriceInput {
  size: 6 | 13 | 19;
  price: string;
  inStock: boolean;
}

// Field errors type
interface FieldErrors {
  enterpriseName?: string;
  fullName?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  address?: string;
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

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  // Prices for each cylinder size
  const [prices, setPrices] = useState<PriceInput[]>([
    { size: 6, price: '', inStock: true },
    { size: 13, price: '', inStock: true },
    { size: 19, price: '', inStock: true },
  ]);

  // Field validation
  const validateField = (field: keyof FieldErrors, value: string): string | undefined => {
    switch (field) {
      case 'enterpriseName':
        if (!value.trim()) return 'Enterprise name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'fullName':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
        return undefined;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return undefined;
      case 'phoneNumber':
        if (!value.trim()) return 'Phone number is required';
        if (!/^[\d\s\-+()]{10,}$/.test(value)) return 'Please enter a valid phone number';
        return undefined;
      case 'address':
        if (!value.trim()) return 'Shop location is required';
        return undefined;
      default:
        return undefined;
    }
  };

  const updateField = (field: keyof FieldErrors, value: string, setter: (v: string) => void) => {
    setter(value);
    setTouchedFields(prev => new Set(prev).add(field));
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const blurField = (field: keyof FieldErrors) => {
    const value = { enterpriseName, fullName, email, password, phoneNumber, address }[field];
    setTouchedFields(prev => new Set(prev).add(field));
    const error = validateField(field, value);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

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
    } catch {
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
    // Immediate haptic feedback for fast button response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
        // Success haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
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
        // Error haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        // Check for network errors
        const errorMsg = result.error || 'Something went wrong. Please try again.';
        if (errorMsg.includes('network') || errorMsg.includes('offline')) {
          Alert.alert(
            'Network Error',
            'Please check your internet connection and try again.\n\n' +
            'Tips:\n' +
            '• Turn WiFi/mobile data off and on\n' +
            '• Move to an area with better signal\n' +
            '• Restart the app'
          );
        } else {
          Alert.alert('Registration Failed', errorMsg);
        }
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to register. Please try again.';
      if (errorMsg.includes('network') || errorMsg.includes('offline')) {
        Alert.alert(
          'Network Error',
          'Please check your internet connection and try again.\n\n' +
          'Tips:\n' +
          '• Turn WiFi/mobile data off and on\n' +
          '• Move to an area with better signal\n' +
          '• Restart the app'
        );
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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
          
          <View style={[styles.inputContainer, touchedFields.has('enterpriseName') && fieldErrors.enterpriseName && styles.inputError]}>
            <FontAwesome5 name="building" size={16} color={touchedFields.has('enterpriseName') && fieldErrors.enterpriseName ? '#f44336' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enterprise/Shop Name"
              value={enterpriseName}
              onChangeText={(text) => updateField('enterpriseName', text, setEnterpriseName)}
              onBlur={() => blurField('enterpriseName')}
              placeholderTextColor="#666"
            />
            {touchedFields.has('enterpriseName') && fieldErrors.enterpriseName && (
              <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />
            )}
          </View>
          {touchedFields.has('enterpriseName') && fieldErrors.enterpriseName && (
            <Text style={styles.fieldErrorText}>{fieldErrors.enterpriseName}</Text>
          )}

          <View style={[styles.inputContainer, touchedFields.has('fullName') && fieldErrors.fullName && styles.inputError]}>
            <FontAwesome5 name="user" size={16} color={touchedFields.has('fullName') && fieldErrors.fullName ? '#f44336' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Your Full Name"
              value={fullName}
              onChangeText={(text) => updateField('fullName', text, setFullName)}
              onBlur={() => blurField('fullName')}
              placeholderTextColor="#666"
            />
            {touchedFields.has('fullName') && fieldErrors.fullName && (
              <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />
            )}
          </View>
          {touchedFields.has('fullName') && fieldErrors.fullName && (
            <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          <View style={[styles.inputContainer, touchedFields.has('email') && fieldErrors.email && styles.inputError]}>
            <FontAwesome5 name="envelope" size={16} color={touchedFields.has('email') && fieldErrors.email ? '#f44336' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={(text) => updateField('email', text, setEmail)}
              onBlur={() => blurField('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#666"
            />
            {touchedFields.has('email') && fieldErrors.email && (
              <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />
            )}
          </View>
          {touchedFields.has('email') && fieldErrors.email && (
            <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
          )}

          <View style={[styles.inputContainer, touchedFields.has('password') && fieldErrors.password && styles.inputError]}>
            <FontAwesome5 name="lock" size={16} color={touchedFields.has('password') && fieldErrors.password ? '#f44336' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              value={password}
              onChangeText={(text) => updateField('password', text, setPassword)}
              onBlur={() => blurField('password')}
              secureTextEntry
              placeholderTextColor="#666"
            />
            {touchedFields.has('password') && fieldErrors.password && (
              <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />
            )}
          </View>
          {touchedFields.has('password') && fieldErrors.password && (
            <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
          )}

          <View style={[styles.inputContainer, touchedFields.has('phoneNumber') && fieldErrors.phoneNumber && styles.inputError]}>
            <FontAwesome5 name="phone" size={16} color={touchedFields.has('phoneNumber') && fieldErrors.phoneNumber ? '#f44336' : '#666'} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={(text) => updateField('phoneNumber', text, setPhoneNumber)}
              onBlur={() => blurField('phoneNumber')}
              keyboardType="phone-pad"
              placeholderTextColor="#666"
            />
            {touchedFields.has('phoneNumber') && fieldErrors.phoneNumber && (
              <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />
            )}
          </View>
          {touchedFields.has('phoneNumber') && fieldErrors.phoneNumber && (
            <Text style={styles.fieldErrorText}>{fieldErrors.phoneNumber}</Text>
          )}
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
          <Text style={styles.sectionTitle}>Gas Cylinder Refilling Prices</Text>
          <Text style={styles.sectionSubtitle}>Set your Refilling prices and stock availability</Text>
          
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
                placeholder="Refilling Price (Ksh)"
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

        {/* Login Link for Existing Users */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already registered? </Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/supplier/login', params: { role: 'supplier' } })}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 12,
  },
  loginText: {
    fontSize: 18,
    color: '#666',
  },
  loginLink: {
    fontSize: 18,
    color: '#1976D2',
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#f44336',
    borderWidth: 1.5,
  },
  fieldErrorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 40,
    marginBottom: 8,
  },
});

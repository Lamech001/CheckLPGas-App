import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { logOut } from '@/services/authService';
import {
    getSupplierData,
    subscribeToSupplierData,
    toggleShopStatus,
    updateSupplierPrices,
} from '@/services/supplierAuthService';
import type { SupplierData } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface PriceData {
  size: 6 | 13 | 19;
  price: number;
  inStock: boolean;
}

export default function SupplierDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierData, setSupplierData] = useState<SupplierData | null>(null);
  const [editedPrices, setEditedPrices] = useState<PriceData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      Alert.alert('Not Logged In', 'Please log in to access your dashboard.');
      router.replace('/role-select');
      return;
    }

    loadSupplierData();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToSupplierData(
      auth.currentUser.uid,
      (data) => {
        if (data) {
          setSupplierData(data);
          setIsOpen(data.isOpen ?? true);
          
          // Update prices in real-time
          if (data.prices) {
            const newPrices: PriceData[] = [];
            data.prices.forEach((p: any) => {
              newPrices.push({
                size: p.size,
                price: p.price || 0,
                inStock: p.inStock ?? true,
              });
            });
            setEditedPrices(newPrices);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.error('Subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const loadSupplierData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await getSupplierData(user.uid);

      if (result.success && result.data) {
        const data = result.data as SupplierData;
        setSupplierData(data);
        setEditedPrices(data.prices || []);
        setIsOpen(data.isOpen || false);
        setPhoneNumber(data.phoneNumber || '');
      } else {
        Alert.alert('Error', 'Failed to load your supplier data.');
      }
    } catch (error) {
      console.error('Error loading supplier data:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrices = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const result = await updateSupplierPrices(user.uid, editedPrices);

      if (result.success) {
        Alert.alert('Success', 'Your prices have been updated!');
        loadSupplierData(); // Refresh data
      } else {
        Alert.alert('Error', result.error || 'Failed to update prices.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;

    const newStatus = !isOpen;
    setIsOpen(newStatus); // Optimistic update

    try {
      const result = await toggleShopStatus(user.uid, newStatus);

      if (result.success) {
        Alert.alert(
          'Status Updated',
          `Your shop is now ${newStatus ? 'OPEN' : 'CLOSED'}. Customers will ${
            newStatus ? 'see' : 'not see'
          } your listing.`
        );
      } else {
        setIsOpen(!newStatus); // Revert on failure
        Alert.alert('Error', result.error || 'Failed to update status.');
      }
    } catch (error) {
      setIsOpen(!newStatus); // Revert on failure
      Alert.alert('Error', 'Something went wrong.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logOut();
            if (result.success) {
              router.replace('/role-select');
            } else {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const updatePriceValue = (size: number, field: 'price' | 'inStock', value: number | boolean) => {
    setEditedPrices(prev =>
      prev.map(p =>
        p.size === size ? { ...p, [field]: value } : p
      )
    );
  };

  const getPriceForSize = (size: number): PriceData | undefined => {
    return editedPrices.find(p => p.size === size);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  if (!supplierData) {
    return (
      <View style={styles.loadingContainer}>
        <FontAwesome5 name="exclamation-circle" size={48} color="#f44336" />
        <Text style={styles.errorText}>Failed to load supplier data</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSupplierData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppStatusBar backgroundColor="#2E7D32" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{supplierData.enterpriseName}</Text>
          <Text style={styles.headerSubtitle}>Supplier Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <FontAwesome5 name="sign-out-alt" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Shop Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Shop Status</Text>
              <Text style={[styles.statusValue, isOpen ? styles.openText : styles.closedText]}>
                {isOpen ? '🟢 OPEN' : '🔴 CLOSED'}
              </Text>
            </View>
            <Switch
              value={isOpen}
              onValueChange={handleToggleStatus}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isOpen ? '#4CAF50' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.statusHint}>
            {isOpen
              ? 'Customers can see your listing and contact you'
              : 'Your listing is hidden from customers'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>

          <View style={styles.infoRow}>
            <FontAwesome5 name="user" size={16} color="#666" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Owner</Text>
              <Text style={styles.infoValue}>{supplierData.fullName}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <FontAwesome5 name="envelope" size={16} color="#666" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{supplierData.email}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <FontAwesome5 name="map-marker-alt" size={16} color="#666" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{supplierData.location.address}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <FontAwesome5 name="clock" size={16} color="#666" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Hours</Text>
              <Text style={styles.infoValue}>
                {supplierData.openingHours?.open} - {supplierData.openingHours?.close}
              </Text>
            </View>
          </View>
        </View>

        {/* Prices Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gas Cylinder Prices</Text>
          <Text style={styles.sectionSubtitle}>
            Update your prices and stock status
          </Text>

          {/* Helper to get flame icon based on cylinder size */}
          {(() => {
            const getIconForSize = (s: number) => {
              switch (s) {
                case 6: return 'fire';
                case 13: return 'burn';
                case 19: return 'fire-alt';
                default: return 'fire';
              }
            };
            return null;
          })()}

          {[6, 13, 19].map((size) => {
            const priceData = getPriceForSize(size);
            const currentPrice = priceData?.price || 0;
            const inStock = priceData?.inStock ?? true;
            
            const getIconForSize = (s: number) => {
              switch (s) {
                case 6: return 'fire';
                case 13: return 'burn';
                case 19: return 'fire-alt';
                default: return 'fire';
              }
            };

            return (
              <View key={size} style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <View style={styles.sizeBadge}>
                    <FontAwesome5 name={getIconForSize(size)} size={16} color="#FF6B35" />
                    <Text style={styles.sizeText}>{size}kg Cylinder</Text>
                  </View>
                  <View style={styles.stockToggle}>
                    <Text style={styles.stockLabel}>In Stock</Text>
                    <Switch
                      value={inStock}
                      onValueChange={(value) => updatePriceValue(size, 'inStock', value)}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={inStock ? '#4CAF50' : '#f4f3f4'}
                    />
                  </View>
                </View>

                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>Price (Ksh)</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={currentPrice > 0 ? currentPrice.toString() : ''}
                    onChangeText={(value) =>
                      updatePriceValue(size, 'price', parseFloat(value) || 0)
                    }
                    keyboardType="numeric"
                    placeholder="Enter price"
                    editable={inStock}
                  />
                </View>

                {!inStock && (
                  <View style={styles.outOfStockBanner}>
                    <Text style={styles.outOfStockText}>Currently Out of Stock</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleUpdatePrices}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome5 name="save" size={18} color="#fff" style={styles.saveIcon} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            💡 Tip: Keep your prices updated to attract more customers.{'\n'}
            Changes are visible to customers immediately after saving.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  openText: {
    color: '#4CAF50',
  },
  closedText: {
    color: '#f44336',
  },
  statusHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    fontStyle: 'italic',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  priceCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  stockToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockLabel: {
    fontSize: 13,
    color: '#666',
  },
  priceInputContainer: {
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  priceInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  outOfStockBanner: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  outOfStockText: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
  bottomPadding: {
    height: 32,
  },
});

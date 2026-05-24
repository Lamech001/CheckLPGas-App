import { AppStatusBar } from '@/components/AppStatusBar';
import { NotificationsModal } from '@/components/NotificationsModal';
import { SettingsModal } from '@/components/SettingsModal';
import { RatingBreakdown, StarRating } from '@/components/StarRating';
import { auth } from '@/config/firebase';
import { subscribeToSupplierConversations } from '@/services/chatService';
import {
    getSupplierData,
    toggleShopStatus,
    updateSupplierPrices,
} from '@/services/supplierAuthService';
import type { SupplierData } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PriceData {
  size: 6 | 13 | 19;
  price: number;
  inStock: boolean;
}

export default function SupplierDashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierData, setSupplierData] = useState<SupplierData | null>(null);
  const [editedPrices, setEditedPrices] = useState<PriceData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Notifications & Settings
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Orders count
  const [orderCount, setOrderCount] = useState(0);
  const [showRatingsModal, setShowRatingsModal] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    let isActive = true;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isActive) return;
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        router.replace('/role-select');
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let isActive = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await getSupplierData(user.uid);
        
        if (!isActive) return;
        
        if (result.success && result.data) {
          const data = result.data;
          setSupplierData(data);
          setIsOpen(data.isOpen ?? true);
          setPhoneNumber(data.phoneNumber || '');

          // Update prices
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
        } else {
          console.warn('[Dashboard] No supplier data found for:', user.uid);
        }
      } catch (error) {
        if (isActive) {
          console.error('[Dashboard] Error fetching data:', error);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, [user]);

  // Subscribe to orders count
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToSupplierConversations(user.uid, (conversations) => {
      setOrderCount(conversations.length);
    });

    return () => unsubscribe();
  }, [user]);

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

  const handleOpenNotifications = useCallback(() => {
    setNotificationsVisible(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsVisible(true);
  }, []);

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

  // Prevent rendering if not authenticated
  if (authLoading || !user) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <AppStatusBar backgroundColor="#FF6B35" barStyle="light-content" />
        <ActivityIndicator size="large" color="#1976D2" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </SafeAreaView>
    );
  }

  // Create test supplier data for debugging
  const createTestData = async () => {
    if (!user) return;
    try {
      const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/config/firebase');
      
      await setDoc(doc(db, 'suppliers', user.uid), {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || 'Test Supplier',
        phoneNumber: '0712345678',
        enterpriseName: 'My Gas Shop',
        location: {
          latitude: -1.2921,
          longitude: 36.8219,
          address: 'Nairobi, Kenya',
        },
        prices: [
          { size: 6, price: 1200, inStock: true },
          { size: 13, price: 2500, inStock: true },
          { size: 19, price: 3800, inStock: true },
        ],
        isOpen: true,
        openingHours: {
          open: '08:00',
          close: '20:00',
        },
        role: 'supplier',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Test data created! Pull down to refresh.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create test data');
    }
  };

  if (!supplierData) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <FontAwesome5 name="store" size={48} color="#666" />
        <Text style={styles.errorText}>Setting up your dashboard...</Text>
        <Text style={styles.errorSubtext}>
          If this persists, please restart the app.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSupplierData}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.retryButton, { marginTop: 12, backgroundColor: '#FF6B35' }]} onPress={createTestData}>
          <Text style={styles.retryButtonText}>Create Test Data</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar backgroundColor="#FF6B35" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{supplierData.enterpriseName}</Text>
          <Text style={styles.headerSubtitle}>Supplier Dashboard</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Notifications Icon */}
          <TouchableOpacity
            onPress={handleOpenNotifications}
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.iconContainer}>
              <FontAwesome5 name="bell" size={20} color="#FF6B35" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Settings Icon */}
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.iconButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={styles.iconContainer}>
              <FontAwesome5 name="cog" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Notifications Modal */}
      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />
      
      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        supplierData={supplierData ? {
          enterpriseName: supplierData.enterpriseName,
          email: supplierData.email,
          phoneNumber: supplierData.phoneNumber,
          isOpen: supplierData.isOpen ?? true,
        } : null}
        onToggleShopStatus={handleToggleStatus}
      />

      {/* Ratings Detail Modal */}
      <Modal visible={showRatingsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rating Details</Text>
              <TouchableOpacity onPress={() => setShowRatingsModal(false)}>
                <FontAwesome5 name="times" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalRatingHeader}>
                <Text style={styles.modalBigRating}>{(supplierData.rating || 0).toFixed(1)}</Text>
                <StarRating rating={supplierData.rating || 0} size={28} showValue={false} />
                <Text style={styles.modalTotalReviews}>{supplierData.totalRatings || 0} reviews</Text>
              </View>
              <RatingBreakdown
                distribution={supplierData.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }}
                total={supplierData.totalRatings || 0}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Two Side-by-Side Cards */}
        <View style={styles.statsRow}>
          {/* Ratings Card - Compact */}
          <TouchableOpacity style={styles.compactCard} onPress={() => setShowRatingsModal(true)}>
            <View style={styles.compactCardIcon}>
              <FontAwesome5 name="star" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.compactCardValue}>{(supplierData.rating || 0).toFixed(1)}</Text>
            <Text style={styles.compactCardLabel}>{supplierData.totalRatings || 0} Reviews</Text>
            <Text style={styles.compactCardHint}>Tap for details</Text>
          </TouchableOpacity>

          {/* Orders Card - Compact */}
          <TouchableOpacity style={styles.compactCard} onPress={() => router.push('/supplier/orders')}>
            <View style={[styles.compactCardIcon, { backgroundColor: '#E3F2FD' }]}>
              <FontAwesome5 name="clipboard-list" size={20} color="#1976D2" />
            </View>
            <Text style={styles.compactCardValue}>{orderCount}</Text>
            <Text style={styles.compactCardLabel}>Order{orderCount !== 1 ? '(s)' : ''}</Text>
            <Text style={styles.compactCardHint}>Tap to view all</Text>
          </TouchableOpacity>
        </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContent: {
   
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
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 4,
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
  // Stats Row - two side-by-side cards
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  compactCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  compactCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  compactCardLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  compactCardHint: {
    fontSize: 11,
    color: '#ccc',
    marginTop: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalBody: {
    padding: 20,
  },
  modalRatingHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalBigRating: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalTotalReviews: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});

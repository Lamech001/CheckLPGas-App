

import { AppStatusBar } from '@/components/AppStatusBar';

import { NotificationsPanel } from '@/components/consumer/NotificationsPanel';

import { SideMenu } from '@/components/consumer/SideMenu';

import { SupplierList } from '@/components/consumer/SupplierList';

import { SupplierMap } from '@/components/consumer/SupplierMap';

import { auth } from '@/config/firebase';

import { AppColors, AppConstants, AppShadows, AppSizes } from '@/constants/appTheme';



import { useSuppliers } from '@/hooks/useSuppliers';

import { getUserRole } from '@/services/authService';

import { cacheUserLocation, getCachedUserLocation } from '@/services/cacheService';

import { getCurrentLocation } from '@/services/locationService';

import { notificationListeners, requestNotificationPermissions, sendLocalNotification, setupNotifications } from '@/services/notificationService';

import { FontAwesome5 } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import NetInfo from '@react-native-community/netinfo';

import { useCallback, useEffect, useState } from 'react';

import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';



const DEFAULT_RADIUS_KM = AppConstants.defaultRadiusKm;



export default function ConsumerHomeScreen() {

  const router = useRouter();

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [isLocating, setIsLocating] = useState(true);

  const [userName, setUserName] = useState('');

  const [menuVisible, setMenuVisible] = useState(false);

  const [notificationsVisible, setNotificationsVisible] = useState(false);

  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [isOnline, setIsOnline] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);



  // Use new cached suppliers hook with built-in real-time updates

  const {

    suppliers,

    isLoading: suppliersLoading,

    isFetching: suppliersFetching,

    error: suppliersError,

    refresh: refreshSuppliers,

    lastUpdated,

    isStale,

  } = useSuppliers({

    latitude: userLocation?.latitude ?? null,

    longitude: userLocation?.longitude ?? null,

    radiusKm: DEFAULT_RADIUS_KM,

    enabled: !!userLocation,

  });



  useEffect(() => {

    const user = auth.currentUser;

    if (user?.displayName) {

      setUserName(user.displayName.split(' ')[0]); // First name only

    }

  }, []);



  // Setup push notifications in background - don't block UI

  useEffect(() => {

    // Defer notifications setup to prioritize UI rendering

    const timeoutId = setTimeout(() => {

      const initNotifications = async () => {

        const hasPermission = await requestNotificationPermissions();

        if (hasPermission) {

          await setupNotifications();

          

          // Send welcome notification

          await sendLocalNotification(

            'Welcome to GasAround!',

            'You will receive alerts when new suppliers are available near you.',

            { type: 'welcome' }

          );

        }

      };

      

      initNotifications();

    }, 1000); // Delay 1 second after UI renders

    

    return () => clearTimeout(timeoutId);

  }, []);



  // Listen for notifications

  useEffect(() => {

    const unsubscribe = notificationListeners(

      (_notification) => {

        // New notification received

        setUnreadNotifications((prev) => prev + 1);

      },

      (response) => {

        // User tapped notification

        const data = response.notification.request.content.data as Record<string, any>;



        if (data?.type === 'new_supplier') {

          // Could navigate to specific supplier

          Alert.alert('New Supplier!', `Check out ${data.supplierName}`);

          return;

        }



        // If supplier receives an order notification and they somehow land here,

        // deep link to orders/chat to ensure they "get the order".

        if (data?.type === 'new_order' && data?.supplierId) {

          const conversationId = data?.conversationId as string | undefined;

          if (conversationId) {

            router.replace({

              pathname: '/supplier/chat',

              params: {

                conversationId,

              },

            });

          } else {

            router.replace('/supplier/orders');

          }

        }

      }



    );

    

    return () => unsubscribe();

  }, []);



  // Quick role check in background - don't block UI

  useEffect(() => {

    // Defer role check to not block initial render

    const timeoutId = setTimeout(() => {

      const checkRoleAndRedirect = async () => {

        const user = auth.currentUser;

        if (!user) return;



        try {

          // Check global hint first for instant response

          // @ts-ignore

          const hintedRole = global.userRoleHint;

          if (hintedRole === 'supplier') {

            router.replace('/supplier/dashboard');

            return;

          }



          // Fallback to Firestore check

          const roleResult = await getUserRole(user.uid);

          if (roleResult.role === 'supplier') {

            router.replace('/supplier/dashboard');

          }

        } catch {

          // Ignore errors - stay on consumer page

        }

      };



      checkRoleAndRedirect();

    }, 200);



    return () => clearTimeout(timeoutId);

  }, [router]);





  // Load location - cached first for instant display, then fresh

  useEffect(() => {

    const loadLocation = async () => {

      // INSTANT: Try cached location first

      const cachedLocation = await getCachedUserLocation<{ latitude: number; longitude: number }>();

      if (cachedLocation) {

        setUserLocation(cachedLocation);

        setIsLocating(false); // Show UI immediately with cached location

      } else {

        setIsLocating(true);

      }



      // BACKGROUND: Get fresh location without blocking UI

      const location = await getCurrentLocation();

      if (location) {

        setUserLocation(location);

        await cacheUserLocation(location);

      }

      

      setIsLocating(false);

    };



    loadLocation();

  }, []);



  // Monitor network status for WhatsApp-like offline behavior

  useEffect(() => {

    const unsubscribe = NetInfo.addEventListener(state => {

      const isConnected = state.isConnected === true && state.isInternetReachable === true;

      setIsOnline(isConnected);

      

      // When coming back online, refresh data

      if (isConnected && userLocation) {

        setIsSyncing(true);

        refreshSuppliers().finally(() => {

          setIsSyncing(false);

        });

      }

    });



    return () => unsubscribe();

  }, [userLocation, refreshSuppliers]);



  // Real-time updates are now handled internally by useSuppliers hook

  // No need for manual subscription management



  // Auto-refresh every 10 minutes to ensure fresh data while keeping app responsive

  useEffect(() => {

    if (!userLocation) return;



    const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes - optimized for <2s response

    const intervalId = setInterval(() => {

      refreshSuppliers();

    }, REFRESH_INTERVAL);



    return () => clearInterval(intervalId);

  }, [userLocation, refreshSuppliers]);



  const handleRefresh = useCallback(() => {

    refreshSuppliers();

  }, [refreshSuppliers]);



  // Show UI immediately with cached data, refresh in background

  // Only show full loading screen on initial app load with no cache

  const showLoading = isLocating && !suppliers.length && !userLocation;

  const error = suppliersError;



  if (showLoading) {

    return (

      <View style={styles.loadingContainer}>

        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />

        <ActivityIndicator size="large" color={AppColors.primary} />

        <Text style={styles.loadingText}>Finding gas suppliers near you...</Text>

      </View>

    );

  }



  if (error) {

    return (

      <View style={styles.errorContainer}>

        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />

        <FontAwesome5 name="exclamation-circle" size={48} color={AppColors.errorLight} />

        <Text style={styles.errorText}>{error.message}</Text>

        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>

          <Text style={styles.retryButtonText}>Try Again</Text>

        </TouchableOpacity>

      </View>

    );

  }



  if (!userLocation) {

    return (

      <View style={styles.errorContainer}>

        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />

        <Text style={styles.errorText}>Location not available</Text>

        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>

          <Text style={styles.retryButtonText}>Retry</Text>

        </TouchableOpacity>

      </View>

    );

  }



  return (

    <View style={styles.container}>

      {/* Minimal header with just buttons */}

      <View style={styles.minimalHeader}>

        <View style={styles.minimalHeaderSide}>

          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>

            <FontAwesome5 name="bars" size={24} color={AppColors.primary} />

          </TouchableOpacity>

        </View>



        <View style={styles.minimalHeaderCenter}>

          <Text style={styles.brandText}>GasAround</Text>

          {!isOnline && (

            <View style={styles.offlineIndicator}>

              <FontAwesome5 name="wifi-slash" size={10} color={AppColors.errorLight} />

              <Text style={styles.offlineText}>Offline</Text>

            </View>

          )}

          {isSyncing && isOnline && (

            <View style={styles.syncIndicator}>

              <FontAwesome5 name="sync" size={10} color={AppColors.primary} />

              <Text style={styles.syncText}>Syncing...</Text>

            </View>

          )}

        </View>



        <View style={styles.minimalHeaderSide}>

          <TouchableOpacity style={styles.notificationButton} onPress={() => setNotificationsVisible(true)}>

            <FontAwesome5 name="bell" size={20} color={AppColors.primary} />

            {unreadNotifications > 0 && (

              <View style={styles.badge}>

                <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>

              </View>

            )}

          </TouchableOpacity>

        </View>

      </View>



      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Map Section */}

        <View style={styles.mapContainer}>

          <SupplierMap

            userLocation={userLocation}

            suppliers={suppliers || []}

            selectedSize="all"

            radiusKm={DEFAULT_RADIUS_KM}

          />

        </View>



        {/* Supplier List Section */}

        <View style={styles.listSection}>

          <View style={styles.listHeader}>

            <View>

              <Text style={styles.listTitle}>Nearby Suppliers</Text>

              {lastUpdated && (

                <Text style={styles.lastUpdatedText}>

                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}

                </Text>

              )}

              {isStale && (

                <Text style={styles.staleText}>Updating...</Text>

              )}

            </View>

            <TouchableOpacity 

              onPress={handleRefresh} 

              style={[styles.refreshButton, suppliersFetching && styles.refreshButtonActive]}

              disabled={suppliersFetching}

            >

              <FontAwesome5 

                name={suppliersFetching ? "spinner" : "sync-alt"} 

                size={14} 

                color={suppliersFetching ? AppColors.textTertiary : AppColors.primary} 

              />

              <Text style={[styles.refreshText, suppliersFetching && styles.refreshTextDisabled]}>

                {suppliersFetching ? 'Updating...' : 'Refresh'}

              </Text>

            </TouchableOpacity>

          </View>

          <SupplierList suppliers={suppliers || []} loading={suppliersLoading} />

        </View>

      </ScrollView>



      {/* Side Menu */}

      <SideMenu

        visible={menuVisible}

        onClose={() => setMenuVisible(false)}

        userName={userName}

      />



      {/* Notifications Panel */}

      <NotificationsPanel

        visible={notificationsVisible}

        onClose={() => setNotificationsVisible(false)}

        onUnreadCountChange={setUnreadNotifications}

      />

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: AppColors.background,

  },

  loadingContainer: {

    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: AppColors.white,

  },

  loadingText: {

    marginTop: AppSizes.spacingLarge,

    fontSize: AppSizes.fontXLarge,

    color: AppColors.textSecondary,

  },

  errorContainer: {

    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: AppColors.white,

    padding: AppSizes.spacingXXLarge,

  },

  errorText: {

    marginTop: AppSizes.spacingLarge,

    fontSize: AppSizes.fontXLarge,

    color: AppColors.textSecondary,

    textAlign: 'center',

    marginBottom: AppSizes.spacingXXLarge,

  },

  retryButton: {

    backgroundColor: AppColors.primary,

    paddingHorizontal: AppSizes.spacingXXLarge,

    paddingVertical: AppSizes.spacingMedium,

    borderRadius: AppSizes.radiusMedium,

  },

  retryButtonText: {

    color: AppColors.white,

    fontSize: AppSizes.fontXLarge,

    fontWeight: '600',

  },

  header: {

    backgroundColor: AppColors.white,

    paddingTop: 60,

    paddingHorizontal: AppSizes.spacingLarge,

    paddingBottom: AppSizes.spacingLarge,

    borderBottomWidth: 1,

    borderBottomColor: AppColors.border,

  },

  headerTop: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: AppSizes.spacingMedium,

  },

  minimalHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    paddingHorizontal: AppSizes.spacingLarge,

    paddingTop: 45,

    paddingBottom: AppSizes.spacingSmall,

    backgroundColor: AppColors.background,

  },

  minimalHeaderSide: {

    width: 48,

    alignItems: 'flex-start',

  },

  minimalHeaderCenter: {

    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

  },

  brandText: {

    fontSize: 26,

    fontWeight: '700',

    color: AppColors.primary,

  },

  offlineIndicator: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,

    marginTop: 2,

  },

  offlineText: {

    fontSize: 10,

    color: AppColors.errorLight,

    fontWeight: '600',

  },

  syncIndicator: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,

    marginTop: 2,

  },

  syncText: {

    fontSize: 10,

    color: AppColors.primary,

    fontWeight: '600',

  },

  menuButton: {

    padding: AppSizes.spacingSmall,

  },

  logo: {

    fontSize: AppSizes.fontTitle,

    fontWeight: '700',

    color: AppColors.primary,

  },

  notificationButton: {

    padding: AppSizes.spacingSmall,

    position: 'relative',

  },

  badge: {

    position: 'absolute',

    top: 0,

    right: 0,

    backgroundColor: AppColors.errorLight,

    borderRadius: 10,

    minWidth: 20,

    height: 20,

    justifyContent: 'center',

    alignItems: 'center',

    paddingHorizontal: 4,

  },

  badgeText: {

    color: AppColors.white,

    fontSize: AppSizes.fontXSmall,

    fontWeight: 'bold',

  },

  greeting: {

    fontSize: AppSizes.fontHeader,

    fontWeight: '700',

    color: AppColors.textPrimary,

    marginBottom: AppSizes.spacingXS,

  },

  subtitle: {

    fontSize: AppSizes.fontMedium,

    color: AppColors.textSecondary,

  },

  scrollView: {

    flex: 1,

  },

  mapContainer: {

    height: 220,

    margin: AppSizes.spacingLarge,

    borderRadius: AppSizes.radiusXLarge,

    overflow: 'hidden',

    ...AppShadows.medium,

  },

  listSection: {

    flex: 1,

    backgroundColor: AppColors.background,

  },

  listHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    paddingHorizontal: AppSizes.spacingLarge,

    paddingVertical: AppSizes.spacingMedium,

  },

  listTitle: {

    fontSize: 18,

    fontWeight: '700',

    color: AppColors.textPrimary,

  },

  refreshButton: {

    flexDirection: 'row',

    alignItems: 'center',

    gap: AppSizes.spacingXS,

  },

  refreshText: {

    fontSize: AppSizes.fontMedium,

    color: AppColors.primary,

    fontWeight: '500',

  },

  staleText: {

    fontSize: AppSizes.fontXSmall,

    color: AppColors.textTertiary,

    marginTop: AppSizes.spacingXS,

  },

  lastUpdatedText: {

    fontSize: AppSizes.fontXSmall,

    color: AppColors.textTertiary,

    marginTop: AppSizes.spacingXS,

  },

  refreshButtonActive: {

    opacity: 0.7,

  },

  refreshTextDisabled: {

    color: AppColors.textTertiary,

  },

});


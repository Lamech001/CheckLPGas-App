# Caching Examples - How to Use

This guide shows practical examples of using the caching system throughout your app.

## Table of Contents
1. [Basic Data Fetching](#basic-data-fetching)
2. [User Profile](#user-profile)
3. [Supplier Dashboard](#supplier-dashboard)
4. [Lists with Filtering](#lists-with-filtering)
5. [Image Caching](#image-caching)
6. [Mutations with Cache Invalidation](#mutations-with-cache-invalidation)
7. [Offline Support](#offline-support)
8. [Prefetching](#prefetching)

---

## Basic Data Fetching

### Using useQuery for Generic Data

```tsx
import { useQuery } from '@/hooks/useQuery';

function OrdersScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', userId],
    queryFn: () => fetchOrders(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <OrdersList orders={data} onRefresh={refetch} />;
}
```

### Using useSuppliers for Location-Based Data

```tsx
import { useSuppliers } from '@/hooks/useSuppliers';

function ConsumerHome() {
  const [userLocation, setUserLocation] = useState(null);
  
  const {
    suppliers,
    isLoading,
    isFetching, // Background refresh in progress
    isStale,    // Data might be outdated
    error,
    refresh,
    lastUpdated,
  } = useSuppliers({
    latitude: userLocation?.latitude ?? null,
    longitude: userLocation?.longitude ?? null,
    radiusKm: 1,
    enabled: !!userLocation,
  });

  return (
    <View>
      {isLoading && <FullScreenLoader />}
      
      {isStale && (
        <Banner>
          Data from {lastUpdated?.toLocaleTimeString()}
          <Button onPress={refresh}>Refresh</Button>
        </Banner>
      )}
      
      <SupplierList 
        suppliers={suppliers} 
        refreshing={isFetching}
        onRefresh={refresh}
      />
    </View>
  );
}
```

---

## User Profile

### Display User Profile with Instant Loading

```tsx
import { useUserProfile } from '@/hooks/useUserProfile';

function ConsumerProfile() {
  const { user } = useAuth();
  
  const {
    profile,
    isLoading,
    isStale,
    error,
    refresh,
  } = useUserProfile({
    userId: user?.uid ?? null,
    enabled: !!user,
  });

  if (isLoading) return <ProfileSkeleton />;

  return (
    <View style={styles.container}>
      {isStale && <Text>Updating profile...</Text>}
      
      <Image 
        source={{ uri: profile?.photoURL || defaultAvatar }} 
        style={styles.avatar}
      />
      
      <Text style={styles.name}>{profile?.fullName}</Text>
      <Text style={styles.email}>{profile?.email}</Text>
      <Text style={styles.phone}>{profile?.phoneNumber}</Text>
      <Text style={styles.location}>{profile?.location}</Text>
      
      <Button onPress={refresh} title="Refresh Profile" />
    </View>
  );
}
```

### Update User Profile

```tsx
import { useUpdateUserProfile } from '@/hooks/useUserProfile';

function EditProfile() {
  const { updateProfile, isLoading } = useUpdateUserProfile();
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    const success = await updateProfile(userId, {
      phoneNumber: phone,
    });

    if (success) {
      Alert.alert('Success', 'Profile updated!');
    } else {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  return (
    <View>
      <TextInput value={phone} onChangeText={setPhone} />
      <Button 
        onPress={handleSave} 
        title="Save"
        disabled={isLoading}
      />
    </View>
  );
}
```

---

## Supplier Dashboard

### Supplier Dashboard with Real-time Updates

```tsx
import { 
  useSupplierDashboard, 
  useUpdateSupplier,
  useSupplierStats 
} from '@/hooks/useSupplierDashboard';

function SupplierDashboard() {
  const { user } = useAuth();
  
  const {
    supplier,
    isLoading,
    isStale,
    error,
    refresh,
  } = useSupplierDashboard({
    supplierId: user?.uid ?? null,
    enabled: !!user,
  });

  const {
    updatePrices,
    updateStatus,
    isLoading: isUpdating,
  } = useUpdateSupplier(user?.uid ?? null);

  const stats = useSupplierStats(user?.uid ?? null);

  const handleToggleStatus = async () => {
    const success = await updateStatus(!supplier?.isOpen);
    if (success) {
      // Cache automatically updated via onSnapshot
      Alert.alert('Status updated!');
    }
  };

  const handleUpdatePrices = async (newPrices) => {
    const success = await updatePrices(newPrices);
    if (success) {
      Alert.alert('Prices updated!');
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <ScrollView>
      {isStale && <Banner>Updating data...</Banner>}
      
      <Card>
        <Text>Shop Status</Text>
        <Switch 
          value={supplier?.isOpen} 
          onValueChange={handleToggleStatus}
          disabled={isUpdating}
        />
        <Text>{supplier?.isOpen ? 'Open' : 'Closed'}</Text>
      </Card>

      <Card>
        <Text>Prices</Text>
        {supplier?.prices.map(price => (
          <PriceInput 
            key={price.size} 
            price={price}
            onUpdate={handleUpdatePrices}
          />
        ))}
      </Card>

      <Card>
        <Text>Stats</Text>
        <Stat label="Views" value={stats.totalViews} />
        <Stat label="Orders" value={stats.totalOrders} />
        <Stat label="Rating" value={stats.rating} />
      </Card>

      <Button onPress={refresh} title="Refresh Data" />
    </ScrollView>
  );
}
```

---

## Lists with Filtering

### Filtered Supplier List

```tsx
import { useFilteredSuppliers } from '@/hooks/useSuppliers';

function SupplierDirectory() {
  const [selectedSize, setSelectedSize] = useState<CylinderSize | 'all'>('all');
  const [userLocation, setUserLocation] = useState(null);

  const {
    suppliers,          // All suppliers
    filteredSuppliers,  // Filtered by size
    totalCount,
    filteredCount,
    isLoading,
    isFetching,
    refresh,
  } = useFilteredSuppliers({
    latitude: userLocation?.latitude ?? null,
    longitude: userLocation?.longitude ?? null,
    radiusKm: 1,
    filterSize: selectedSize,
    enabled: !!userLocation,
  });

  return (
    <View>
      <FilterBar 
        selectedSize={selectedSize}
        onSizeChange={setSelectedSize}
        count={filteredCount}
        total={totalCount}
      />
      
      <SupplierList
        suppliers={filteredSuppliers}
        refreshing={isFetching}
        onRefresh={refresh}
      />
    </View>
  );
}
```

---

## Image Caching

### Basic Image Caching

```tsx
import { cacheImage, useCachedImage } from '@/services/imageCache';

// In a component
function SupplierCard({ supplier }) {
  // Automatic caching with hook
  const { uri, isLoading } = useCachedImage(supplier.logoUrl);

  return (
    <View>
      {isLoading ? (
        <Placeholder />
      ) : (
        <Image source={{ uri }} style={styles.logo} />
      )}
    </View>
  );
}
```

### Batch Image Prefetching

```tsx
import { prefetchImages, batchCacheImages } from '@/services/imageCache';

// Prefetch in background
function SupplierList({ suppliers }) {
  useEffect(() => {
    // Extract all image URLs
    const imageUrls = suppliers
      .map(s => s.logoUrl)
      .filter(Boolean);

    // Prefetch all images
    prefetchImages(imageUrls);
  }, [suppliers]);

  return (
    <FlatList
      data={suppliers}
      renderItem={({ item }) => <SupplierCard supplier={item} />}
    />
  );
}

// With progress tracking
function ImageGallery({ imageUrls }) {
  const [progress, setProgress] = useState(0);

  const cacheAllImages = async () => {
    await batchCacheImages(imageUrls, (completed, total) => {
      setProgress(completed / total);
    });
  };

  return (
    <View>
      <ProgressBar progress={progress} />
      <Button onPress={cacheAllImages} title="Cache Images" />
    </View>
  );
}
```

---

## Mutations with Cache Invalidation

### Using useMutation

```tsx
import { useMutation } from '@/hooks/useQuery';

function CreateOrder() {
  const { mutate, isLoading } = useMutation({
    mutationFn: (orderData) => createOrder(orderData),
    onSuccess: (data) => {
      Alert.alert('Order created!', `Order #${data.id}`);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
    // Automatically invalidate related queries
    invalidateQueries: ['orders', 'supplier:stats'],
  });

  const handleSubmit = async (orderData) => {
    await mutate(orderData);
  };

  return (
    <OrderForm 
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  );
}
```

### Manual Cache Invalidation

```tsx
import { useCacheOperations } from '@/contexts/CacheContext';
import { removeCache } from '@/services/enhancedCache';

function SupplierEdit() {
  const { invalidateCache } = useCacheOperations();

  const handleUpdate = async (data) => {
    // Update in Firestore
    await updateSupplier(supplierId, data);

    // Option 1: Invalidate specific cache
    await removeCache(`suppliers:detail:${supplierId}`);

    // Option 2: Invalidate by pattern
    await invalidateCache('suppliers');

    // Option 3: Clear all cache
    await invalidateCache();
  };
}
```

---

## Offline Support

### Handling Offline States

```tsx
import { useSuppliers } from '@/hooks/useSuppliers';
import NetInfo from '@react-native-community/netinfo';

function ConsumerHome() {
  const [isOffline, setIsOffline] = useState(false);
  
  const {
    suppliers,
    isLoading,
    isStale,
    error,
  } = useSuppliers({
    latitude,
    longitude,
    radiusKm: 1,
    enabled: true,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);

  return (
    <View>
      {isOffline && (
        <Banner type="warning">
          You're offline. Showing cached data.
        </Banner>
      )}
      
      {isStale && !isOffline && (
        <Banner type="info">
          Data may be outdated. Pull to refresh.
        </Banner>
      )}

      <SupplierList suppliers={suppliers} />
    </View>
  );
}
```

### Cache-First Strategy

```tsx
import { getCachedSuppliers } from '@/services/cachedSupplierService';

async function loadSuppliersWithFallback(lat, lng, radius) {
  try {
    // Try to get fresh data
    const suppliers = await getSuppliersWithinRadius(lat, lng, radius);
    return { suppliers, fromCache: false };
  } catch (error) {
    // Fallback to cache
    const cached = await getCachedSuppliers(lat, lng, radius);
    if (cached) {
      return { suppliers: cached, fromCache: true };
    }
    throw error;
  }
}
```

---

## Prefetching

### Prefetch on User Action

```tsx
import { useCacheOperations } from '@/contexts/CacheContext';

function MapScreen() {
  const { prefetchSuppliers } = useCacheOperations();

  const handleMapTap = async (coordinate) => {
    // Immediately show loading
    setLoading(true);

    // Prefetch suppliers at new location
    await prefetchSuppliers([{
      lat: coordinate.latitude,
      lng: coordinate.longitude,
      radiusKm: 1,
    }]);

    // Navigate to results (data already cached)
    setUserLocation(coordinate);
    setLoading(false);
  };

  return (
    <MapView onPress={handleMapTap}>
      {/* Map markers */}
    </MapView>
  );
}
```

### Prefetch on App Start

```tsx
// App initialization
import { warmSupplierCache } from '@/services/cachedSupplierService';

async function initializeApp() {
  // Warm cache with default locations
  await warmSupplierCache([
    { lat: -1.2921, lng: 36.8219, radiusKm: 2 }, // Nairobi CBD
    { lat: -1.2840, lng: 36.8254, radiusKm: 2 }, // Westlands
  ]);

  // Prefetch common images
  await prefetchImages([
    '/assets/logo.png',
    '/assets/default-avatar.png',
  ]);
}
```

### Prefetch on Navigation

```tsx
import { usePrefetchSuppliers } from '@/hooks/useSuppliers';

function SupplierListScreen() {
  const prefetch = usePrefetchSuppliers();

  const handleHover = (supplier) => {
    // Prefetch on hover/press-in
    prefetch([{
      lat: supplier.location.latitude,
      lng: supplier.location.longitude,
    }]);
  };

  return (
    <FlatList
      data={suppliers}
      renderItem={({ item }) => (
        <TouchableOpacity 
          onPressIn={() => handleHover(item)}
          onPress={() => navigateToDetail(item)}
        >
          <SupplierCard supplier={item} />
        </TouchableOpacity>
      )}
    />
  );
}
```

---

## Best Practices Summary

1. **Always check `isStale`** - Show indicators when data might be outdated
2. **Handle `isFetching`** - Show subtle refresh indicators, not full loaders
3. **Use cache as fallback** - If fetch fails but cache exists, show cached data
4. **Invalidate after mutations** - Clear related cache when data changes
5. **Prefetch strategically** - On user actions that predict next screen
6. **Use proper TTLs** - Short for frequently changing data, long for static
7. **Monitor cache size** - Use `useCacheStatus()` to track and clean if needed

---

## Migration Checklist

- [ ] Replace `fetch` with `useQuery` or specific hooks
- [ ] Add `isStale` indicators to data displays
- [ ] Implement pull-to-refresh using `refresh()` function
- [ ] Add offline banners where appropriate
- [ ] Prefetch data on navigation hovers
- [ ] Invalidate cache after mutations
- [ ] Test offline behavior
- [ ] Monitor cache size in production

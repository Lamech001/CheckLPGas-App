import { AppColors, AppSizes } from '@/constants/appTheme';
import { CylinderSize, formatDistance, formatPrice, getPriceForSize, SupplierWithDistance } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SupplierCardProps {
  supplier: SupplierWithDistance;
  selectedSize: CylinderSize | 'all';
}

export const SupplierCard: React.FC<SupplierCardProps> = ({ supplier, selectedSize }) => {
  const handleCall = () => {
    Linking.openURL(`tel:${supplier.phoneNumber}`);
  };

  const getDisplayPrice = () => {
    if (selectedSize !== 'all') {
      const price = getPriceForSize(supplier.prices, selectedSize);
      return price !== null ? formatPrice(price) : 'Out of stock';
    }
    
    // Show all available prices
    const inStockPrices = supplier.prices.filter(p => p.inStock);
    if (inStockPrices.length === 0) return 'Out of stock';
    
    const minPrice = Math.min(...inStockPrices.map(p => p.price));
    return `From ${formatPrice(minPrice)}`;
  };

  const getStockInfo = () => {
    if (selectedSize !== 'all') {
      const price = supplier.prices.find(p => p.size === selectedSize);
      return price?.inStock ? `${selectedSize}kg Cylinder` : `${selectedSize}kg - Out of stock`;
    }
    
    const available = supplier.prices.filter(p => p.inStock).map(p => `${p.size}kg`).join(', ');
    return available || 'No stock available';
  };

  return (
    <View style={styles.card}>
      <View style={styles.leftContent}>
        <View style={styles.iconContainer}>
          <FontAwesome5 name="store" size={24} color="#FF6B35" />
        </View>
        <View style={styles.info}>
          <Text style={styles.enterpriseName} numberOfLines={1}>
            {supplier.enterpriseName}
          </Text>
          <Text style={styles.stockInfo}>{getStockInfo()}</Text>
          <View style={styles.distanceRow}>
            <FontAwesome5 name="location-arrow" size={12} color="#4CAF50" />
            <Text style={styles.distance}>{formatDistance(supplier.distance)}</Text>
            <View style={styles.dot} />
            <Text style={[styles.status, { color: supplier.isOpen ? '#4CAF50' : '#f44336' }]}>
              {supplier.isOpen ? 'Open Now' : 'Closed'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.rightContent}>
        <Text style={styles.price}>{getDisplayPrice()}</Text>
        <TouchableOpacity style={styles.callButton} onPress={handleCall}>
          <FontAwesome5 name="phone" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  enterpriseName: {
    fontSize: AppSizes.fontXLarge,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: AppSizes.spacingXS,
  },
  stockInfo: {
    fontSize: AppSizes.fontSmall,
    color: AppColors.textSecondary,
    marginBottom: AppSizes.spacingXS,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distance: {
    fontSize: AppSizes.fontXSmall,
    color: AppColors.success,
    marginLeft: AppSizes.spacingXS,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.border,
    marginHorizontal: 6,
  },
  status: {
    fontSize: AppSizes.fontXSmall,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: AppSizes.fontXLarge,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: AppSizes.spacingSmall,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

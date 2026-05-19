import { AppColors, AppSizes } from '@/constants/appTheme';
import { formatDistance, formatPrice, GasPrice, SupplierWithDistance } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SupplierRatingBadge } from '../RateSupplierModal';

interface SupplierDetailModalProps {
  supplier: SupplierWithDistance | null;
  visible: boolean;
  onClose: () => void;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  visible,
  onClose,
}) => {
  const router = useRouter();

  if (!supplier) return null;

  const handleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${supplier.phoneNumber}`);
  };

  const handleChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.push({
      pathname: '/consumer/order',
      params: { supplier: JSON.stringify(supplier) },
    });
  };

  const handleRate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Rate functionality - could open rate modal
  };

  const renderPriceRow = (price: GasPrice) => (
    <View key={price.size} style={styles.priceRow}>
      <View style={styles.priceLeft}>
        <FontAwesome5
          name="fire"
          size={16}
          color={price.inStock ? AppColors.primary : AppColors.textSecondary}
        />
        <Text style={[styles.cylinderSize, !price.inStock && styles.outOfStockText]}>
          {price.size}kg Cylinder
        </Text>
        {price.inStock && (
          <View style={styles.stockBadge}>
            <Text style={styles.stockText}>In Stock</Text>
          </View>
        )}
      </View>
      <Text style={[styles.cylinderPrice, !price.inStock && styles.outOfStockText]}>
        {price.inStock ? formatPrice(price.price) : 'Out of Stock'}
      </Text>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={24} color={AppColors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Supplier Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            {/* Supplier Info Card */}
            <View style={styles.supplierCard}>
              <View style={styles.iconContainer}>
                <FontAwesome5 name="store" size={32} color="#FF6B35" />
              </View>
              
              <Text style={styles.enterpriseName}>{supplier.enterpriseName}</Text>
              
              <SupplierRatingBadge
                rating={supplier.rating || 0}
                totalRatings={supplier.totalRatings || 0}
                size="large"
                onPress={handleRate}
              />

              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: supplier.isOpen ? '#4CAF50' : '#f44336' }]}>
                  <Text style={styles.statusText}>
                    {supplier.isOpen ? 'Open Now' : 'Closed'}
                  </Text>
                </View>
                <View style={styles.distanceBadge}>
                  <FontAwesome5 name="location-arrow" size={12} color={AppColors.primary} />
                  <Text style={styles.distanceText}>{formatDistance(supplier.distance)}</Text>
                </View>
              </View>
            </View>

            {/* Contact Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact</Text>
              <View style={styles.contactCard}>
                <FontAwesome5 name="phone" size={16} color={AppColors.primary} />
                <Text style={styles.contactText}>{supplier.phoneNumber}</Text>
              </View>
            </View>

            {/* Location Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.locationCard}>
                <FontAwesome5 name="map-marker-alt" size={16} color={AppColors.primary} />
                <Text style={styles.locationText}>
                  {supplier.location?.address || 'Address not available'}
                </Text>
              </View>
            </View>

            {/* Gas Prices Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gas Cylinder Prices</Text>
              <View style={styles.pricesCard}>
                {supplier.prices?.length > 0 ? (
                  supplier.prices.map(renderPriceRow)
                ) : (
                  <Text style={styles.noDataText}>No pricing information available</Text>
                )}
              </View>
            </View>

            {/* Business Hours Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Business Hours</Text>
              <View style={styles.hoursCard}>
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursLabel}>Status:</Text>
                  <Text style={[styles.hoursValue, { color: supplier.isOpen ? '#4CAF50' : '#f44336' }]}>
                    {supplier.isOpen ? 'Currently Open' : 'Currently Closed'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
                <FontAwesome5 name="shopping-bag" size={20} color="#fff" />
                <Text style={styles.chatButtonText}>Place Order</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                <FontAwesome5 name="phone" size={20} color="#fff" />
                <Text style={styles.callButtonText}>Call Supplier</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  closeButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: AppSizes.fontLarge,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  content: {
    flex: 1,
  },
  supplierCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  enterpriseName: {
    fontSize: AppSizes.fontXLarge,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: AppSizes.fontSmall,
    fontWeight: '600',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  distanceText: {
    color: AppColors.primary,
    fontSize: AppSizes.fontSmall,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  contactCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textPrimary,
  },
  locationCard: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  locationText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  pricesCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cylinderSize: {
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  cylinderPrice: {
    fontSize: AppSizes.fontLarge,
    fontWeight: '700',
    color: AppColors.primary,
  },
  outOfStockText: {
    color: AppColors.textSecondary,
    textDecorationLine: 'line-through',
  },
  stockBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '600',
  },
  hoursCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursLabel: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textSecondary,
  },
  hoursValue: {
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
  },
  noDataText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1976D2',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AppColors.success,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: AppColors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  callButtonText: {
    color: '#fff',
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
  },
});

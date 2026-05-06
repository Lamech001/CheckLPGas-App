import { AppColors, AppSizes } from '@/constants/appTheme';
import { filterByCylinderSize } from '@/services/supplierService';
import { CylinderSize, SupplierWithDistance } from '@/services/types/supplier';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FilterBar } from './FilterBar';
import { SupplierCard } from './SupplierCard';

interface SupplierListProps {
  suppliers: SupplierWithDistance[];
}

export const SupplierList: React.FC<SupplierListProps> = ({ suppliers }) => {
  const [selectedSize, setSelectedSize] = useState<CylinderSize | 'all'>('all');

  const filteredSuppliers = filterByCylinderSize(suppliers, selectedSize);

  return (
    <View style={styles.container}>
      <FilterBar selectedSize={selectedSize} onSelectSize={setSelectedSize} />
      
      {filteredSuppliers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No suppliers found with {selectedSize === 'all' ? 'any' : selectedSize + 'kg'} cylinders in your area.
            Tell them to join GasAround!
          </Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {filteredSuppliers.map((item) => (
            <SupplierCard key={item.uid} supplier={item} selectedSize={selectedSize} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  listContent: {
    paddingVertical: AppSizes.spacingSmall,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppSizes.spacingXXLarge,
  },
  emptyText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

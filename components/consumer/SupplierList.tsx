import { AppColors, AppSizes } from "@/constants/appTheme";
import { filterByCylinderSize } from "@/services/supplierService";
import { CylinderSize, SupplierWithDistance } from "@/services/types/supplier";
import { FlashList } from "@shopify/flash-list";
import { memo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FilterBar } from "./FilterBar";
import { SupplierCard } from "./SupplierCard";

interface SupplierListProps {
  suppliers: SupplierWithDistance[];
  loading?: boolean;
}

export const SupplierList: React.FC<SupplierListProps> = memo(
  function SupplierList({ suppliers, loading = false }) {
    const [selectedSize, setSelectedSize] = useState<CylinderSize | "all">(
      "all",
    );

    // Show all suppliers (including closed ones) to ensure recently ordered suppliers stay visible.
    // The isOpen filter was causing suppliers to disappear after receiving orders.
    const filteredSuppliers = filterByCylinderSize(suppliers, selectedSize);

    return (
      <View style={styles.container}>
        <FilterBar selectedSize={selectedSize} onSelectSize={setSelectedSize} />

        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={styles.loadingText}>Loading suppliers...</Text>
          </View>
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No suppliers found with{" "}
              {selectedSize === "all" ? "any" : selectedSize + "kg"} cylinders
              in your area. Ask them to join GasAround!
            </Text>
          </View>
        ) : (
          <FlashList
            data={filteredSuppliers}
            renderItem={({ item }: { item: SupplierWithDistance }) => (
              <SupplierCard supplier={item} selectedSize={selectedSize} />
            )}
            keyExtractor={(item: SupplierWithDistance) => item.uid}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  listContent: {
    paddingVertical: AppSizes.spacingSmall,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: AppSizes.spacingXXLarge,
  },
  loadingText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textSecondary,
    textAlign: "center",
    marginTop: AppSizes.spacingMedium,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: AppSizes.spacingXXLarge,
  },
  emptyText: {
    fontSize: AppSizes.fontMedium,
    color: AppColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});

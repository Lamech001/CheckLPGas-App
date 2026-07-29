import { CYLINDER_SIZES, CylinderSize } from "@/services/types/supplier";
import { memo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FilterBarProps {
  selectedSize: CylinderSize | "all";
  onSelectSize: (size: CylinderSize | "all") => void;
}

export const FilterBar: React.FC<FilterBarProps> = memo(function FilterBar({
  selectedSize,
  onSelectSize,
}) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CYLINDER_SIZES.map((size) => (
          <TouchableOpacity
            key={size.value}
            style={[
              styles.button,
              selectedSize === size.value && styles.buttonActive,
            ]}
            onPress={() => onSelectSize(size.value)}
          >
            <Text
              style={[
                styles.buttonText,
                selectedSize === size.value && styles.buttonTextActive,
              ]}
            >
              {size.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    marginRight: 8,
  },
  buttonActive: {
    backgroundColor: "#1976D2",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  buttonTextActive: {
    color: "#fff",
  },
});

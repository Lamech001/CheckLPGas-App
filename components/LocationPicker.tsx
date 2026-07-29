import { FontAwesome5 } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: string) => void;
}

interface Suggestion {
  id: string;
  name: string;
  address: string;
}

// Popular locations in Kenya - defined outside component to avoid recreating on every render
const POPULAR_LOCATIONS: Suggestion[] = [
  { id: "1", name: "Nairobi", address: "Nairobi, Kenya" },
  { id: "2", name: "Mombasa", address: "Mombasa, Kenya" },
  { id: "3", name: "Kisumu", address: "Kisumu, Kenya" },
  { id: "4", name: "Nakuru", address: "Nakuru, Kenya" },
  { id: "5", name: "Eldoret", address: "Eldoret, Kenya" },
  { id: "6", name: "Kiambu", address: "Kiambu, Kenya" },
  { id: "7", name: "Machakos", address: "Machakos, Kenya" },
  { id: "8", name: "Kajiado", address: "Kajiado, Kenya" },
  { id: "9", name: "Murang'a", address: "Murang'a, Kenya" },
  { id: "10", name: "Nyeri", address: "Nyeri, Kenya" },
];

export const LocationPicker: React.FC<LocationPickerProps> = ({
  visible,
  onClose,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Avoid calling setState synchronously inside an effect.
    Promise.resolve().then(() => {
      setSuggestions(POPULAR_LOCATIONS);
    });
  }, [visible]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);

    if (text.length < 2) {
      setSuggestions(POPULAR_LOCATIONS);
      return;
    }

    setLoading(true);

    // Filter popular locations based on search
    const filtered = POPULAR_LOCATIONS.filter(
      (loc: Suggestion) =>
        loc.name.toLowerCase().includes(text.toLowerCase()) ||
        loc.address.toLowerCase().includes(text.toLowerCase()),
    );

    setSuggestions(filtered);
    setLoading(false);
  };

  const handleSelectLocation = (location: Suggestion) => {
    onSelectLocation(location.address);
    setSearchQuery("");
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use this feature.",
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const formattedAddress = `${address.city || address.subregion || ""}, ${address.region || "Kenya"}`;
        onSelectLocation(formattedAddress);
        onClose();
      }
    } catch {
      Alert.alert("Error", "Unable to get your current location.");
    } finally {
      setLoading(false);
    }
  };

  const renderSuggestion = ({ item }: { item: Suggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectLocation(item)}
    >
      <FontAwesome5
        name="map-marker-alt"
        size={16}
        color="#4CAF50"
        style={styles.suggestionIcon}
      />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        <Text style={styles.suggestionAddress}>{item.address}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={14} color="#999" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <FontAwesome5
              name="search"
              size={16}
              color="#999"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search location..."
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <FontAwesome5 name="times-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Use Current Location Button */}
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={handleUseCurrentLocation}
          >
            <FontAwesome5 name="location-arrow" size={18} color="#4CAF50" />
            <Text style={styles.currentLocationText}>Use Current Location</Text>
          </TouchableOpacity>

          {/* Suggestions List */}
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#4CAF50"
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item) => item.id}
              style={styles.suggestionsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No locations found</Text>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 4,
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  currentLocationText: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
    marginLeft: 12,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: 13,
    color: "#666",
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginTop: 20,
  },
});

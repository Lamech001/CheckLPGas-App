import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LocationBarProps {
  location: string;
  onSetManually: () => void;
}

export const LocationBar: React.FC<LocationBarProps> = ({ location, onSetManually }) => {
  return (
    <View style={styles.locationBar}>
      <View style={styles.locationIconContainer}>
        <FontAwesome5 name="map-marker-alt" size={18} color="#4CAF50" />
      </View>
      <Text style={styles.locationText}>
        Detect Location: <Text style={styles.locationValue}>{location}</Text>
      </Text>
      <TouchableOpacity onPress={onSetManually}>
        <Text style={styles.setManuallyLink}>Set Manually</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationIconContainer: {
    marginRight: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  locationValue: {
    fontWeight: '600',
    color: '#2E7D32',
  },
  setManuallyLink: {
    fontSize: 13,
    color: '#1976D2',
    textDecorationLine: 'underline',
  },
});

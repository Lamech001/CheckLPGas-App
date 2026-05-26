import { parseOrderMessageDetails } from '@/utils/orderMessage';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  orderText: string;
  onTrackLocation: () => void;
  hasLiveLocation: boolean;
};

export function OrderMessageCard({ orderText, onTrackLocation, hasLiveLocation }: Props) {
  const details = parseOrderMessageDetails(orderText);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>New gas order</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Cylinder</Text>
        <Text style={styles.value}>{details.cylinderSize}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Gas type</Text>
        <Text style={styles.value}>{details.gasType}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Quantity</Text>
        <Text style={styles.value}>{details.quantity}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Delivery</Text>
        <Text style={styles.value} numberOfLines={2}>
          {details.deliveryAddress}
        </Text>
      </View>
      <TouchableOpacity style={styles.trackBtn} onPress={onTrackLocation}>
        <FontAwesome5 name="location-arrow" size={14} color="#fff" />
        <Text style={styles.trackBtnText}>
          {hasLiveLocation ? 'Track Live Location' : 'View Live Location Map'}
        </Text>
      </TouchableOpacity>
      {!hasLiveLocation && (
        <Text style={styles.hint}>Location not shared yet — ask customer to share after ordering.</Text>
      )}
      {hasLiveLocation && (
        <Text style={styles.hint}>Last shared location is saved even if customer goes offline.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    width: 72,
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  value: {
    flex: 1,
    fontSize: 13,
    color: '#1c1c1e',
  },
  trackBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  trackBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
});

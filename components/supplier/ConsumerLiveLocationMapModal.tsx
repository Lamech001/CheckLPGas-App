import { AppStatusBar } from '@/components/AppStatusBar';
import { subscribeToConversation } from '@/services/chatService';
import { formatChatDate } from '@/services/types/chat';
import { FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  conversationId?: string;
  consumerName?: string;
};

const DEFAULT_REGION = {
  latitude: -1.286389,
  longitude: 36.817223,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function ConsumerLiveLocationMapModal({
  visible,
  onClose,
  conversationId,
  consumerName: consumerNameProp,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | undefined>();
  const [isActivelySharing, setIsActivelySharing] = useState(false);
  const [resolvedName, setResolvedName] = useState(consumerNameProp || 'Customer');

  useEffect(() => {
    if (!visible || !conversationId) {
      return;
    }

    const unsubscribe = subscribeToConversation(conversationId, (conversation) => {
      if (!conversation) {
        setLocation(null);
        setUpdatedAt(undefined);
        setIsActivelySharing(false);
        return;
      }

      setResolvedName(conversation.consumerName || consumerNameProp || 'Customer');
      setLocation(conversation.consumerLiveLocation ?? null);
      setUpdatedAt(conversation.consumerLiveLocationUpdatedAt);
      setIsActivelySharing(conversation.consumerLiveLocationSharing === true);
    });

    return unsubscribe;
  }, [visible, conversationId, consumerNameProp]);

  useEffect(() => {
    if (!visible || !location || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500
    );
  }, [visible, location?.latitude, location?.longitude]);

  const getStatus = () => {
    if (!location || !updatedAt) {
      return { label: 'Waiting for customer to share location', color: '#666' };
    }
    const ageMs = Date.now() - updatedAt.getTime();
    if (!isActivelySharing) {
      return { label: 'Last known location (customer offline or not sharing)', color: '#B26A00' };
    }
    if (ageMs <= 60000) return { label: 'Live now', color: '#0A7D00' };
    if (ageMs <= 5 * 60000) return { label: 'Updated recently', color: '#B26A00' };
    return { label: 'Last known location (may be outdated)', color: '#B00020' };
  };

  const status = getStatus();
  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <AppStatusBar backgroundColor="#FF6B35" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <FontAwesome5 name="times" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>{resolvedName}</Text>
            <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton
          >
            {location ? (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title={resolvedName}
                description={location.address || 'Customer location'}
                pinColor="#FF6B35"
              />
            ) : null}
          </MapView>

          {!location && (
            <View style={styles.emptyOverlay}>
              <FontAwesome5 name="map-marker-alt" size={32} color="#999" />
              <Text style={styles.emptyText}>
                Customer has not shared live location yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {location ? (
            <>
              <Text style={styles.coords}>
                {`${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
              </Text>
              {location.address ? (
                <Text style={styles.address} numberOfLines={2}>
                  {location.address}
                </Text>
              ) : null}
              {updatedAt ? (
                <Text style={styles.updated}>
                  {`Last update: ${formatChatDate(updatedAt)}`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>
              Ask the customer to tap “Share Live Location” after placing their order. Last shared
              locations stay saved even when they go offline.
            </Text>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e9f2',
    padding: 16,
    gap: 4,
  },
  coords: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  address: {
    fontSize: 13,
    color: '#555',
  },
  updated: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

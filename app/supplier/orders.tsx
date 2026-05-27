import { AppStatusBar } from '@/components/AppStatusBar';
import { ConsumerLiveLocationMapModal } from '@/components/supplier/ConsumerLiveLocationMapModal';
import { auth } from '@/config/firebase';
import { deleteConversation, subscribeToSupplierConversations } from '@/services/chatService';
import { isNewOrderMessage } from '@/utils/orderMessage';


import { formatMessageTime, type Conversation } from '@/services/types/chat';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback, memo, useRef } from 'react';
import {
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupplierOrdersScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapConversationId, setMapConversationId] = useState<string | null>(null);
  const [mapConsumerName, setMapConsumerName] = useState<string>('Customer');
  const currentUser = auth.currentUser;
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    console.log('[Orders] Subscribing with supplierId:', currentUser.uid);

    const unsubscribe = subscribeToSupplierConversations(currentUser.uid, (updatedConversations) => {
      console.log('[Orders] Received conversations:', updatedConversations.length, 'supplierId:', currentUser.uid);
      // Preserve existing conversations if new data is empty (network hiccup)
      if (updatedConversations.length === 0 && conversationsRef.current.length > 0) {
        return; // Keep existing data
      }
      conversationsRef.current = updatedConversations;
      setConversations(updatedConversations);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    // Reset loading when conversations update
    if (!loading && conversations.length > 0) return;
  }, [conversations.length]);


  const onRefresh = () => {
    setRefreshing(true);
    // Spinner for real-time subscription; stop refresh after a short delay
    setTimeout(() => setRefreshing(false), 1000);
  };


  const handleOrderPress = (conversation: Conversation) => {
    router.push({
      pathname: '/supplier/chat',
      params: {
        conversationId: conversation.id,
        consumer: JSON.stringify({
          uid: conversation.consumerId,
          fullName: conversation.consumerName,
          phoneNumber: conversation.consumerPhone,
        })
      }
    });
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Error', 'No phone number available');
      return;
    }
    
    Alert.alert(
      'Call Customer',
      `Do you want to call ${phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${phoneNumber}`).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          }
        }
      ]
    );
  };

  const handleMarkDelivered = (conversation: Conversation) => {
    Alert.alert(
      'Mark as Delivered',
      `Complete this order for ${conversation.consumerName}? This will remove it from your orders.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            // Immediately remove from UI for fast feedback
            setConversations(prev => prev.filter(c => c.id !== conversation.id));

            const result = await deleteConversation(conversation.id);
            if (!result.success) {
              // Re-add on failure
              setConversations(prev => [...prev, conversation]);
              Alert.alert('Error', result.error || 'Failed to mark as delivered');
            }
          }
        }
      ]
    );
  };

  const parseOrderDetails = (text: string) => {
    // Try to extract order details from message text
    const sizeMatch = text.match(/(\d+)\s*kg/i);
    const qtyMatch = text.match(/qty?u?a?n?t?i?t?y?\s*:?\s*(\d+)/i);
    // Match "Gas type:" followed by any text until newline or pipe
    const gasMatch = text.match(/gas\s*type\s*[:\s]*([^\n|]+)/i);
    const addressMatch = text.match(/(deliver[y]?|address|location)\s*:?\s*(.+)/i);

    return {
      cylinderSize: sizeMatch ? `${sizeMatch[1]}kg` : 'Not specified',
      quantity: qtyMatch ? qtyMatch[1] : '1',
      gasType: gasMatch ? gasMatch[1].trim() : 'Not specified',
      deliveryAddress: addressMatch ? addressMatch[2].trim() : 'Not provided',
    };
  };

  const getOrderStatus = (conversation: Conversation): { label: string; color: string } => {
    if (conversation.unreadCount > 0) {
      return { label: 'New Order', color: '#4CAF50' };
    }
    if (conversation.lastMessage) {
      const msgText = conversation.lastMessage.text.toLowerCase();
      if (msgText.includes('confirmed') || msgText.includes('accepted')) {
        return { label: 'Confirmed', color: '#2196F3' };
      }
      if (msgText.includes('delivered') || msgText.includes('complete')) {
        return { label: 'Completed', color: '#9C27B0' };
      }
      if (msgText.includes('cancelled') || msgText.includes('declined')) {
        return { label: 'Cancelled', color: '#f44336' };
      }
    }
    return { label: 'Pending', color: '#FF9800' };
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadCount > 0;
    const lastMessage = item.lastMessage;
    const orderDetails = lastMessage ? parseOrderDetails(lastMessage.text) : parseOrderDetails('');
    const hasLiveLocation = !!item.consumerLiveLocation;
    const status = getOrderStatus(item);
    const orderId = `ORD-${item.id.slice(-8).toUpperCase()}`;

    return (
      <View style={[styles.orderCard, hasUnread && styles.unreadCard]}>
        {/* Order Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>{orderId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
              <Text style={styles.statusBadgeText}>{status.label}</Text>
            </View>
          </View>
          {hasUnread && (
            <View style={styles.unreadIndicator}>
              <Text style={styles.unreadCount}>{item.unreadCount} new</Text>
            </View>
          )}
        </View>

        {/* Customer Info */}
        <View style={styles.customerSection}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={20} color="#fff" />
          </View>
          <View style={styles.customerDetails}>
            <Text style={[styles.customerName, hasUnread && styles.unreadText]} numberOfLines={1}>
              {item.consumerName}
            </Text>
            <Text style={styles.customerPhone}>{item.consumerPhone || 'No phone'}</Text>
          </View>
          <TouchableOpacity
            style={styles.callButtonSmall}
            onPress={() => handleCall(item.consumerPhone)}
          >
            <FontAwesome5 name="phone" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Order Details Grid */}
        <View style={styles.orderDetailsGrid}>
          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <FontAwesome5 name="fire" size={14} color="#FF6B35" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Cylinder Size</Text>
              <Text style={styles.detailValue}>{orderDetails.cylinderSize}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <FontAwesome5 name="cloud" size={14} color="#2196F3" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Gas Type</Text>
              <Text style={styles.detailValue}>{orderDetails.gasType}</Text>
            </View>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIcon}>
              <FontAwesome5 name="box" size={14} color="#9C27B0" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Quantity</Text>
              <Text style={styles.detailValue}>{orderDetails.quantity}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Location */}
        <View style={styles.deliverySection}>
          <FontAwesome5 name="map-marker-alt" size={14} color="#f44336" />
          <Text style={styles.deliveryLabel}>Delivery:</Text>
          <Text style={styles.deliveryAddress} numberOfLines={1}>
            {orderDetails.deliveryAddress}
          </Text>
        </View>

        {/* Track Live Location Button (restored) */}
        <View style={styles.locationActionRow}>
          <TouchableOpacity
            style={styles.trackLocationBtn}
            onPress={() => {
              setMapConversationId(item.id);
              setMapConsumerName(item.consumerName);
            }}
          >
            <FontAwesome5 name="location-arrow" size={14} color="#fff" />
            <Text style={styles.trackLocationBtnText}>
              {hasLiveLocation ? 'Track Live Location' : 'View Location Map'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Last Message Preview / Live location */}
        {lastMessage && (
          <View style={styles.messagePreview}>
            {isNewOrderMessage(lastMessage.text) ? (
              <Text style={styles.messagePreviewText} numberOfLines={1}>
                {lastMessage.text}
              </Text>
            ) : (
              <Text style={styles.messagePreviewText} numberOfLines={1}>
                {lastMessage.text}
              </Text>
            )}
            <Text style={styles.messageTime}>
              {formatMessageTime(lastMessage.timestamp)}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.deliveredButton}
            onPress={() => handleMarkDelivered(item)}
          >
            <FontAwesome5 name="check-circle" size={14} color="#fff" />
            <Text style={styles.deliveredButtonText}>Mark Delivered</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleOrderPress(item)}
          >
            <Text style={styles.viewButtonText}>View</Text>
            <FontAwesome5 name="chevron-right" size={12} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="user-lock" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Please sign in to view orders</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.replace('/supplier/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Orders</Text>
          <Text style={styles.headerSubtitle}>{conversations.length} order threads</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          {/* Inline spinner-style loading (no blocking full-text UX) */}
          <View style={styles.spinnerButton}>
            <Text style={styles.spinnerText}>Loading...</Text>
          </View>

        </View>
      ) : conversations.length === 0 ? (

        <View style={styles.emptyContainer}>
          <FontAwesome5 name="clipboard-list" size={64} color="#ddd" />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptyText}>
            Orders from customers will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
        />
      )}

      <ConsumerLiveLocationMapModal
        visible={!!mapConversationId}
        conversationId={mapConversationId ?? undefined}
        consumerName={mapConsumerName}
        onClose={() => setMapConversationId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  spinnerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  unreadIndicator: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unreadCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  customerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fafafa',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  unreadText: {
    color: '#FF6B35',
  },
  customerPhone: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  callButtonSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderDetailsGrid: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  detailItemLast: {
    borderRightWidth: 0,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailContent: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 2,
  },
  deliverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  deliveryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
    marginRight: 4,
  },
  deliveryAddress: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
  },
  messagePreviewText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    marginRight: 10,
  },
  locationActionRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  trackLocationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 0,
  },
  trackLocationBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deliveredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  deliveredButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

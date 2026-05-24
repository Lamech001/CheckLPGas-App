import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { subscribeToSupplierConversations } from '@/services/chatService';
import { Conversation, formatMessageTime } from '@/services/types/chat';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupplierConversationsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToSupplierConversations(
      currentUser.uid,
      (updatedConversations) => {
        setConversations(updatedConversations);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load supplier conversations:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const messageCount = conversations.reduce(
    (total, conversation) => total + (conversation.unreadCount ?? 0),
    0
  );

  const handleOrderPress = (conversation: Conversation) => {
    router.push({
      pathname: '/supplier/order',
      params: {
        conversationId: conversation.id,
        consumerName: conversation.consumerName,
        consumerPhone: conversation.consumerPhone || '',
      },
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadCount > 0;
    const lastMessage = item.lastMessage;

    return (
      <View style={[styles.conversationCard, hasUnread && styles.unreadCard]}>
        <TouchableOpacity style={styles.cardContent} onPress={() => handleOrderPress(item)}>
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={20} color="#fff" />
          </View>
          <View style={styles.conversationInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.consumerName, hasUnread && styles.unreadText]} numberOfLines={1}>
                {item.consumerName}
              </Text>
              {lastMessage && (
                <Text style={styles.timeText} numberOfLines={1}>
                  {formatMessageTime(lastMessage.timestamp)}
                </Text>
              )}
            </View>
            <Text style={[styles.lastMessage, hasUnread && styles.unreadMessage]} numberOfLines={1}>
              {lastMessage ? lastMessage.text : 'Start processing this customer order'}
            </Text>
          </View>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {item.consumerPhone ? (
          <TouchableOpacity
            style={styles.callButton}
            activeOpacity={0.7}
            onPress={() => {
              Linking.openURL(`tel:${item.consumerPhone}`);
            }}
          >
            <FontAwesome5 name="phone" size={16} color="#fff" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#1976D2" barStyle="light-content" />
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="user-lock" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Sign in to view your order requests.</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/supplier/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#1976D2" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Order Requests</Text>
          <Text style={styles.headerSubtitle}>{conversations.length} orders</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="shopping-bag" size={64} color="#ddd" />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptyText}>
            Customers will appear here once they submit an order request.
          </Text>
        </View>
      ) : (
        <>
          {messageCount > 0 && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>You have {messageCount} new message{messageCount === 1 ? '' : 's'}</Text>
            </View>
          )}
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
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
  },
  signInButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  conversationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#FFF8F5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  conversationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consumerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
  unreadText: {
    color: '#FF8A65',
  },
  unreadMessage: {
    fontWeight: '700',
    color: '#FF8A65',
  },
  unreadBadge: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  callButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCC02',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bannerText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});

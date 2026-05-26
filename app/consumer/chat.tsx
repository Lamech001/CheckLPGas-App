import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { deleteMessage, editMessage, getOrCreateConversation, markMessagesAsRead, sendMessage, subscribeToMessages } from '@/services/chatService';
import { formatChatDate, Message } from '@/services/types/chat';
import { SupplierWithDistance } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type ChatMessage = Message & { pending?: boolean };

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const supplierData = params.supplier ? JSON.parse(params.supplier as string) as SupplierWithDistance : null;
  const conversationIdParam = params.conversationId as string | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string>(conversationIdParam || '');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const currentUser = auth.currentUser;

  const initConversation = async (): Promise<string | null> => {
    if (!currentUser || !supplierData) {
      setLoading(false);
      return null;
    }

    if (conversationId) {
      setLoading(false);
      return conversationId;
    }

    setIsCreatingConversation(true);

    const conversationPayload: any = {
      consumerId: currentUser.uid,
      consumerName: currentUser.displayName || 'Consumer',
      supplierId: supplierData.uid,
      supplierName: supplierData.fullName || supplierData.enterpriseName,
      supplierEnterpriseName: supplierData.enterpriseName,
    };

    if (currentUser.phoneNumber) {
      conversationPayload.consumerPhone = currentUser.phoneNumber;
    }

    const result = await getOrCreateConversation(conversationPayload);
    setIsCreatingConversation(false);

    if (result.success && result.conversationId) {
      setConversationId(result.conversationId);
      setLoading(false);
      return result.conversationId;
    }

    setLoading(false);
    Alert.alert('Error', 'Failed to start order thread');
    return null;
  };

  useEffect(() => {
    initConversation();
  }, [currentUser, supplierData]);

  // Subscribe to messages
  useEffect(() => {
    if (!conversationId) return;

    // Mark messages as read when entering chat
    if (currentUser) {
      markMessagesAsRead(conversationId, currentUser.uid);
    }

    const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
      setMessages((currentMessages) => {
        const pendingMessages = currentMessages.filter((msg) => msg.pending);
        const dedupedPending = pendingMessages.filter((pending) =>
          !newMessages.some((serverMsg) =>
            serverMsg.senderId === pending.senderId &&
            serverMsg.text === pending.text &&
            Math.abs(serverMsg.timestamp.getTime() - pending.timestamp.getTime()) < 20000
          )
        );
        return [...newMessages, ...dedupedPending];
      });
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser) return;

    const text = inputText.trim();
    const id = `pending-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id,
      conversationId: conversationId || id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Consumer',
      senderRole: 'consumer',
      text,
      timestamp: new Date(),
      read: true,
      pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    flatListRef.current?.scrollToEnd({ animated: true });

    const createdConversationId = conversationId || await initConversation();
    if (!createdConversationId) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      return;
    }

    const result = await sendMessage({
      conversationId: createdConversationId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Consumer',
      senderRole: 'consumer',
      text,
    });

    if (!result.success) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSendEdit = async () => {
    if (!inputText.trim() || !currentUser || !conversationId) return;
    if (!editingMessageId) return handleSend();

    const text = inputText.trim();
    setInputText('');
    setEditingMessageId(null);

    const result = await editMessage(editingMessageId, text);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to edit message');
    }
  };

  const handleMessageLongPress = (message: Message) => {
    const isMe = message.senderId === currentUser?.uid;
    if (!isMe) return;

    Alert.alert('Message Actions', '', [
      {
        text: 'Edit',
        onPress: () => {
          setInputText(message.text);
          setEditingMessageId(message.id);
        },
      },
      {
        text: 'Delete',
        onPress: () => {
          Alert.alert('Delete Message', 'Are you sure?', [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                const result = await deleteMessage(message.id);
                if (!result.success) {
                  Alert.alert('Error', result.error || 'Failed to delete message');
                }
              },
            },
          ]);
        },
        style: 'destructive',
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleCall = async () => {
    if (!supplierData?.phoneNumber) return;

    try {
      Linking.openURL(`tel:${supplierData.phoneNumber}`);
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to open phone dialer.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.uid;

    return (
      <TouchableOpacity
        style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={500}
      >
        {!isMe && (
          <View style={styles.avatar}>
            <FontAwesome5 name="store" size={14} color="#fff" />
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.text}
          </Text>
          {item.isEdited && (
            <Text style={styles.editedLabel}>edited</Text>
          )}
          <Text style={[styles.messageTime, !isMe && styles.theirMessageTime]}>{formatChatDate(item.timestamp)}</Text>
        </View>
        {isMe && (
          <View style={[styles.avatar, styles.myAvatar]}>
            <FontAwesome5 name="user" size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="user-lock" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Please sign in to place orders</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push('/consumer/login')}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const chatTitle = supplierData?.enterpriseName || 'Order';

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
      // Use consistent offset across devices to avoid shifting the input below the tab bar
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom + 120 : 80}
    >
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{chatTitle}</Text>
          <Text style={styles.headerSubtitle}>
            {supplierData?.isOpen ? 'Place order with supplier' : 'Supplier offline'}
          </Text>
          <Text style={styles.headerHelper}>
            Send your gas order details: cylinder size, quantity, and delivery address.
          </Text>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
          <FontAwesome5 name="phone" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Starting conversation...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={[styles.messagesContainer, { flexGrow: 1, paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input */}
      <View style={styles.inputWrapper}>
        {editingMessageId && (
          <View style={styles.editingLabel}>
            <Text style={styles.editingLabelText}>Editing message...</Text>
            <TouchableOpacity onPress={() => {
              setEditingMessageId(null);
              setInputText('');
            }}>
              <FontAwesome5 name="times" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={isCreatingConversation ? 'Creating order thread...' : 'Describe your gas order, quantity, and delivery details...'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!isCreatingConversation}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isCreatingConversation) && styles.sendButtonDisabled]}
            onPress={editingMessageId ? handleSendEdit : handleSend}
            disabled={!inputText.trim() || isCreatingConversation}
          >
            <FontAwesome5 name={editingMessageId ? 'check' : 'paper-plane'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  headerHelper: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: '95%',
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageList: {
    flex: 1,
  },
  keyboardAvoidingRoot: {
    flex: 1,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    backgroundColor: '#fff',
    // Padding ensures the footer doesn't get covered by Android navigation/tab buttons.
    // Use SafeArea insets / keyboard offset instead of large fixed padding.
    paddingBottom: Platform.OS === 'android' ? 20 : 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  myAvatar: {
    backgroundColor: '#34C759',
    marginLeft: 12,
    marginRight: 0,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: '#34C759',
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  senderName: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1c1c1e',
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#1c1c1e',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  theirMessageTime: {
    color: '#8e8e93',
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
    paddingBottom: Platform.OS === 'android' ? 60 : 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
    color: '#1c1c1e',
    marginRight: 12,
  },
  keyboardAvoiding: {
    width: '100%',
    backgroundColor: '#fff',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d1d6',
    shadowOpacity: 0,
    elevation: 0,
  },
  editingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFCC02',
  },
  editingLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6F00',
  },
  editedLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

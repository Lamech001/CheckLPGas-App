import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { markMessagesAsRead, sendMessage, subscribeToMessages } from '@/services/chatService';
import { formatChatDate, Message } from '@/services/types/chat';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupplierChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = params.conversationId as string;
  const consumerName = params.consumerName as string || 'Customer';
  const consumerPhone = params.consumerPhone as string || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      return;
    }

    // Mark messages as read when entering chat
    if (currentUser) {
      markMessagesAsRead(conversationId, currentUser.uid);
    }

    const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !conversationId) return;

    const text = inputText.trim();
    setInputText('');

    const result = await sendMessage({
      conversationId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Supplier',
      senderRole: 'supplier',
      text,
    });

    if (!result.success) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === currentUser?.uid;

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
        {!isMe && (
          <View style={styles.avatar}>
            <FontAwesome5 name="user" size={14} color="#fff" />
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.text}
          </Text>
          <Text style={styles.messageTime}>{formatChatDate(item.timestamp)}</Text>
        </View>
        {isMe && (
          <View style={[styles.avatar, styles.myAvatar]}>
            <FontAwesome5 name="store" size={14} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const handleCall = () => {
    if (consumerPhone) {
      const Linking = require('react-native').Linking;
      Linking.openURL(`tel:${consumerPhone}`);
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <AppStatusBar backgroundColor="#1976D2" barStyle="light-content" />
        <View style={styles.emptyContainer}>
          <FontAwesome5 name="user-lock" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Please sign in to chat</Text>
          <TouchableOpacity style={styles.signInButton} onPress={() => router.push({ pathname: '/consumer/login', params: { role: 'supplier' } })}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#1976D2" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{consumerName}</Text>
          <Text style={styles.headerSubtitle}>Customer</Text>
        </View>
        {consumerPhone && (
          <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
            <FontAwesome5 name="phone" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <FontAwesome5 name="paper-plane" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: '#1976D2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
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
    color: 'rgba(255,255,255,0.8)',
  },
  callBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  messagesContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  theirMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  myAvatar: {
    backgroundColor: '#1976D2',
    marginLeft: 8,
    marginRight: 0,
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#1976D2',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  senderName: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { db } from '@/config/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { Conversation, CreateConversationData, Message, SendMessageData } from './types/chat';

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';

// Create a new conversation between consumer and supplier
export const createConversation = async (
  data: CreateConversationData
): Promise<{ success: boolean; conversationId?: string; error?: string }> => {
  try {
    // Check if conversation already exists
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where('consumerId', '==', data.consumerId),
      where('supplierId', '==', data.supplierId)
    );

    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Return existing conversation
      return { 
        success: true, 
        conversationId: querySnapshot.docs[0].id 
      };
    }

    // Create new conversation
    const conversationRef = doc(collection(db, CONVERSATIONS_COLLECTION));
    // Filter out undefined values to prevent Firestore errors
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
    const conversationData = {
      ...filteredData,
      unreadCount: 0,
      supplierUnreadCount: 0,
      consumerUnreadCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(conversationRef, conversationData);

    return { success: true, conversationId: conversationRef.id };
  } catch (error: any) {
    console.error('Create conversation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create conversation.',
    };
  }
};

// Get or create conversation
export const getOrCreateConversation = async (
  data: CreateConversationData
): Promise<{ success: boolean; conversationId?: string; error?: string }> => {
  return createConversation(data);
};

// Send a message
export const sendMessage = async (
  data: SendMessageData
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Add message
    const messageRef = await addDoc(collection(db, MESSAGES_COLLECTION), {
      ...data,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update conversation last message and unread counter for the recipient
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, data.conversationId);
    const recipientUnreadField =
      data.senderRole === 'consumer' ? 'supplierUnreadCount' : 'consumerUnreadCount';
    await updateDoc(conversationRef, {
      lastMessage: {
        text: data.text,
        timestamp: serverTimestamp(),
        senderId: data.senderId,
      },
      updatedAt: serverTimestamp(),
      [recipientUnreadField]: increment(1),
    });

    return { success: true, messageId: messageRef.id };
  } catch (error: any) {
    console.error('Send message error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message.',
    };
  }
};

// Get messages for a conversation
export const getMessages = async (
  conversationId: string,
  messageLimit: number = 50
): Promise<{ success: boolean; messages?: Message[]; error?: string }> => {
  try {
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'desc'),
      limit(messageLimit)
    );

    const querySnapshot = await getDocs(q);
    const messages: Message[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as Message);
    });

    // Return in chronological order
    return { success: true, messages: messages.reverse() };
  } catch (error: any) {
    console.error('Get messages error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch messages.',
    };
  }
};

// Get conversations for a user (consumer)
export const getConsumerConversations = async (
  consumerId: string
): Promise<{ success: boolean; conversations?: Conversation[]; error?: string }> => {
  try {
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where('consumerId', '==', consumerId),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const conversations: Conversation[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        unreadCount: data.consumerUnreadCount ?? data.unreadCount ?? 0,
        lastMessage: data.lastMessage ? {
          ...data.lastMessage,
          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
        } : undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Conversation);
    });

    return { success: true, conversations };
  } catch (error: any) {
    console.error('Get consumer conversations error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch conversations.',
    };
  }
};

// Get conversations for a supplier
export const getSupplierConversations = async (
  supplierId: string
): Promise<{ success: boolean; conversations?: Conversation[]; error?: string }> => {
  try {
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where('supplierId', '==', supplierId),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const conversations: Conversation[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        unreadCount: data.supplierUnreadCount ?? data.unreadCount ?? 0,
        lastMessage: data.lastMessage ? {
          ...data.lastMessage,
          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
        } : undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Conversation);
    });

    return { success: true, conversations };
  } catch (error: any) {
    console.error('Get supplier conversations error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch conversations.',
    };
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    
    const updatePromises = querySnapshot.docs.map((docSnapshot) =>
      updateDoc(doc(db, MESSAGES_COLLECTION, docSnapshot.id), { read: true })
    );

    await Promise.all(updatePromises);

    // Keep the conversation unread count aligned for the current user
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const conversationSnapshot = await getDoc(conversationRef);
    const conversationData = conversationSnapshot.data();

    if (conversationData) {
      const isSupplier = conversationData.supplierId === userId;
      const roleUnreadField = isSupplier ? 'supplierUnreadCount' : 'consumerUnreadCount';
      await updateDoc(conversationRef, {
        [roleUnreadField]: 0,
      });
    }
  } catch (error) {
    console.error('Mark messages as read error:', error);
  }
};

// Subscribe to messages in a conversation (real-time)
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void
) => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const messages: Message[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
      } as Message);
    });
    callback(messages);
  });
};

// Subscribe to consumer conversations (real-time)
export const subscribeToConsumerConversations = (
  consumerId: string,
  callback: (conversations: Conversation[]) => void
) => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('consumerId', '==', consumerId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const conversations: Conversation[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        unreadCount: data.consumerUnreadCount ?? data.unreadCount ?? 0,
        lastMessage: data.lastMessage ? {
          ...data.lastMessage,
          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
        } : undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Conversation);
    });
    callback(conversations);
  });
};

// Subscribe to supplier conversations (real-time)
export const subscribeToSupplierConversations = (
  supplierId: string,
  callback: (conversations: Conversation[]) => void
) => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('supplierId', '==', supplierId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const conversations: Conversation[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      conversations.push({
        id: doc.id,
        ...data,
        unreadCount: data.supplierUnreadCount ?? data.unreadCount ?? 0,
        lastMessage: data.lastMessage ? {
          ...data.lastMessage,
          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
        } : undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Conversation);
    });
    callback(conversations);
  });
};

// Get unread message count
export const getUnreadCount = async (
  conversationId: string,
  userId: string
): Promise<number> => {
  try {
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId),
      where('senderId', '!=', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Get unread count error:', error);
    return 0;
  }
};

// Edit a message
export const editMessage = async (
  messageId: string,
  newText: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const messageRef = doc(db, MESSAGES_COLLECTION, messageId);
    await updateDoc(messageRef, {
      text: newText,
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('Edit message error:', error);
    return {
      success: false,
      error: error.message || 'Failed to edit message.',
    };
  }
};

// Delete a message
export const deleteMessage = async (
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteDoc(doc(db, MESSAGES_COLLECTION, messageId));
    return { success: true };
  } catch (error: any) {
    console.error('Delete message error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete message.',
    };
  }
};

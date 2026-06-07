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
  writeBatch,
  limit,
} from 'firebase/firestore';
import { Conversation, CreateConversationData, Message, SendMessageData } from './types/chat';

const CONVERSATIONS_COLLECTION = 'conversations';
const MESSAGES_COLLECTION = 'messages';

// Helper to check if error is offline-related
const isOfflineError = (error: any): boolean => {
  return error?.code === 'unavailable' ||
         error?.message?.includes('client is offline') ||
         error?.message?.includes('offline');
};

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
    // Handle offline - conversation will sync when back online
    if (isOfflineError(error)) {
      console.log('[Chat] Offline - conversation queued for sync');
      return { success: true };
    }
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
  let messageRef;
  try {
    // Add message
    messageRef = await addDoc(collection(db, MESSAGES_COLLECTION), {
      ...data,
      timestamp: serverTimestamp(),
      read: false,
      deleted: false,
    });
  } catch (error: any) {
    if (isOfflineError(error)) {
      console.log('[Chat] Offline - message queued for sync');
      return { success: true };
    }
    console.error('Send message error (addDoc):', error);
    return {
      success: false,
      error: error.message || 'Failed to send message.',
    };
  }

  // Update conversation metadata — retry once on failure so the order
  // still surfaces in the supplier's list even on a transient error.
  const conversationRef = doc(db, CONVERSATIONS_COLLECTION, data.conversationId);
  const recipientUnreadField =
    data.senderRole === 'consumer' ? 'supplierUnreadCount' : 'consumerUnreadCount';
  const conversationUpdate = {
    lastMessage: {
      text: data.text,
      timestamp: serverTimestamp(),
      senderId: data.senderId,
    },
    updatedAt: serverTimestamp(),
    [recipientUnreadField]: increment(1),
  };

  try {
    await updateDoc(conversationRef, conversationUpdate);
  } catch (firstError) {
    console.warn('Conversation update failed, retrying once…', firstError);
    try {
      await updateDoc(conversationRef, conversationUpdate);
    } catch (retryError) {
      console.error('Conversation update retry failed:', retryError);
    }
  }

  return { success: true, messageId: messageRef.id };
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

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.deleted) return;
      messages.push({
        id: docSnap.id,
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
    
    const updatePromises = querySnapshot.docs
      .filter((docSnapshot) => !docSnapshot.data().deleted)
      .map((docSnapshot) =>
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
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const messages: Message[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.deleted) return;
        messages.push({
          id: docSnap.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as Message);
      });
      callback(messages);
    },
    (error) => {
      console.error('subscribeToMessages error:', error);
      onError?.(error);
    }
  );
};

// Subscribe to consumer conversations (real-time)
export const subscribeToConsumerConversations = (
  consumerId: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('consumerId', '==', consumerId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const conversations: Conversation[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        conversations.push({
          id: docSnap.id,
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
    },
    (error) => {
      console.error('subscribeToConsumerConversations error:', error);
      onError?.(error);
    }
  );
};

// Get consumer phone number from Firestore users collection
const getConsumerPhoneNumber = async (consumerId: string): Promise<string | undefined> => {
  try {
    const userDocRef = doc(db, 'users', consumerId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      // Try various phone field names and formats
      const phone = data.phoneNumber || data.phone || data.Telephone || data.tel;
      if (phone && typeof phone === 'string' && phone.trim().length > 0) {
        return phone.trim();
      }
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching consumer phone:', error);
    return undefined;
  }
};

// Subscribe to supplier conversations (real-time)
export const subscribeToSupplierConversations = (
  supplierId: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(
    collection(db, CONVERSATIONS_COLLECTION),
    where('supplierId', '==', supplierId),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    async (querySnapshot) => {
      const conversations: Conversation[] = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const conversation: Conversation = {
          id: docSnap.id,
          ...data,
          unreadCount: data.supplierUnreadCount ?? data.unreadCount ?? 0,
          lastMessage: data.lastMessage ? {
            ...data.lastMessage,
            timestamp: data.lastMessage.timestamp?.toDate() || new Date(),
          } : undefined,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Conversation;

        if (!data.consumerPhone) {
          const phone = await getConsumerPhoneNumber(data.consumerId);
          if (phone) {
            conversation.consumerPhone = phone;
          }
        }

        conversations.push(conversation);
      }

      callback(conversations);
    },
    (error) => {
      console.error('subscribeToSupplierConversations error:', error);
      onError?.(error);
    }
  );
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

// Soft-delete a message and refresh the conversation's lastMessage preview
export const deleteMessage = async (
  messageId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const messageRef = doc(db, MESSAGES_COLLECTION, messageId);
    const messageSnapshot = await getDoc(messageRef);
    const messageData = messageSnapshot.data();

    // Soft-delete: mark the message rather than physically removing it
    await updateDoc(messageRef, {
      deleted: true,
      text: '',
      deletedAt: serverTimestamp(),
    });

    // Refresh the conversation's lastMessage so the list preview stays accurate
    if (messageData?.conversationId) {
      const conversationId = messageData.conversationId as string;
      const msgsQuery = query(
        collection(db, MESSAGES_COLLECTION),
        where('conversationId', '==', conversationId),
        where('deleted', '==', false),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const remaining = await getDocs(msgsQuery);
      const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

      if (!remaining.empty) {
        const latest = remaining.docs[0].data();
        await updateDoc(conversationRef, {
          lastMessage: {
            text: latest.text,
            timestamp: latest.timestamp,
            senderId: latest.senderId,
          },
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(conversationRef, {
          lastMessage: null,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete message error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete message.',
    };
  }
};

// Hard-delete a conversation and all of its messages once the order is
// delivered. This permanently removes the documents from Firestore to keep
// storage/read costs down (messages are the bulk of the documents, so we
// delete them too rather than leaving orphaned docs behind).
export const deleteConversation = async (
  conversationId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Delete all messages belonging to this conversation, batched to stay
    // under Firestore's 500-write limit per batch.
    const messagesQuery = query(
      collection(db, MESSAGES_COLLECTION),
      where('conversationId', '==', conversationId)
    );
    const messagesSnapshot = await getDocs(messagesQuery);

    const docs = messagesSnapshot.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((messageDoc) => batch.delete(messageDoc.ref));
      await batch.commit();
    }

    // Delete the conversation document itself.
    await deleteDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId));

    return { success: true };
  } catch (error: any) {
    console.error('Delete conversation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete conversation.',
    };
  }
};

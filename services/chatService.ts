import { db } from '../config/firebase';

import {
    addDoc,

    collection,

    deleteDoc,

    doc,
    getDoc,

    getDocFromCache,
    getDocs,
    increment,
    limit,
    onSnapshot,

    orderBy,

    query,

    serverTimestamp,

    setDoc,

    updateDoc,

    where,
} from 'firebase/firestore';

import { Conversation, CreateConversationData, Message, SendMessageData } from './types/chat';



const CONVERSATIONS_COLLECTION = 'conversations';

const MESSAGES_COLLECTION = 'messages';



const toDateOrUndefined = (value: any): Date | undefined => {

  if (!value) return undefined;

  if (typeof value?.toDate === 'function') return value.toDate();

  if (value instanceof Date) return value;

  return undefined;

};



const normalizeLiveLocation = (raw: any): Conversation['consumerLiveLocation'] | undefined => {

  if (!raw) return undefined;

  const latitude = Number(raw.latitude);

  const longitude = Number(raw.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

  return {

    latitude,

    longitude,

    ...(raw.address ? { address: String(raw.address) } : {}),

  };

};



export const mapConversationDoc = (id: string, data: Record<string, any>): Conversation => ({

  id,

  consumerId: data.consumerId,

  consumerName: data.consumerName,

  consumerPhone: data.consumerPhone,

  consumerLiveLocation: normalizeLiveLocation(data.consumerLiveLocation),

  consumerLiveLocationUpdatedAt: toDateOrUndefined(data.consumerLiveLocationUpdatedAt),

  consumerLiveLocationSharing: data.consumerLiveLocationSharing === true,

  supplierId: data.supplierId,

  supplierName: data.supplierName,

  supplierEnterpriseName: data.supplierEnterpriseName,

  unreadCount: data.supplierUnreadCount ?? data.consumerUnreadCount ?? data.unreadCount ?? 0,

  supplierUnreadCount: data.supplierUnreadCount,

  consumerUnreadCount: data.consumerUnreadCount,

  lastMessage: data.lastMessage

    ? {

        ...data.lastMessage,

        timestamp: toDateOrUndefined(data.lastMessage.timestamp) || new Date(),

      }

    : undefined,

  createdAt: toDateOrUndefined(data.createdAt) || new Date(),

  updatedAt: toDateOrUndefined(data.updatedAt) || new Date(),

});



// Helper to check if error is offline-related

const isOfflineError = (error: any): boolean => {

  return error?.code === 'unavailable' ||

         error?.code === 'failed-precondition' ||

         error?.message?.includes('client is offline') ||

         error?.message?.includes('offline');

};



const isPermissionError = (error: any): boolean => {

  return error?.code === 'permission-denied' ||

         error?.message?.includes('permission') ||

         error?.message?.includes('insufficient permissions');

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

    // Handle offline - message will sync when back online

    if (isOfflineError(error)) {

      return { success: true };

    }

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



    querySnapshot.forEach((docSnap: any) => {

      const data = docSnap.data();

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



    querySnapshot.forEach((docSnap: any) => {

      const data = docSnap.data();

      conversations.push({

        id: docSnap.id,

        ...data,

        consumerLiveLocationUpdatedAt: toDateOrUndefined(data.consumerLiveLocationUpdatedAt),

        unreadCount: data.consumerUnreadCount ?? data.unreadCount ?? 0,

        lastMessage: data.lastMessage ? {

          ...data.lastMessage,

          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),

        } : undefined,

        createdAt: data.createdAt?.toDate() || new Date(),

        updatedAt: toDateOrUndefined(data.updatedAt) || new Date(),

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



    querySnapshot.forEach((docSnap: any) => {

      const data = docSnap.data();

      conversations.push({

        id: docSnap.id,

        ...data,

        consumerLiveLocationUpdatedAt: toDateOrUndefined(data.consumerLiveLocationUpdatedAt),

        unreadCount: data.supplierUnreadCount ?? data.unreadCount ?? 0,

        lastMessage: data.lastMessage ? {

          ...data.lastMessage,

          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),

        } : undefined,

        createdAt: data.createdAt?.toDate() || new Date(),

        updatedAt: toDateOrUndefined(data.updatedAt) || new Date(),

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

    

    const updatePromises = querySnapshot.docs.map((docSnapshot: any) =>

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



  return onSnapshot(q, (querySnapshot: any) => {

    const messages: Message[] = [];

    querySnapshot.forEach((docSnap: any) => {

      const data = docSnap.data();

      messages.push({

        id: docSnap.id,

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



  return onSnapshot(q, (querySnapshot: any) => {

    const conversations: Conversation[] = [];

    querySnapshot.forEach((docSnap: any) => {

      const data = docSnap.data();

      conversations.push({

        id: docSnap.id,

        ...data,

        consumerLiveLocationUpdatedAt: toDateOrUndefined(data.consumerLiveLocationUpdatedAt),

        unreadCount: data.consumerUnreadCount ?? data.unreadCount ?? 0,

        lastMessage: data.lastMessage ? {

          ...data.lastMessage,

          timestamp: data.lastMessage.timestamp?.toDate() || new Date(),

        } : undefined,

        createdAt: data.createdAt?.toDate() || new Date(),

        updatedAt: toDateOrUndefined(data.updatedAt) || new Date(),

      } as Conversation);

    });

    callback(conversations);

  });

};



// Get consumer phone number from Firestore users collection

const getConsumerPhoneNumber = async (consumerId: string): Promise<string | undefined> => {

  const userDocRef = doc(db, 'users', consumerId);



  try {

    const userDoc = await getDoc(userDocRef);



    if (userDoc.exists()) {

      const data = userDoc.data();

      const phone = data.phoneNumber || data.phone || data.Telephone || data.tel || data.mobile || data.mobileNumber || data.contact;

      if (phone && typeof phone === 'string' && phone.trim().length > 0) {

        return phone.trim();

      }

    }

  } catch (error: any) {

    if (isOfflineError(error) || isPermissionError(error)) {

      try {

        const cachedDoc = await getDocFromCache(userDocRef);

        if (cachedDoc.exists()) {

          const data = cachedDoc.data();

          const phone = data.phoneNumber || data.phone || data.Telephone || data.tel || data.mobile || data.mobileNumber || data.contact;

          if (phone && typeof phone === 'string' && phone.trim().length > 0) {

            return phone.trim();

          }

        }

      } catch {

        // Ignore cache fallback failures; the UI can continue without the phone number.

      }

      return undefined;

    }



    console.warn('[Chat] Could not resolve consumer phone number:', error?.message || error);

  }



  return undefined;

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



  return onSnapshot(

    q,

    async (querySnapshot: any) => {



      // Deduplicate by conversation id to keep React Native reconciliation stable

      const byId = new Map<string, Conversation>();



      for (const docSnap of querySnapshot.docs) {

        const id = docSnap.id;

        const data = docSnap.data();



        const baseConversation: Conversation = {

          ...mapConversationDoc(id, data),

          unreadCount: data.supplierUnreadCount ?? data.unreadCount ?? 0,

        };



        // Resolve phone number without mutating after insertion

        let consumerPhone = data.consumerPhone as string | undefined;

        if (!consumerPhone) {

          consumerPhone = await getConsumerPhoneNumber(data.consumerId);

        }



        const finalConversation: Conversation = {

          ...baseConversation,

          ...(consumerPhone ? { consumerPhone } : {}),

        };



        byId.set(id, finalConversation);

      }



      callback(Array.from(byId.values()));

    },

    (error: any) => {

      console.error(

        '[Chat] subscribeToSupplierConversations error:',

        error?.code,

        error?.message

      );

      callback([]);

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



// Delete conversation (for "Mark as Delivered")

export const deleteConversation = async (conversationId: string): Promise<{ success: boolean; error?: string }> => {

  try {

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

    await deleteDoc(conversationRef);

    return { success: true };

  } catch (error: any) {

    console.error('Delete conversation error:', error);

    return {

      success: false,

      error: error.message || 'Failed to delete conversation.',

    };

  }

};



export const updateConsumerLiveLocation = async (

  conversationId: string,

  location: { latitude: number; longitude: number; address?: string }

): Promise<{ success: boolean; error?: string }> => {

  if (!conversationId?.trim()) {

    return { success: false, error: 'Missing conversation id.' };

  }



  try {

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

    const payload = {

      consumerLiveLocation: {

        latitude: location.latitude,

        longitude: location.longitude,

        ...(location.address ? { address: location.address } : {}),

      },

      consumerLiveLocationUpdatedAt: serverTimestamp(),

      consumerLiveLocationSharing: true,

      updatedAt: serverTimestamp(),

    };



    const existing = await getDoc(conversationRef);

    if (!existing.exists()) {

      return { success: false, error: 'Order conversation not found. Please place the order again.' };

    }



    await setDoc(conversationRef, payload, { merge: true });

    return { success: true };

  } catch (error: any) {

    if (isOfflineError(error)) {

      return { success: true };

    }

    console.error('[Chat] Update consumer live location error:', error?.code, error?.message);

    return {

      success: false,

      error: error.message || 'Failed to update live location.',

    };

  }

};



/** Stops active sharing but keeps the last saved coordinates in Firestore. */

export const stopConsumerLiveLocationSharing = async (

  conversationId: string

): Promise<{ success: boolean; error?: string }> => {

  try {

    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

    await updateDoc(conversationRef, {

      consumerLiveLocationSharing: false,

      updatedAt: serverTimestamp(),

    });

    return { success: true };

  } catch (error: any) {

    if (isOfflineError(error)) {

      return { success: true };

    }

    console.error('Stop consumer live location sharing error:', error);

    return {

      success: false,

      error: error.message || 'Failed to stop sharing live location.',

    };

  }

};



export const subscribeToConversation = (

  conversationId: string,

  callback: (conversation: Conversation | null) => void

) => {

  if (!conversationId?.trim()) {

    callback(null);

    return () => {};

  }



  const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);



  return onSnapshot(

    conversationRef,

    (snapshot: any) => {

      if (!snapshot.exists()) {

        callback(null);

        return;

      }

      callback(mapConversationDoc(snapshot.id, snapshot.data()));

    },

    (error: any) => {

      console.error('[Chat] subscribeToConversation error:', error?.code, error?.message);

      callback(null);

    }

  );

};


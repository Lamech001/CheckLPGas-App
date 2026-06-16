import { db } from '@/config/firebase';

import {
  CACHE_TTL,

  getCache,

  removeCache,

  setCache
} from '@/services/enhancedCache';

import * as Haptics from 'expo-haptics';

import {
  addDoc,

  collection,

  doc,

  getDocs,

  onSnapshot,

  orderBy,

  query,

  serverTimestamp,

  updateDoc,

  where,
} from 'firebase/firestore';



export interface Notification {

  id: string;

  userId: string;

  title: string;

  body: string;

  type: 'order' | 'message' | 'alert' | 'system';

  read: boolean;

  data?: any;

  createdAt: any;

}



type NotificationCallback = (notifications: Notification[]) => void;

type UnreadCountCallback = (count: number) => void;



// Helper function to invalidate notification cache for a user

const invalidateNotificationCache = async (userId: string): Promise<void> => {

  const cacheKey = `notifications:${userId}`;

  try {

    await removeCache(cacheKey);

  } catch (error) {

    console.error('[Notifications] Cache invalidation error:', error);

  }

};



// Subscribe to real-time notifications for a user

export const subscribeToNotifications = (

  userId: string,

  onNotifications: NotificationCallback,

  onError?: (error: Error) => void

): (() => void) => {

  const notificationsRef = collection(db, 'notifications');

  const cacheKey = `notifications:${userId}`;

  let initialCallbackFired = false;



  // Get cached notifications first for instant display

  const cachedPromise = getCache<Notification[]>(cacheKey);

  cachedPromise

    .then((cached) => {

      if (cached && !initialCallbackFired) {

        onNotifications(cached);

      }

    })

    .catch((error) => {

      console.error('[Notifications] Cache read error:', error);

      // Continue with real-time fetch even if cache fails

    });



  const q = query(

    notificationsRef,

    where('userId', '==', userId),

    orderBy('createdAt', 'desc')

  );



  const unsubscribe = onSnapshot(

    q,

    (snapshot: any) => {

      initialCallbackFired = true;

      const notifications: Notification[] = [];

      snapshot.forEach((doc: any) => {

        notifications.push({

          id: doc.id,

          ...doc.data(),

        } as Notification);

      });



      // Update cache with fresh data

      setCache(cacheKey, notifications, {

        ttl: CACHE_TTL.USER.NOTIFICATIONS,

        persistent: true,

        maxAge: Infinity,

      }).catch((error) => {

        console.error('[Notifications] Cache write error:', error);

      });



      onNotifications(notifications);

    },

    (error: any) => {

      console.error('[Notifications] Subscription error:', error);

      onError?.(error);

    }

  );



  return unsubscribe;

};



// Subscribe to unread count only

export const subscribeToUnreadCount = (

  userId: string,

  onCount: UnreadCountCallback

): (() => void) => {

  const notificationsRef = collection(db, 'notifications');

  const q = query(

    notificationsRef,

    where('userId', '==', userId),

    where('read', '==', false)

  );



  const unsubscribe = onSnapshot(

    q,

    (snapshot: any) => {

      const count = snapshot.size;

      onCount(count);

    },

    (error: any) => {

      console.error('[Notifications] subscribeToUnreadCount error:', error);

      onCount(0);

    }

  );



  return unsubscribe;

};







// Mark notification as read

export const markNotificationAsRead = async (

  notificationId: string,

  userId?: string

): Promise<void> => {

  const notificationRef = doc(db, 'notifications', notificationId);

  await updateDoc(notificationRef, {

    read: true,

    updatedAt: serverTimestamp(),

  });



  // Invalidate cache if userId is provided

  if (userId) {

    await invalidateNotificationCache(userId);

  }

};



// Mark all notifications as read

export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {

  const notificationsRef = collection(db, 'notifications');

  const q = query(

    notificationsRef,

    where('userId', '==', userId),

    where('read', '==', false)

  );



  const snapshot = await getDocs(q);

  const promises = snapshot.docs.map((doc: any) =>

    updateDoc(doc.ref, {

      read: true,

      updatedAt: serverTimestamp(),

    })

  );



  await Promise.all(promises);



  // Invalidate cache after marking all as read

  await invalidateNotificationCache(userId);

};



// Create a notification (for internal use or testing)

export const createNotification = async (

  userId: string,

  title: string,

  body: string,

  type: Notification['type'],

  data?: any

): Promise<string | null> => {

  try {

    const notificationsRef = collection(db, 'notifications');

    const docRef = await addDoc(notificationsRef, {

      userId,

      title,

      body,

      type,

      read: false,

      data,

      createdAt: serverTimestamp(),

    });



    // Haptic feedback for new notification

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);



    // Invalidate cache to trigger refresh

    await invalidateNotificationCache(userId);



    return docRef.id;

  } catch (error) {

    console.error('[Notifications] Create notification error:', error);

    return null;

  }

};



// Get notification icon based on type

export const getNotificationIcon = (type: Notification['type']): string => {

  switch (type) {

    case 'order':

      return 'shopping-bag';

    case 'message':

      return 'comment';

    case 'alert':

      return 'exclamation-circle';

    case 'system':

      return 'info-circle';

    default:

      return 'bell';

  }

};



// Get notification color based on type

export const getNotificationColor = (type: Notification['type']): string => {

  switch (type) {

    case 'order':

      return '#4CAF50';

    case 'message':

      return '#2196F3';

    case 'alert':

      return '#FF6B35';

    case 'system':

      return '#9E9E9E';

    default:

      return '#666';

  }

};


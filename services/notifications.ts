import { db } from '@/config/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import * as Haptics from 'expo-haptics';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'message' | 'alert' | 'system';
  read: boolean;
  data?: any;
  createdAt: Timestamp;
}

type NotificationCallback = (notifications: Notification[]) => void;
type UnreadCountCallback = (count: number) => void;

// Subscribe to real-time notifications for a user
export const subscribeToNotifications = (
  userId: string,
  onNotifications: NotificationCallback,
  onError?: (error: Error) => void
): (() => void) => {
  const notificationsRef = collection(db, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications: Notification[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data(),
        } as Notification);
      });
      onNotifications(notifications);
    },
    (error) => {
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

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const count = snapshot.size;
    onCount(count);
  });

  return unsubscribe;
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
    updatedAt: serverTimestamp(),
  });
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
  const promises = snapshot.docs.map((doc) =>
    updateDoc(doc.ref, {
      read: true,
      updatedAt: serverTimestamp(),
    })
  );

  await Promise.all(promises);
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

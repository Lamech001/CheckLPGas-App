import { auth, db } from '@/config/firebase';

import * as Notifications from 'expo-notifications';

import { doc, setDoc } from 'firebase/firestore';

import { Platform } from 'react-native';

// @ts-ignore - @react-native-firebase/messaging types may not be properly recognized
let messaging: any;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (e) {
  console.warn('[Notifications] Firebase messaging not available:', e);
  messaging = null;
}




// Configure notification behavior

Notifications.setNotificationHandler({

  handleNotification: async () => ({

    shouldPlaySound: true,

    shouldSetBadge: true,

    shouldShowBanner: true,

    shouldShowList: true,

  } as Notifications.NotificationBehavior),

});



// Kenyan-themed notification config

const KENYAN_CONFIG = {

  senderId: '61fd7208-df41-4f19-a225-3b3b1ef11382', // Expo project ID from app.json

  defaultTitle: 'GasAround Kenya',

  defaultBody: 'New supplier available near you!',

  sound: 'default',

  color: '#4CAF50', // Kenyan green

};



export const requestNotificationPermissions = async (): Promise<boolean> => {

  try {

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    

    if (existingStatus !== 'granted') {

      const { status } = await Notifications.requestPermissionsAsync();

      finalStatus = status;

    }

    

    if (finalStatus !== 'granted') {

      return false;

    }

    

    return true;

  } catch {

    return false;

  }

};



export const getPushToken = async (): Promise<string | null> => {
  try {
    // Use Firebase Cloud Messaging for native Android/iOS
    if (Platform.OS !== 'web') {
      // Check if messaging is available
      if (!messaging) {
        console.warn('[Notifications] Firebase messaging not available, falling back to Expo');
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: KENYAN_CONFIG.senderId,
        });
        return token.data;
      }

      // @ts-ignore
      const authStatus = await messaging().requestPermission();
      const enabled =
        // @ts-ignore
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        // @ts-ignore
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[Notifications] Push notification permission not granted');
        return null;
      }

      // @ts-ignore
      const token = await messaging().getToken();
      console.log('[Notifications] FCM token obtained:', token);
      return token;
    }
    
    // Fallback to Expo push token for web
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: KENYAN_CONFIG.senderId,
    });
    return token.data;
  } catch (error) {
    console.error('[Notifications] Error getting push token:', error);
    return null;
  }
};



export const savePushTokenToFirestore = async (token: string): Promise<void> => {

  const user = auth.currentUser;

  if (!user) return;

  

  try {

    await setDoc(doc(db, 'users', user.uid), {

      pushToken: token,

      platform: Platform.OS,

      updatedAt: new Date(),

    }, { merge: true });

  } catch {

    // Silently handle

  }

};



export const setupNotifications = async (): Promise<void> => {

  const hasPermission = await requestNotificationPermissions();

  if (!hasPermission) return;

  

  const token = await getPushToken();

  if (token) {

    await savePushTokenToFirestore(token);

  }

};



export const notificationListeners = (

  onNotification: (notification: Notifications.Notification) => void,

  onResponse: (response: Notifications.NotificationResponse) => void

) => {
  // Firebase Cloud Messaging listener for when app is in foreground
  let unsubscribeFirebase: () => void = () => {};
  
  if (messaging && Platform.OS !== 'web') {
    try {
      const messagingInstance = messaging();
      if (!messagingInstance) {
        console.warn('[Notifications] Firebase messaging instance not available');
      } else {
        // @ts-ignore
        unsubscribeFirebase = messagingInstance.onMessage(async (remoteMessage: any) => {
          console.log('[Notifications] FCM message received in foreground:', remoteMessage);
          
          // Display local notification when app is in foreground
          if (remoteMessage.notification) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: remoteMessage.notification.title || KENYAN_CONFIG.defaultTitle,
                body: remoteMessage.notification.body || KENYAN_CONFIG.defaultBody,
                data: remoteMessage.data || {},
                sound: true,
                color: KENYAN_CONFIG.color,
              },
              trigger: null,
            });
          }
        });

        // Handle notification when app is opened from background
        // @ts-ignore
        messagingInstance.onNotificationOpenedApp(async (remoteMessage: any) => {
          console.log('[Notifications] Notification caused app to open from background:', remoteMessage);
          // Handle navigation based on notification data
        });

        // Check if app was opened from a notification when it was quit
        // @ts-ignore
        messagingInstance.getInitialNotification().then(async (remoteMessage: any) => {
          if (remoteMessage) {
            console.log('[Notifications] Notification caused app to open from quit state:', remoteMessage);
            // Handle navigation based on notification data
          }
        });
      }
    } catch (error) {
      console.warn('[Notifications] Firebase messaging listeners not available:', error);
    }
  }

  // Notification received while app is running (Expo)
  const subscription1 = Notifications.addNotificationReceivedListener((notification) => {
    onNotification(notification);
  });

  // User tapped notification (Expo)
  const subscription2 = Notifications.addNotificationResponseReceivedListener((response) => {
    onResponse(response);
  });

  return () => {
    unsubscribeFirebase();
    subscription1.remove();
    subscription2.remove();
  };
};



export const sendLocalNotification = async (

  title: string,

  body: string,

  data?: Record<string, any>

): Promise<void> => {

  await Notifications.scheduleNotificationAsync({

    content: {

      title: title || KENYAN_CONFIG.defaultTitle,

      body: body || KENYAN_CONFIG.defaultBody,

      data: data || {},

      sound: true,

      color: KENYAN_CONFIG.color,

    },

    trigger: null, // Show immediately

  });

};



export const scheduleNewSupplierNotification = async (

  supplierName: string,

  distance: string

): Promise<void> => {

  await sendLocalNotification(

    'New Supplier Available!',

    `${supplierName} is now available ${distance} from your location.`,

    { type: 'new_supplier', supplierName }

  );

};



// Send new order notification to supplier

export const sendNewOrderNotification = async (

  supplierId: string,

  supplierName: string,

  orderDetails: {

    cylinderSize: string;

    gasType: string;

    quantity: string;

    customerName: string;

  },

  // Optional: conversation id so we can deep-link straight into the order chat

  conversationId?: string

): Promise<void> => {

  try {

    // 1. Save notification to Firestore for supplier

    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');



    await addDoc(collection(db, 'notifications'), {

      userId: supplierId,

      title: 'New Order Received!',

      body: `${orderDetails.customerName} ordered ${orderDetails.quantity}x ${orderDetails.cylinderSize} (${orderDetails.gasType})`,

      type: 'order',

      read: false,

      data: {

        type: 'new_order',

        supplierId,

        supplierName,

        orderDetails,

        conversationId: conversationId || null,

      },

      createdAt: serverTimestamp(),

    });



    // 2. Trigger local notification if app is open (supplier is active)

    await sendLocalNotification(

      'New Order Received!',

      `${orderDetails.customerName} ordered ${orderDetails.quantity}x ${orderDetails.cylinderSize} ${orderDetails.gasType}`,

      { type: 'new_order', supplierId, conversationId: conversationId || null }

    );

  } catch (error) {

    console.error('[Notifications] Error sending new order notification:', error);

  }

};




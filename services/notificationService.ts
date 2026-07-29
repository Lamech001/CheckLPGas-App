import { auth, db } from "@/config/firebase";

import * as Notifications from "expo-notifications";

import { doc, setDoc } from "firebase/firestore";

import { Platform } from "react-native";

// Intentionally do NOT import/require @react-native-firebase/messaging here.
// This app uses Expo push tokens via expo-notifications.
// Requiring RN Firebase messaging in this process can throw:
// "Default FirebaseApp is not initialized..." if FirebaseApp.initializeApp(...) hasn't run yet.

// @ts-ignore (kept for potential future use)
let messaging: any = null;

// Configure notification behavior

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldPlaySound: true,

      shouldSetBadge: true,

      shouldShowBanner: true,

      shouldShowList: true,
    }) as Notifications.NotificationBehavior,
});

// Kenyan-themed notification config

const KENYAN_CONFIG = {
  // Expo Notifications expects the Expo projectId (used for V1 push token lookup).
  // Your `eas.json`/`app.json` extra.eas.projectId is the correct value here.
  projectId: "61fd7208-df41-4f19-a225-3b3b1ef11382",

  defaultTitle: "GasAround Kenya",

  defaultBody: "New supplier available near you!",

  sound: "default",

  color: "#4CAF50", // Kenyan green
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

export const getPushToken = async (): Promise<string | null> => {
  try {
    // Expo push token for both native and web.
    // Using expo-notifications avoids @react-native-firebase app initialization issues.
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: KENYAN_CONFIG.projectId,
    });
    return token.data;
  } catch (error) {
    console.error("[Notifications] Error getting push token:", error);
    return null;
  }
};

export const savePushTokenToFirestore = async (
  token: string,
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) return;

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        pushToken: token,

        platform: Platform.OS,

        updatedAt: new Date(),
      },
      { merge: true },
    );
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

  onResponse: (response: Notifications.NotificationResponse) => void,
) => {
  // Expo notification listeners handle foreground + user interaction.

  // Notification received while app is running (Expo)
  const subscription1 = Notifications.addNotificationReceivedListener(
    (notification) => {
      onNotification(notification);
    },
  );

  // User tapped notification (Expo)
  const subscription2 = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      onResponse(response);
    },
  );

  return () => {
    subscription1.remove();
    subscription2.remove();
  };
};

export const sendLocalNotification = async (
  title: string,

  body: string,

  data?: Record<string, any>,
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

  distance: string,
): Promise<void> => {
  await sendLocalNotification(
    "New Supplier Available!",

    `${supplierName} is now available ${distance} from your location.`,

    { type: "new_supplier", supplierName },
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

  conversationId?: string,
): Promise<void> => {
  try {
    // Save notification to Firestore for supplier
    // Supplier will receive this via their push token/Firebase Cloud Messaging
    // or by polling the notifications collection

    const { collection, addDoc, serverTimestamp } =
      await import("firebase/firestore");

    await addDoc(collection(db, "notifications"), {
      userId: supplierId,

      title: "New Order Received!",

      body: `${orderDetails.customerName} ordered ${orderDetails.quantity}x ${orderDetails.cylinderSize} (${orderDetails.gasType})`,

      type: "order",

      read: false,

      data: {
        type: "new_order",

        supplierId,

        supplierName,

        orderDetails,

        conversationId: conversationId || null,
      },

      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(
      "[Notifications] Error sending new order notification:",
      error,
    );
  }
};

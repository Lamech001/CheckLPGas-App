import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

admin.initializeApp();

const expoPushSendUrl = 'https://exp.host/--/api/v2/push/send';

// Enhanced logging for debugging
functions.logger.info('Cloud Function initialized: onNewOrderNotificationWritten');

type OrderNotificationPayload = {
  type: 'new_order';
  supplierId: string;
  supplierName?: string;
  orderDetails?: {
    cylinderSize?: string;
    gasType?: string;
    quantity?: string;
    customerName?: string;
  };
  conversationId?: string | null;
};

export const onNewOrderNotificationWritten = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap: any) => {
    const data = snap.data() as any;
    if (!data) return;

    functions.logger.info('New notification document created', {
      notificationId: snap.id,
      userId: data.userId,
      type: data.type,
      pushDataType: data?.data?.type,
    });

    // Only handle our new order notifications
    if (data.type !== 'order') {
      functions.logger.info('Skipping non-order notification', { type: data.type });
      return;
    }

    const pushData = (data.data || {}) as Partial<OrderNotificationPayload>;
    if (pushData.type !== 'new_order') {
      functions.logger.info('Skipping non-new-order notification', { pushDataType: pushData.type });
      return;
    }

    const supplierId = pushData.supplierId || data.userId;
    if (!supplierId) {
      functions.logger.error('No supplierId found in notification', { pushData, data });
      return;
    }

    functions.logger.info('Processing new order notification', { supplierId });

    // Fetch supplier push token
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(supplierId)
      .get();

    const userData = userDoc.data();
    const pushToken = userData?.pushToken;

    if (!pushToken || typeof pushToken !== 'string') {
      functions.logger.warn('No push token found for supplier', {
        supplierId,
        hasUserData: !!userData,
        pushToken: pushToken ? 'exists' : 'missing',
      });
      return;
    }

    const orderDetails = pushData.orderDetails || {};
    const customerName = orderDetails.customerName || 'Customer';
    const quantity = orderDetails.quantity || '1';
    const cylinderSize = orderDetails.cylinderSize || '';
    const gasType = orderDetails.gasType || '';

    const title = 'New Order Received!';
    const body = `${customerName} ordered ${quantity}x ${cylinderSize}${
      gasType ? ' ' + gasType : ''
    }`.trim();

    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: 'new_order',
        supplierId,
        conversationId: pushData.conversationId || null,
      },
    };

    functions.logger.info('Sending Expo push notification', {
      supplierId,
      pushToken: pushToken.substring(0, 10) + '...',
    });

    try {
      const res = await fetch(expoPushSendUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        functions.logger.error('Expo push send failed', {
          supplierId,
          status: res.status,
          body: errorBody,
        });
        return;
      }

      const responseData = await res.json();
      functions.logger.info('Expo push sent successfully', {
        supplierId,
        status: res.status,
        responseData,
      });
    } catch (error) {
      functions.logger.error('Error sending Expo push notification', {
        supplierId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });


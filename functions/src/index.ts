import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

admin.initializeApp();

const expoPushSendUrl = 'https://exp.host/--/api/v2/push/send';

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
    if (data.type !== 'order') return;

    const pushData = (data.data || {}) as Partial<OrderNotificationPayload>;
    if (pushData.type !== 'new_order') return;

    const supplierId = pushData.supplierId || data.userId;
    if (!supplierId) return;

    // Fetch supplier push token
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(supplierId)
      .get();

    const userData = userDoc.data();
    const pushToken = userData?.pushToken;

    if (!pushToken || typeof pushToken !== 'string') {
      // No token saved - can't send push.
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

    const res = await fetch(expoPushSendUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      functions.logger.error('Expo push send failed', {
        supplierId,
        status: res.status,
        body: await res.text(),
      });
      return;
    }

    functions.logger.info('Expo push sent', { supplierId, status: res.status });
  });


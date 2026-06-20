"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onNewOrderNotificationWritten = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const node_fetch_1 = __importDefault(require("node-fetch"));
admin.initializeApp();
const expoPushSendUrl = 'https://exp.host/--/api/v2/push/send';
// Enhanced logging for debugging
functions.logger.info('Cloud Function initialized: onNewOrderNotificationWritten');
exports.onNewOrderNotificationWritten = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
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
    const pushData = (data.data || {});
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
    const body = `${customerName} ordered ${quantity}x ${cylinderSize}${gasType ? ' ' + gasType : ''}`.trim();
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
        const res = await (0, node_fetch_1.default)(expoPushSendUrl, {
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
    }
    catch (error) {
        functions.logger.error('Error sending Expo push notification', {
            supplierId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});

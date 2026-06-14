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
    if (data.type !== 'order')
        return;
    const pushData = (data.data || {});
    if (pushData.type !== 'new_order')
        return;
    const supplierId = pushData.supplierId || data.userId;
    if (!supplierId)
        return;
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
    const res = await (0, node_fetch_1.default)(expoPushSendUrl, {
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

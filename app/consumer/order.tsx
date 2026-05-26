import { AppStatusBar } from '@/components/AppStatusBar';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  getOrCreateConversation,
  sendMessage,
  stopConsumerLiveLocationSharing,
  updateConsumerLiveLocation,
} from '@/services/chatService';
import * as Location from 'expo-location';
import { sendNewOrderNotification } from '@/services/notificationService';
import { SupplierWithDistance } from '@/services/types/supplier';
import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type OrderStep = 'cylinder_size' | 'gas_type' | 'quantity' | 'address' | 'confirm';
type GasType = 'LPG' | 'BioGas' | 'Natural Gas' | 'Cooking Gas';
type CylinderSize = '6kg' | '13kg' | '19kg';


interface OrderData {
  cylinderSize: CylinderSize | null;
  gasType: GasType | null;
  quantity: string;
  address: string;
}

interface ChatMessage {
  id: string;
  isSystem: boolean;
  text: string;
  options?: string[];
}

const CYLINDER_SIZES: CylinderSize[] = ['6kg', '13kg', '19kg'];

const GAS_TYPES: GasType[] = ['LPG', 'BioGas', 'Natural Gas', 'Cooking Gas'];

const STEP_PROMPTS: Record<OrderStep, string> = {
  cylinder_size: "Select cylinder size",
  gas_type: "Select type of gas",
  quantity: "Enter quantity",
  address: "Provide delivery address or location",
  confirm: "Confirm order",
};

export default function OrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const supplierData = params.supplier ? JSON.parse(params.supplier as string) as SupplierWithDistance : null;
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentUser = auth.currentUser;
  const [orderData, setOrderData] = useState<OrderData>({
    cylinderSize: null,
    gasType: null,
    quantity: '',
    address: '',
  });
  const [currentStep, setCurrentStep] = useState<OrderStep>('cylinder_size');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      isSystem: true,
      text: `Welcome! Let's place your order for ${supplierData?.enterpriseName || 'gas delivery'}.\n\n${STEP_PROMPTS.cylinder_size}:`,
      options: CYLINDER_SIZES,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [locationPermission, setLocationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [orderLocation, setOrderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationUpdateRef = useRef<number>(0);
  const conversationIdRef = useRef<string>('');

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      // Keep last saved location in Firestore when the app closes or user goes offline.
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [currentStep]);

  const initConversation = async () => {
    if (!currentUser || !supplierData) return;

    const conversationPayload: any = {
      consumerId: currentUser.uid,
      consumerName: currentUser.displayName || 'Consumer',
      supplierId: supplierData.uid,
      supplierName: supplierData.fullName || supplierData.enterpriseName,
      supplierEnterpriseName: supplierData.enterpriseName,
    };

    console.log('[Order] Creating conversation with payload:', JSON.stringify(conversationPayload));

    // Try to get phone from Firebase Auth first, fall back to Firestore
    if (currentUser.phoneNumber) {
      conversationPayload.consumerPhone = currentUser.phoneNumber;
    } else {
      // Fetch from Firestore users collection
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.phoneNumber) {
            conversationPayload.consumerPhone = userData.phoneNumber;
          }
        }
      } catch (e) {
        console.log('Could not fetch phone from Firestore');
      }
    }

    console.log('[Order][Debug] currentUser.uid:', currentUser.uid);
    console.log('[Order][Debug] supplierData.uid:', supplierData.uid);

    const result = await getOrCreateConversation(conversationPayload);
    console.log('[Order][Debug] conversationId result:', result);

    if (result.success && result.conversationId) {
      setConversationId(result.conversationId);
      conversationIdRef.current = result.conversationId;
    }
  };

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const addMessage = (text: string, options?: string[], isSystem = true) => {
    setMessages(prev => {
      // Use a monotonic id to avoid duplicate keys when messages are added in the same ms
      const id = `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return [
        ...prev,
        {
          id,
          isSystem,
          text,
          options,
        },
      ];
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleCylinderSelection = (size: CylinderSize) => {
    setOrderData(prev => ({ ...prev, cylinderSize: size }));
    addMessage(`✓ I need a ${size} cylinder`, [], false);
    setTimeout(() => {
      addMessage('Enter LPG brand name (e.g., PRO Gas, K-Gas, Afrigas, Gas Plex):');
      setCurrentStep('gas_type');
    }, 300);
  };

  const submitGasType = () => {
    const gasType = inputText.trim();
    if (!gasType) {
      Alert.alert('Invalid Gas Type', 'Please enter the type of gas you need');
      return;
    }
    setOrderData(prev => ({ ...prev, gasType: gasType as GasType }));
    addMessage(`✓ Gas type: ${gasType}`, [], false);
    setInputText('');
    setTimeout(() => {
      addMessage(STEP_PROMPTS.quantity + ':', ['1', '2', '3', '4', '5']);
      setCurrentStep('quantity');
    }, 300);
  };

  const handleQuantityInput = (qty: string) => {
    setInputText(qty);
  };

  const submitQuantity = () => {
    const qty = inputText.trim();
    if (!qty || parseInt(qty) < 1) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity number');
      return;
    }
    setOrderData(prev => ({ ...prev, quantity: qty }));
    addMessage(`✓ Quantity: ${qty} cylinder(s)`, [], false);
    setInputText('');
    setTimeout(() => {
      addMessage(STEP_PROMPTS.address + ':');
      setCurrentStep('address');
    }, 300);
  };

  const submitAddress = () => {
    const addr = inputText.trim();
    if (!addr) {
      Alert.alert('Invalid Address', 'Please provide a delivery address');
      return;
    }
    setOrderData(prev => ({ ...prev, address: addr }));
    addMessage(`✓ Delivery address: ${addr}`, [], false);
    setInputText('');
    setTimeout(() => {
      showConfirmation();
    }, 300);
  };

  const showConfirmation = () => {
    const { cylinderSize, gasType, quantity, address } = orderData;
    const confirmationText = `\n📋 Order Summary:\n━━━━━━━━━━━━━━━\n🔵 Cylinder Size: ${cylinderSize}\n🟡 Gas Type: ${gasType}\n🔢 Quantity: ${quantity}\n📍 Delivery: ${address}\n━━━━━━━━━━━━━━━\n\nReady to submit this order?`;
    addMessage(confirmationText, ['✓ Confirm Order', '✗ Start Over']);
    setCurrentStep('confirm');
  };

  const handleConfirmOrder = async () => {
    if (!currentUser || !supplierData) return;

    setIsSubmitting(true);
    addMessage('⏳ Submitting your order...', [], false);

    const { cylinderSize, gasType, quantity, address } = orderData;
    const orderMessage = `NEW ORDER:\n• Cylinder Size: ${cylinderSize}\n• Gas Type: ${gasType}\n• Quantity: ${quantity}\n• Delivery Address: ${address}`;

    if (conversationId) {
      console.log('[Order] Sending message to conversation:', conversationId);
      const msgResult = await sendMessage({
        conversationId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'Consumer',
        senderRole: 'consumer',
        text: orderMessage,
      });
      console.log('[Order] Message sent:', msgResult.success, 'msgId:', msgResult.messageId);

      // Notify supplier about new order
      // Ensure we notify using the supplierId from the conversation doc
      // (not the supplier object coming from route params).
      await sendNewOrderNotification(
        supplierData.uid,
        supplierData.enterpriseName,
        {
          cylinderSize: cylinderSize || '',
          gasType: gasType || '',
          quantity: quantity,
          customerName: currentUser.displayName || 'Customer',
        },
        conversationId
      );

      // Also ensure conversation is updated with lastMessage so supplier orders list is consistent
      // (in case notification arrived but chat write was delayed)
      // Note: sendMessage already updates lastMessage + supplierUnreadCount.

    }

    setIsSubmitting(false);
    addMessage('✅ Order submitted successfully! The supplier will contact you shortly.', [], false);
    addMessage('Share your live location so the supplier can find you easily for delivery.', [], true);

    promptShareLocationAfterOrder();
  };

  const promptShareLocationAfterOrder = () => {
    if (isSharingLocation) return;

    Alert.alert(
      'Share location for delivery?',
      'Help your supplier track your order easily. Your last location is saved even if you go offline later.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Share location',
          onPress: () => startSharingLiveLocation(),
        },
      ]
    );
  };

  const stopSharingLiveLocation = async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsSharingLocation(false);

    if (conversationIdRef.current) {
      const result = await stopConsumerLiveLocationSharing(conversationIdRef.current);
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to stop sharing location.');
      } else {
        addMessage(
          'Live sharing stopped. Your last location is still saved for the supplier.',
          [],
          true
        );
      }
    }
  };

  const ensureConversationId = async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    if (!currentUser || !supplierData) return null;

    const result = await getOrCreateConversation({
      consumerId: currentUser.uid,
      consumerName: currentUser.displayName || 'Consumer',
      supplierId: supplierData.uid,
      supplierName: supplierData.fullName || supplierData.enterpriseName,
      supplierEnterpriseName: supplierData.enterpriseName,
    });

    if (result.success && result.conversationId) {
      setConversationId(result.conversationId);
      conversationIdRef.current = result.conversationId;
      return result.conversationId;
    }

    return null;
  };

  const pushCurrentLocation = async (): Promise<boolean> => {
    const activeConversationId = await ensureConversationId();
    if (!activeConversationId) {
      Alert.alert('Error', 'Could not find your order conversation. Please submit the order first.');
      return false;
    }

    const currentPosition = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords = {
      latitude: currentPosition.coords.latitude,
      longitude: currentPosition.coords.longitude,
    };
    setOrderLocation(coords);

    const result = await updateConsumerLiveLocation(activeConversationId, {
      ...coords,
      address: orderData.address || undefined,
    });

    if (!result.success) {
      Alert.alert('Location not saved', result.error || 'Could not send location to supplier.');
      return false;
    }

    return true;
  };

  const startSharingLiveLocation = async () => {
    const activeConversationId = await ensureConversationId();
    if (!activeConversationId) {
      Alert.alert('Order Not Ready', 'Please submit your order first, then share live location.');
      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    const granted = permission.status === 'granted';
    setLocationPermission(granted ? 'granted' : 'denied');
    if (!granted) {
      Alert.alert('Permission Required', 'Location permission is needed to share live location.');
      return;
    }

    try {
      const saved = await pushCurrentLocation();
      if (!saved) return;

      setIsSharingLocation(true);
      addMessage('📍 Live location is now shared with your supplier.', [], true);

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 20,
        },
        async (position) => {
          const now = Date.now();
          if (now - lastLocationUpdateRef.current < 8000) return;
          lastLocationUpdateRef.current = now;

          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setOrderLocation(coords);

          const cid = conversationIdRef.current;
          if (!cid) return;

          await updateConsumerLiveLocation(cid, {
            ...coords,
            address: orderData.address || undefined,
          });
        }
      );
    } catch (error) {
      console.error('Start live location sharing error:', error);
      Alert.alert('Error', 'Unable to start live location sharing.');
      setIsSharingLocation(false);
    }
  };

  const toggleLiveLocationSharing = async () => {
    if (isSharingLocation) {
      await stopSharingLiveLocation();
      return;
    }
    await startSharingLiveLocation();
  };

  const handleStartOver = () => {
    setOrderData({ cylinderSize: null, gasType: null, quantity: '', address: '' });
    setMessages([{
      id: 'welcome',
      isSystem: true,
      text: `Let's place a new order!\n\n${STEP_PROMPTS.cylinder_size}:`,
      options: CYLINDER_SIZES,
    }]);
    setCurrentStep('cylinder_size');
    setInputText('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.isSystem) {
      return (
        <Animated.View style={[styles.systemMessageContainer, { opacity: fadeAnim }]}>
          <View style={styles.botAvatar}>
            <FontAwesome5 name="robot" size={16} color="#fff" />
          </View>
          <View style={styles.systemBubble}>
            <Text style={styles.systemText}>{item.text}</Text>
            {item.options && item.options.length > 0 && (
              <View style={styles.optionsContainer}>
                {item.options.map((option, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.optionButton}
                    onPress={() => handleOptionPress(option)}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      );
    }

    return (
      <View style={styles.userMessageContainer}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
        <View style={styles.userAvatar}>
          <FontAwesome5 name="user" size={14} color="#fff" />
        </View>
      </View>
    );
  };

  const handleOptionPress = (option: string) => {
    switch (currentStep) {
      case 'cylinder_size':
        if (CYLINDER_SIZES.includes(option as CylinderSize)) {
          handleCylinderSelection(option as CylinderSize);
        }
        break;
      case 'gas_type':
        if (GAS_TYPES.includes(option as GasType)) {
          // Selecting a gas type sets the input and proceeds to quantity step
          setOrderData(prev => ({ ...prev, gasType: option as GasType }));
          addMessage(`✓ Gas type: ${option}`, [], false);
          addMessage(STEP_PROMPTS.quantity + ':', ['1', '2', '3', '4', '5']);
          setCurrentStep('quantity');
        }
        break;
      case 'confirm':
        if (option.includes('Confirm')) {
          handleConfirmOrder();
        } else if (option.includes('Start Over')) {
          handleStartOver();
        }
        break;
    }
  };

  const handleQuickReply = (value: string) => {
    if (currentStep === 'quantity') {
      setInputText(value);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingRoot}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -40}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        
        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{supplierData?.enterpriseName || 'Order'}</Text>
            <Text style={styles.headerSubtitle}>Chat-style Ordering</Text>
          </View>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>{currentStep === 'confirm' ? '✓' : '●'}</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {(['cylinder_size', 'gas_type', 'quantity', 'address'] as OrderStep[]).map((step, idx) => (
            <View key={step} style={styles.progressItem}>
              <View style={[
                styles.progressDot,
                (['cylinder_size', 'gas_type', 'quantity', 'address', 'confirm'] as OrderStep[]).indexOf(currentStep) >= idx
                  ? styles.progressDotActive
                  : null
              ]} />
              {idx < 3 && <View style={styles.progressLine} />}
            </View>
          ))}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messageList}
          contentContainerStyle={[styles.messagesContainer, { flexGrow: 1, paddingBottom: 0 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input Area */}
        <View style={[styles.inputWrapper, { paddingBottom: insets.bottom + -35 }]}>
          {currentStep === 'confirm' && (
            <View style={styles.liveLocationContainer}>
              <Text style={styles.liveLocationLabel}>
                {isSharingLocation
                  ? 'Live location is being shared with supplier.'
                  : 'Share live location to help supplier track delivery.'}
              </Text>
              <TouchableOpacity
                style={[
                  styles.liveLocationButton,
                  isSharingLocation ? styles.liveLocationButtonStop : styles.liveLocationButtonStart,
                ]}
                onPress={toggleLiveLocationSharing}
              >
                <FontAwesome5 name={isSharingLocation ? 'stop-circle' : 'location-arrow'} size={14} color="#fff" />
                <Text style={styles.liveLocationButtonText}>
                  {isSharingLocation ? 'Stop Sharing' : 'Share Live Location'}
                </Text>
              </TouchableOpacity>
              {orderLocation && (
                <Text style={styles.liveLocationMeta}>
                  {`Last: ${orderLocation.latitude.toFixed(5)}, ${orderLocation.longitude.toFixed(5)}`}
                </Text>
              )}
              {locationPermission === 'denied' && (
                <Text style={styles.liveLocationError}>Location permission denied. Enable it in settings.</Text>
              )}
            </View>
          )}
          {currentStep === 'quantity' && (
            <View style={styles.quickReplies}>
              {['1', '2', '3', '4', '5'].map(num => (
                <TouchableOpacity
                  key={num}
                  style={styles.quickReplyBtn}
                  onPress={() => handleQuickReply(num)}
                >
                  <Text style={styles.quickReplyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={
                currentStep === 'gas_type'
                  ? 'Enter gas type (e.g., Pro,K-gas, Afrigas)...'
                  : currentStep === 'quantity'
                  ? 'Enter quantity...'
                  : currentStep === 'address'
                  ? 'Enter delivery address...'
                  : 'Type your answer...'
              }
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={200}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isSubmitting) && styles.sendButtonDisabled]}
              onPress={() => {
                if (currentStep === 'gas_type') submitGasType();
                else if (currentStep === 'quantity') submitQuantity();
                else if (currentStep === 'address') submitAddress();
              }}
              disabled={!inputText.trim() || isSubmitting}
            >
              <FontAwesome5 name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardAvoidingRoot: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF',
    paddingHorizontal: 16, paddingVertical: 16, paddingTop: 50,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  stepIndicator: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepText: { fontSize: 14, color: '#fff' },
  progressContainer: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e1e5e9',
  },
  progressItem: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#d1d1d6',
  },
  progressDotActive: { backgroundColor: '#007AFF' },
  progressLine: { width: 30, height: 2, backgroundColor: '#e1e5e9', marginHorizontal: 4 },
  messageList: { flex: 1 },
  messagesContainer: { padding: 16 },
  systemMessageContainer: {
    flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end',
  },
  botAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#007AFF',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  systemBubble: {
    maxWidth: '75%', backgroundColor: '#fff', borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  systemText: { fontSize: 15, lineHeight: 22, color: '#1c1c1e' },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  optionButton: {
    backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, marginRight: 4, marginBottom: 4,
  },
  optionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  userMessageContainer: {
    flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16, alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '75%', backgroundColor: '#007AFF', borderRadius: 18,
    borderBottomRightRadius: 4, padding: 14,
  },
  userText: { fontSize: 15, lineHeight: 22, color: '#fff' },
  userAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#34C759',
    justifyContent: 'center', alignItems: 'center', marginLeft: 10,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 4,
  },
  quickReplies: {
    flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  quickReplyBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  quickReplyText: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff',
  },
  input: {
    flex: 1, backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, maxHeight: 100, fontSize: 16, color: '#1c1c1e', marginRight: 8,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#007AFF',
    justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#d1d1d6' },
  liveLocationContainer: {
    backgroundColor: '#f0f7ff',
    borderTopWidth: 1,
    borderTopColor: '#d9e9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d9e9ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  liveLocationLabel: {
    color: '#124274',
    fontSize: 13,
    fontWeight: '600',
  },
  liveLocationButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  liveLocationButtonStart: {
    backgroundColor: '#007AFF',
  },
  liveLocationButtonStop: {
    backgroundColor: '#E53935',
  },
  liveLocationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  liveLocationMeta: {
    color: '#2d5f94',
    fontSize: 12,
  },
  liveLocationError: {
    color: '#B00020',
    fontSize: 12,
  },
});
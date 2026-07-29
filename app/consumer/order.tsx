import { AppStatusBar } from "@/components/AppStatusBar";

import { auth, db } from "@/config/firebase";

import {
    getOrCreateConversation,
    sendMessage,
    stopConsumerLiveLocationSharing,
    updateConsumerLiveLocation,
} from "@/services/chatService";

import { sendNewOrderNotification } from "@/services/notificationService";

import { addOrderToHistory } from "@/services/orderHistoryLocalService";

import { SupplierWithDistance } from "@/services/types/supplier";

import { FontAwesome5 } from "@expo/vector-icons";

import * as Location from "expo-location";

import { useLocalSearchParams, useRouter } from "expo-router";

import { doc, getDoc } from "firebase/firestore";

import { useEffect, useRef, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

type OrderStep = "cylinder_size" | "gas_type" | "confirm";

type GasType = "LPG" | "BioGas" | "Natural Gas" | "Cooking Gas";

type CylinderSize = "6kg" | "13kg" | "19kg";

type Coords = { latitude: number; longitude: number };

interface OrderData {
  cylinderSize: CylinderSize | null;

  gasType: GasType | null;

  gasBrand: string;

  quantity: string;

  address: string;

  location?: Coords;
}

interface ChatMessage {
  id: string;

  isSystem: boolean;

  text: string;

  options?: string[];
}

const CYLINDER_SIZES: CylinderSize[] = ["6kg", "13kg", "19kg"];

const GAS_TYPES: GasType[] = ["LPG", "BioGas", "Natural Gas", "Cooking Gas"];

const STEP_PROMPTS: Record<OrderStep, string> = {
  cylinder_size: "Select cylinder size",

  gas_type: "Select type of gas",

  confirm: "Confirm order",
};

export default function OrderScreen() {
  const router = useRouter();

  const params = useLocalSearchParams();

  const supplierData = params.supplier
    ? (JSON.parse(params.supplier as string) as SupplierWithDistance)
    : null;

  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList>(null);

  const inputRef = useRef<TextInput | null>(null);

  const [fadeAnim] = useState(() => new Animated.Value(0));

  const currentUser = auth.currentUser;

  const [orderData, setOrderData] = useState<OrderData>({
    cylinderSize: null,

    gasType: null,

    gasBrand: "",

    quantity: "1",

    address: "",
  });

  const [currentStep, setCurrentStep] = useState<OrderStep>("cylinder_size");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",

      isSystem: true,

      text: `Welcome! Let's place your order for ${supplierData?.enterpriseName || "gas delivery"}.\n\n${STEP_PROMPTS.cylinder_size}:`,

      options: CYLINDER_SIZES,
    },
  ]);

  const [inputText, setInputText] = useState("");

  const [locationPermission, setLocationPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");

  const [orderLocation, setOrderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [isSharingLocation, setIsSharingLocation] = useState(false);

  const [isLocationSharingPending, setIsLocationSharingPending] =
    useState(false);

  const [conversationId, setConversationId] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null,
  );

  const lastLocationUpdateRef = useRef<number>(0);

  const isLoadingOverlay =
    isGeneratingSummary || isSubmitting || isLocationSharingPending;

  const busyMessage = isGeneratingSummary
    ? "Preparing your order summary…"
    : isSubmitting
      ? "Submitting your order…"
      : isLocationSharingPending
        ? "Sharing your live location…"
        : "";

  const conversationIdRef = useRef<string>("");
  // Stable timestamp ref for purity-safe order IDs (avoids Date.now() in render paths)
  const stableOrderTimestampRef = useRef<string>(
    // eslint-disable-next-line react-hooks/purity
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  const getConsumerPhoneNumber = async (): Promise<string | undefined> => {
    if (currentUser?.phoneNumber) {
      return currentUser.phoneNumber;
    }

    if (!currentUser) {
      return undefined;
    }

    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();

        const phone =
          data.phoneNumber || data.phone || data.Telephone || data.tel;

        if (typeof phone === "string" && phone.trim().length > 0) {
          return phone.trim();
        }
      }
    } catch {
      // Keep the order flow working even if the profile lookup is temporarily unavailable.
    }

    return undefined;
  };

  const initConversation = async () => {
    if (!currentUser || !supplierData) return;

    const conversationPayload: any = {
      consumerId: currentUser.uid,

      consumerName: currentUser.displayName || "Consumer",

      supplierId: supplierData.uid,

      supplierName: supplierData.fullName || supplierData.enterpriseName,

      supplierEnterpriseName: supplierData.enterpriseName,
    };

    const phoneNumber = await getConsumerPhoneNumber();

    if (phoneNumber) {
      conversationPayload.consumerPhone = phoneNumber;
    }

    const result = await getOrCreateConversation(conversationPayload);

    if (result.success && result.conversationId) {
      setConversationId(result.conversationId);
      conversationIdRef.current = result.conversationId;
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => initConversation());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [currentStep, fadeAnim]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const addMessage = (text: string, options?: string[], isSystem = true) => {
    setMessages((prev) => {
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
    setOrderData((prev) => ({ ...prev, cylinderSize: size }));

    addMessage(`✓ I need a ${size} cylinder`, [], false);

    setCurrentStep("gas_type");

    setInputText("");

    setTimeout(() => {
      addMessage(
        "Enter the gas brand name (e.g., PRO Gas, K-Gas, Afrigas, Gas Plex):",
      );

      inputRef.current?.focus();
    }, 250);
  };

  const submitGasType = () => {
    const gasBrand = inputText.trim();

    if (!gasBrand) {
      Alert.alert("Invalid Gas Brand", "Please enter the gas brand name");

      return;
    }

    setOrderData((prev) => ({
      ...prev,

      gasBrand: gasBrand,

      quantity: "1",
    }));

    addMessage(`✓ Gas Brand: ${gasBrand}`, [], false);

    setInputText("");

    setTimeout(() => {
      startAutoFillDeliveryLocation(gasBrand);
    }, 1000);
  };

  const reverseGeocodeToPlaceName = async (
    latitude: number,
    longitude: number,
  ) => {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (addresses && addresses.length > 0) {
        const a = addresses[0] as any;

        const parts = [a.name, a.street, a.city, a.region, a.country].filter(
          Boolean,
        );

        const composed = parts.join(", ").trim();

        if (composed) return composed;
      }
    } catch {
      // ignore; we'll fallback
    }

    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  };

  const startAutoFillDeliveryLocation = async (gasBrandParam?: string) => {
    setCurrentStep("confirm");

    setIsGeneratingSummary(true);

    addMessage(
      "📍 Capturing your delivery location and preparing your order summary...",
      [],
      true,
    );

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      const granted = permission.status === "granted";

      if (!granted) {
        setLocationPermission("denied");

        setIsGeneratingSummary(false);

        Alert.alert(
          "Permission Required",
          "Location permission is needed to set delivery location.",
        );

        return;
      }

      setLocationPermission("granted");

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: position.coords.latitude,

        longitude: position.coords.longitude,
      };

      setOrderLocation(coords);

      const place = await reverseGeocodeToPlaceName(
        coords.latitude,
        coords.longitude,
      );

      const nextOrderData: OrderData = {
        ...orderData,

        gasBrand: gasBrandParam || orderData.gasBrand || "",
        address: place,

        location: coords,

        quantity: "1",
      };

      setOrderData(nextOrderData);

      addMessage(`✓ Delivery: ${place}`, [], false);

      setIsGeneratingSummary(false);

      setTimeout(() => {
        showConfirmation(nextOrderData);
      }, 1000);
    } catch (error) {
      setIsGeneratingSummary(false);

      console.error("Auto-fill delivery location error:", error);

      Alert.alert("Error", "Unable to capture your delivery location.");
    }
  };

  const showConfirmation = (snapshot: OrderData = orderData) => {
    const { cylinderSize, gasBrand, quantity, address } = snapshot;

    const brandLabel = gasBrand && gasBrand.trim() ? gasBrand.trim() : "—";

    const deliveryLabel = address && address.trim() ? address.trim() : "—";

    const confirmationText = `\n📋 Order Summary:\n━━━━━━━━━━━━━━━\n🔵 Cylinder Size: ${cylinderSize || "—"}\n🟡 Gas Brand: ${brandLabel}\n🔢 Quantity: ${quantity || "1"}\n📍 Delivery: ${deliveryLabel}\n━━━━━━━━━━━━━━━\n\nReady to submit this order?`;

    addMessage(confirmationText, ["✓ Confirm Order", "✗ Start Over"]);

    setCurrentStep("confirm");
  };

  const handleConfirmOrder = async () => {
    if (!currentUser || !supplierData) return;

    setIsSubmitting(true);

    addMessage("⏳ Submitting your order...", [], false);

    try {
      const { cylinderSize, gasBrand, quantity, address } = orderData;

      const orderMessage = `NEW ORDER:\n• Cylinder Size: ${cylinderSize}\n• Gas Brand: ${gasBrand}\n• Quantity: ${quantity}\n• Delivery Address: ${address}`;

      if (conversationId) {
        await sendMessage({
          conversationId,

          senderId: currentUser.uid,

          senderName: currentUser.displayName || "Consumer",

          senderRole: "consumer",

          text: orderMessage,
        });

        await sendNewOrderNotification(
          supplierData.uid,

          supplierData.enterpriseName,

          {
            cylinderSize: cylinderSize || "",

            gasType: gasBrand || "",

            quantity: quantity,

            customerName: currentUser.displayName || "Customer",
          },

          conversationId,
        );
      }

      addMessage(
        "✅ Order submitted successfully! The supplier will contact you shortly.",
        [],
        false,
      );

      addMessage(
        "Share your live location so the supplier can find you easily for delivery.",
        [],
        true,
      );

      // Persist order summary locally for the consumer Order History screen.

      // This is offline-first and can be deleted by the user.

      try {
        await addOrderToHistory({
          userId: currentUser.uid,

          order: {
            orderId:
              conversationId ||
              conversationIdRef.current ||
              stableOrderTimestampRef.current,

            cylinderSize: (cylinderSize || "Unknown") as any,

            gasType: (gasBrand || "—") as any,

            quantity: Number(quantity || 1),

            deliveryAddress: address || "",

            status: "delivered",
          },
        });
      } catch {
        // never break ordering flow if local persistence fails
      }

      promptShareLocationAfterOrder();
    } catch (error) {
      console.error("Submit order error:", error);

      Alert.alert(
        "Error",
        "Unable to submit your order right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptShareLocationAfterOrder = () => {
    if (isSharingLocation) return;

    Alert.alert(
      "Share location for delivery?",

      "Help your supplier track your order easily. Your last location is saved even if you go offline later.",

      [
        { text: "Not now", style: "cancel" },

        {
          text: "Share location",

          onPress: () => startSharingLiveLocation(),
        },
      ],
    );
  };

  const stopSharingLiveLocation = async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();

      locationSubscriptionRef.current = null;
    }

    setIsSharingLocation(false);

    if (conversationIdRef.current) {
      const result = await stopConsumerLiveLocationSharing(
        conversationIdRef.current,
      );

      if (!result.success) {
        Alert.alert(
          "Error",
          result.error || "Failed to stop sharing location.",
        );
      } else {
        addMessage(
          "Live sharing stopped. Your last location is still saved for the supplier.",

          [],

          true,
        );
      }
    }
  };

  const ensureConversationId = async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;

    if (!currentUser || !supplierData) return null;

    const phoneNumber = await getConsumerPhoneNumber();

    const result = await getOrCreateConversation({
      consumerId: currentUser.uid,

      consumerName: currentUser.displayName || "Consumer",

      consumerPhone: phoneNumber,

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
      Alert.alert(
        "Error",
        "Could not find your order conversation. Please submit the order first.",
      );

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
      Alert.alert(
        "Location not saved",
        result.error || "Could not send location to supplier.",
      );

      return false;
    }

    return true;
  };

  const startSharingLiveLocation = async () => {
    setIsLocationSharingPending(true);

    const activeConversationId = await ensureConversationId();

    if (!activeConversationId) {
      setIsLocationSharingPending(false);

      Alert.alert(
        "Order Not Ready",
        "Please submit your order first, then share live location.",
      );

      return;
    }

    const permission = await Location.requestForegroundPermissionsAsync();

    const granted = permission.status === "granted";

    setLocationPermission(granted ? "granted" : "denied");

    if (!granted) {
      setIsLocationSharingPending(false);

      Alert.alert(
        "Permission Required",
        "Location permission is needed to share live location.",
      );

      return;
    }

    try {
      const saved = await pushCurrentLocation();

      if (!saved) {
        setIsLocationSharingPending(false);

        return;
      }

      setIsLocationSharingPending(false);

      setIsSharingLocation(true);

      addMessage(
        "📍 Sharing your live location with your supplier...",
        [],
        true,
      );

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,

          timeInterval: 10000,

          distanceInterval: 20,
        },

        async (position) => {
          setIsLocationSharingPending(false);

          setIsSharingLocation(true);

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
        },
      );
    } catch (error) {
      console.error("Start live location sharing error:", error);

      Alert.alert("Error", "Unable to start live location sharing.");

      setIsLocationSharingPending(false);

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
    setOrderData({
      cylinderSize: null,
      gasType: null,
      gasBrand: "",
      quantity: "1",
      address: "",
    });

    setMessages([
      {
        id: "welcome",

        isSystem: true,

        text: `Let's place a new order!\n\n${STEP_PROMPTS.cylinder_size}:`,

        options: CYLINDER_SIZES,
      },
    ]);

    setCurrentStep("cylinder_size");

    setInputText("");
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.isSystem) {
      return (
        <Animated.View
          style={[styles.systemMessageContainer, { opacity: fadeAnim }]}
        >
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
                    style={[
                      styles.optionButton,
                      isLoadingOverlay && styles.optionButtonDisabled,
                    ]}
                    onPress={() => handleOptionPress(option)}
                    disabled={isLoadingOverlay}
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
      case "cylinder_size":
        if (CYLINDER_SIZES.includes(option as CylinderSize)) {
          handleCylinderSelection(option as CylinderSize);
        }

        break;

      case "gas_type":
        if (GAS_TYPES.includes(option as GasType)) {
          // Selecting a gas type proceeds to auto-fill delivery location

          setOrderData((prev) => ({
            ...prev,
            gasType: option as GasType,
            quantity: "1",
          }));

          addMessage(`✓ Gas type: ${option}`, [], false);

          setInputText("");

          setTimeout(() => {
            startAutoFillDeliveryLocation();
          }, 300);
        }

        break;

      case "confirm":
        if (option.includes("Confirm")) {
          handleConfirmOrder();
        } else if (option.includes("Start Over")) {
          handleStartOver();
        }

        break;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingRoot}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -40}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {isLoadingOverlay && (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#007AFF" />

              <Text style={styles.loadingText}>{busyMessage}</Text>
            </View>
          </View>
        )}

        <AppStatusBar backgroundColor="#007AFF" barStyle="dark-content" />

        {/* Header */}

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, isLoadingOverlay && styles.backBtnDisabled]}
            disabled={isLoadingOverlay}
          >
            <FontAwesome5 name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {supplierData?.enterpriseName || "Order"}
            </Text>

            <Text style={styles.headerSubtitle}>Chat-style Ordering</Text>
          </View>

          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              {currentStep === "confirm" ? "✓" : "●"}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}

        <View style={styles.progressContainer}>
          {(["cylinder_size", "gas_type"] as OrderStep[]).map((step, idx) => (
            <View key={step} style={styles.progressItem}>
              <View
                style={[
                  styles.progressDot,

                  (
                    ["cylinder_size", "gas_type", "confirm"] as OrderStep[]
                  ).indexOf(currentStep) >= idx
                    ? styles.progressDotActive
                    : null,
                ]}
              />

              {idx < 1 && <View style={styles.progressLine} />}
            </View>
          ))}
        </View>

        {/* Messages */}

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={[
            styles.messagesContainer,
            { flexGrow: 1, paddingBottom: 0 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Input Area */}

        <View
          style={[styles.inputWrapper, { paddingBottom: insets.bottom + -35 }]}
        >
          {currentStep === "confirm" && (
            <View style={styles.liveLocationContainer}>
              <Text style={styles.liveLocationLabel}>
                {isSharingLocation
                  ? "Live location is being shared with supplier."
                  : "Share live location to help supplier track delivery."}
              </Text>

              <TouchableOpacity
                style={[
                  styles.liveLocationButton,

                  isSharingLocation
                    ? styles.liveLocationButtonStop
                    : styles.liveLocationButtonStart,

                  isLoadingOverlay && styles.liveLocationButtonDisabled,
                ]}
                onPress={toggleLiveLocationSharing}
                disabled={isLoadingOverlay}
              >
                <FontAwesome5
                  name={isSharingLocation ? "stop-circle" : "location-arrow"}
                  size={14}
                  color="#fff"
                />

                <Text style={styles.liveLocationButtonText}>
                  {isSharingLocation ? "Stop Sharing" : "Share Live Location"}
                </Text>
              </TouchableOpacity>

              {orderLocation && (
                <Text style={styles.liveLocationMeta}>
                  {`Last: ${orderLocation.latitude.toFixed(5)}, ${orderLocation.longitude.toFixed(5)}`}
                </Text>
              )}

              {locationPermission === "denied" && (
                <Text style={styles.liveLocationError}>
                  Location permission denied. Enable it in settings.
                </Text>
              )}
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputArea}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={
                  currentStep === "gas_type"
                    ? "Type the gas brand (e.g. Pro Gas, K-Gas, Afrigas)..."
                    : "Type your gas..."
                }
                placeholderTextColor="#1e1919"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={200}
                autoFocus={currentStep === "gas_type"}
                autoCorrect={false}
                returnKeyType="done"
              />

              {isLoadingOverlay && (
                <View style={styles.busyRow}>
                  <ActivityIndicator size="small" color="#007AFF" />

                  <Text style={styles.busyText}>{busyMessage}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoadingOverlay) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={() => {
                if (currentStep === "gas_type") submitGasType();
              }}
              disabled={!inputText.trim() || isLoadingOverlay}
            >
              <FontAwesome5 name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnDisabled: {
    opacity: 0.5,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d1d1d6',
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#d1d1d6',
    marginHorizontal: 8,
  },
  messageList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  liveLocationContainer: {
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    marginBottom: 8,
  },
  liveLocationLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  liveLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  liveLocationButtonStart: {
    backgroundColor: '#007AFF',
  },
  liveLocationButtonStop: {
    backgroundColor: '#FF3B30',
  },
  liveLocationButtonDisabled: {
    opacity: 0.5,
  },
  liveLocationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  liveLocationMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
  },
  liveLocationError: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
  },
  inputArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  busyText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    paddingVertical: 4,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d1d6',
  },
  systemMessageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  systemBubble: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  systemText: {
    fontSize: 15,
    color: '#1c1c1e',
    lineHeight: 20,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  optionButtonDisabled: {
    opacity: 0.5,
  },
  optionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  userMessageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 12,
    borderBottomRightRadius: 4,
  },
  userText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

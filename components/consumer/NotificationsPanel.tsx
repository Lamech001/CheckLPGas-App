import { FontAwesome5 } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

interface Notification {
  id: string;
  type: "price_drop" | "new_supplier" | "back_in_stock" | "promotion";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  supplierId?: string;
  supplierName?: string;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = memo(
  function NotificationsPanel({ visible, onClose, onUnreadCountChange }) {
    const { height } = useWindowDimensions();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Seed mock notifications only once per component life.
    const hasSeededRef = useRef(false);

    // Notify parent of unread count changes
    useEffect(() => {
      onUnreadCountChange?.(unreadCount);
    }, [unreadCount, onUnreadCountChange]);

    // Seed mock welcome notification on first open (no database fetching)
    useEffect(() => {
      if (!visible) return;

      if (!hasSeededRef.current) {
        hasSeededRef.current = true;
        // Schedule state updates to avoid setState synchronously within effect
        const timer = setTimeout(() => {
          setNotifications([
            {
              id: "welcome",
              type: "promotion",
              title: "Welcome to GasAround!",
              message:
                "Find the best gas prices near you. Pull down to refresh.",
              timestamp: new Date(),
              read: false,
            },
          ]);
          setUnreadCount(1);
          setLoading(false);
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setLoading(false);
        }, 0);
        return () => clearTimeout(timer);
      }
    }, [visible]);

    const markAllAsRead = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    };

    const getIconForType = useCallback((type: string) => {
      switch (type) {
        case "price_drop":
          return { name: "tag", color: "#4CAF50" };
        case "new_supplier":
          return { name: "store", color: "#2196F3" };
        case "back_in_stock":
          return { name: "fire", color: "#FF9800" };
        case "promotion":
          return { name: "gift", color: "#9C27B0" };
        default:
          return { name: "bell", color: "#666" };
      }
    }, []);

    const formatTime = useCallback((date: Date) => {
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    }, []);

    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} />
          <View style={[styles.panelContainer, { maxHeight: height * 0.7 }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead}>
                  <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <FontAwesome5 name="times" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Notification Count */}
            <View style={styles.countContainer}>
              <Text style={styles.countText}>
                {unreadCount > 0
                  ? `${unreadCount} new`
                  : "No new notifications"}
              </Text>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Loading notifications...</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <FontAwesome5 name="bell-slash" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                  <Text style={styles.emptySubtext}>
                    We&apos;ll notify you when prices drop or new suppliers open
                    nearby!
                  </Text>
                </View>
              ) : (
                notifications.map((notification) => {
                  const icon = getIconForType(notification.type);
                  return (
                    <TouchableOpacity
                      key={notification.id}
                      style={[
                        styles.notificationItem,
                        !notification.read && styles.unreadItem,
                      ]}
                      onPress={() => {
                        setNotifications((prev) =>
                          prev.map((n) =>
                            n.id === notification.id ? { ...n, read: true } : n,
                          ),
                        );
                        if (!notification.read) {
                          setUnreadCount((prev) => Math.max(0, prev - 1));
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: `${icon.color}20` },
                        ]}
                      >
                        <FontAwesome5
                          name={icon.name}
                          size={20}
                          color={icon.color}
                        />
                      </View>
                      <View style={styles.contentContainer}>
                        <Text style={styles.notificationTitle}>
                          {notification.title}
                        </Text>
                        <Text style={styles.notificationMessage}>
                          {notification.message}
                        </Text>
                        <Text style={styles.timestamp}>
                          {formatTime(notification.timestamp)}
                        </Text>
                      </View>
                      {!notification.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  },
);
NotificationsPanel.displayName = "NotificationsPanel";

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  panelContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  markAllText: {
    fontSize: 14,
    color: "#1976D2",
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#f8f9fa",
  },
  countText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  list: {
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  notificationItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  unreadItem: {
    backgroundColor: "#E3F2FD",
    borderColor: "#1976D2",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1976D2",
    marginLeft: 8,
    alignSelf: "center",
  },
});

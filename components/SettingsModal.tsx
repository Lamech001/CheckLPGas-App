import { logOut } from "@/services/authService";
import { FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  supplierData?: {
    enterpriseName: string;
    email: string;
    phoneNumber: string;
    isOpen: boolean;
  } | null;
  onToggleShopStatus?: () => void;
}

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  toggle,
  toggleValue,
  onToggle,
  danger,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, danger && styles.dangerItem]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={toggle}
    >
      <View
        style={[styles.iconContainer, danger && styles.dangerIconContainer]}
      >
        <FontAwesome5
          name={icon}
          size={18}
          color={danger ? "#f44336" : "#FF6B35"}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: "#ddd", true: "#FF6B35" }}
          thumbColor="#fff"
        />
      ) : (
        <FontAwesome5 name="chevron-right" size={16} color="#ccc" />
      )}
    </TouchableOpacity>
  );
}

export function SettingsModal({
  visible,
  onClose,
  supplierData,
  onToggleShopStatus,
}: SettingsModalProps) {
  const router = useRouter();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // loadSettings intentionally removed to satisfy lint warnings for unused variables.
  // Settings are persisted via saveSettings when toggles are changed.

  const saveSettings = async (key: string, value: boolean) => {
    try {
      const current = await AsyncStorage.getItem("supplierSettings");
      const settings = current ? JSON.parse(current) : {};
      settings[key] = value;
      await AsyncStorage.setItem("supplierSettings", JSON.stringify(settings));

      // Also persist globally so other parts of the app (and consumer settings)
      // can initialize consistently.
      if (key === "darkMode") {
        await AsyncStorage.setItem("@darkModeEnabled", value.toString());
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logOut();
          onClose();
          router.replace("/role-select");
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    onClose();
    router.push("/supplier/edit-profile");
  };

  const handleChangePassword = () => {
    onClose();
    Alert.alert("Coming Soon", "Change password is not available yet.");
  };

  const handleHelpSupport = () => {
    onClose();
    Linking.openURL("mailto:gasaroundsupport@gmail.com").catch((err) => {
      Alert.alert("Error", "Unable to open email client");
    });
  };

  const handlePrivacyPolicy = () => {
    onClose();
    router.push("/privacy");
  };

  const handleTerms = () => {
    onClose();
    router.push("/terms");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FontAwesome5 name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Business Status Section */}
            {supplierData && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Business Status</Text>
                <SettingItem
                  icon="store"
                  title="Shop Open"
                  subtitle={
                    supplierData.isOpen
                      ? "Currently accepting orders"
                      : "Currently closed"
                  }
                  toggle
                  toggleValue={supplierData.isOpen}
                  onToggle={() => onToggleShopStatus?.()}
                />
              </View>
            )}

            {/* Account Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account</Text>
              <SettingItem
                icon="user-edit"
                title="Edit Profile"
                subtitle="Update your business information"
                onPress={handleEditProfile}
              />
              <SettingItem
                icon="lock"
                title="Change Password"
                subtitle="Update your password"
                onPress={handleChangePassword}
              />
            </View>

            {/* Notifications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <SettingItem
                icon="bell"
                title="Push Notifications"
                subtitle="Receive push notifications"
                toggle
                toggleValue={pushNotifications}
                onToggle={(value) => {
                  setPushNotifications(value);
                  saveSettings("pushNotifications", value);
                }}
              />
              <SettingItem
                icon="envelope"
                title="Email Notifications"
                subtitle="Receive email updates"
                toggle
                toggleValue={emailNotifications}
                onToggle={(value) => {
                  setEmailNotifications(value);
                  saveSettings("emailNotifications", value);
                }}
              />
              <SettingItem
                icon="volume-up"
                title="Sound"
                subtitle="Play sounds for notifications"
                toggle
                toggleValue={soundEnabled}
                onToggle={(value) => {
                  setSoundEnabled(value);
                  saveSettings("soundEnabled", value);
                }}
              />
            </View>

            {/* Appearance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <SettingItem
                icon="moon"
                title="Dark Mode"
                subtitle="Dark mode is not available yet"
                onPress={() => {}}
              />
            </View>

            {/* Support Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Support</Text>
              <SettingItem
                icon="question-circle"
                title="Help & Support"
                subtitle="Get help with your account"
                onPress={handleHelpSupport}
              />
              <SettingItem
                icon="shield-alt"
                title="Privacy Policy"
                onPress={handlePrivacyPolicy}
              />
              <SettingItem
                icon="file-contract"
                title="Terms of Service"
                onPress={handleTerms}
              />
            </View>

            {/* App Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Version</Text>
                <Text style={styles.infoValue}>1.0.0</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Build</Text>
                <Text style={styles.infoValue}>2024.1</Text>
              </View>
            </View>

            {/* Danger Zone */}
            <TouchableOpacity
              style={[styles.logoutButton, { backgroundColor: "#ffebee" }]}
              onPress={() => {
                Alert.alert(
                  "Delete Account",
                  "This will permanently delete your account and data. This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          // Lazy import to avoid circular deps
                          const { deleteAccount } =
                            await import("@/services/authService");
                          const result = await deleteAccount();
                          if (!result.success) {
                            Alert.alert(
                              "Error",
                              result.error || "Failed to delete account",
                            );
                            return;
                          }
                          onClose();
                          router.replace("/role-select");
                        } catch (e: any) {
                          Alert.alert(
                            "Error",
                            e?.message || "Failed to delete account",
                          );
                        }
                      },
                    },
                  ],
                );
              }}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="trash" size={20} color="#f44336" />
              <Text style={styles.logoutText}>Delete Account</Text>
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="sign-out-alt" size={20} color="#f44336" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpace} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "60%",
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
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 8,
  },
  dangerItem: {
    backgroundColor: "#fff5f5",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF5F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  dangerIconContainer: {
    backgroundColor: "#ffebee",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  settingSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  dangerText: {
    color: "#f44336",
  },
  infoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: "#666",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#ffebee",
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f44336",
  },
  bottomSpace: {
    height: 32,
  },
});

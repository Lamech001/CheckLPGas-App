import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { auth } from '@/config/firebase';
import { logOut } from '@/services/authService';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
        style={[
          styles.iconContainer,
          danger && styles.dangerIconContainer,
        ]}
      >
        <FontAwesome5
          name={icon}
          size={18}
          color={danger ? '#f44336' : '#FF6B35'}
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
          trackColor={{ false: '#ddd', true: '#FF6B35' }}
          thumbColor="#fff"
        />
      ) : (
        <FontAwesome5
          name="chevron-right"
          size={16}
          color="#ccc"
        />
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
  const [darkMode, setDarkMode] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('supplierSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setPushNotifications(parsed.pushNotifications ?? true);
        setEmailNotifications(parsed.emailNotifications ?? true);
        setSoundEnabled(parsed.soundEnabled ?? true);
        setDarkMode(parsed.darkMode ?? false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (key: string, value: boolean) => {
    try {
      const current = await AsyncStorage.getItem('supplierSettings');
      const settings = current ? JSON.parse(current) : {};
      settings[key] = value;
      await AsyncStorage.setItem('supplierSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logOut();
            onClose();
            router.replace('/role-select');
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    onClose();
    Alert.alert('Coming Soon', 'Edit profile is not available yet.');
  };

  const handleChangePassword = () => {
    onClose();
    Alert.alert('Coming Soon', 'Change password is not available yet.');
  };

  const handleHelpSupport = () => {
    onClose();
    Alert.alert('Coming Soon', 'Support is not available yet.');
  };

  const handlePrivacyPolicy = () => {
    onClose();
    Alert.alert('Coming Soon', 'Privacy policy is not available yet.');
  };

  const handleTerms = () => {
    onClose();
    Alert.alert('Coming Soon', 'Terms & conditions are not available yet.');
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
                  subtitle={supplierData.isOpen ? 'Currently accepting orders' : 'Currently closed'}
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
                  saveSettings('pushNotifications', value);
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
                  saveSettings('emailNotifications', value);
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
                  saveSettings('soundEnabled', value);
                }}
              />
            </View>

            {/* Appearance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <SettingItem
                icon="moon"
                title="Dark Mode"
                subtitle="Switch to dark theme"
                toggle
                toggleValue={darkMode}
                onToggle={(value) => {
                  setDarkMode(value);
                  saveSettings('darkMode', value);
                }}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
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
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  dangerItem: {
    backgroundColor: '#fff5f5',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFF5F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dangerIconContainer: {
    backgroundColor: '#ffebee',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  dangerText: {
    color: '#f44336',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#ffebee',
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f44336',
  },
  bottomSpace: {
    height: 32,
  },
});

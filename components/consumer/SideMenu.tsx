import { auth } from '@/config/firebase';
import { AppColors, AppShadows, AppSizes } from '@/constants/appTheme';
import { logOut } from '@/services/authService';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ConsumerProfile } from './ConsumerProfile';
import { SettingsPanel } from './SettingsPanel';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
}

const { width } = Dimensions.get('window');

export const SideMenu: React.FC<SideMenuProps> = ({ visible, onClose, userName }) => {
  const router = useRouter();
  const user = auth.currentUser;
  const [profileVisible, setProfileVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await logOut();
              if (result.success) {
                onClose();
                router.replace('/consumer/login');
              } else {
                Alert.alert('Error', result.error || 'Failed to log out');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'home', label: 'Home', onPress: () => { onClose(); } },
    { icon: 'map-marker-alt', label: 'Find Suppliers', onPress: () => { onClose(); } },
    { icon: 'history', label: 'Order History', onPress: () => { 
      Alert.alert('Coming Soon', 'Order history will be available soon!');
      onClose(); 
    }},
    { icon: 'heart', label: 'Favorite Suppliers', onPress: () => { 
      Alert.alert('Coming Soon', 'Favorites feature coming soon!');
      onClose(); 
    }},
    { icon: 'user', label: 'My Profile', onPress: () => { 
      onClose();
      // Delay opening profile to let SideMenu close first
      setTimeout(() => setProfileVisible(true), 300);
    }},
    { icon: 'cog', label: 'Settings', onPress: () => { 
      onClose();
      setTimeout(() => setSettingsVisible(true), 300);
    }},
    { icon: 'headset', label: 'Help & Support', onPress: () => { 
      Alert.alert('Help & Support', 'Contact us at support@gasafrica.com');
      onClose(); 
    }},
  ];

  return (
    <>
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.menuContainer}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <FontAwesome5 name="times" size={24} color="#666" />
          </TouchableOpacity>

          {/* User Header */}
          <View style={styles.userHeader}>
            <View style={styles.avatarContainer}>
              <FontAwesome5 name="user-circle" size={60} color="#1976D2" />
            </View>
            <Text style={styles.userName}>{userName || 'Guest'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>

          <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <FontAwesome5 name={item.icon} size={20} color="#1976D2" style={styles.menuIcon} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <FontAwesome5 name="chevron-right" size={14} color="#ccc" />
              </TouchableOpacity>
            ))}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <FontAwesome5 name="sign-out-alt" size={20} color="#f44336" style={styles.menuIcon} />
              <Text style={styles.logoutLabel}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>

    {/* Consumer Profile Modal - Outside SideMenu Modal */}
    {profileVisible && (
      <ConsumerProfile
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
      />
    )}

    {/* Settings Panel */}
    <SettingsPanel
      visible={settingsVisible}
      onClose={() => setSettingsVisible(false)}
    />
  </>);
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: AppColors.backdrop,
  },
  menuContainer: {
    width: width * AppSizes.menuWidth,
    backgroundColor: AppColors.white,
    height: '100%',
    ...AppShadows.menu,
  },
  userHeader: {
    backgroundColor: AppColors.primary,
    padding: AppSizes.spacingXXLarge,
    paddingTop: AppSizes.statusBarHeight,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 12,
  },
  userName: {
    fontSize: AppSizes.fontTitle,
    fontWeight: 'bold',
    color: AppColors.white,
  },
  userEmail: {
    fontSize: AppSizes.fontMedium,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: AppSizes.spacingXS,
  },
  menuList: {
    flex: 1,
    paddingTop: AppSizes.spacingLarge,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSizes.spacingLarge,
    paddingHorizontal: AppSizes.spacingXLarge,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  menuIcon: {
    width: 30,
  },
  menuLabel: {
    flex: 1,
    fontSize: AppSizes.fontXLarge,
    color: AppColors.textPrimary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: AppSizes.spacingLarge,
    paddingHorizontal: AppSizes.spacingXLarge,
    marginTop: AppSizes.spacingXLarge,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  logoutLabel: {
    flex: 1,
    fontSize: AppSizes.fontXLarge,
    color: AppColors.errorLight,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
  },
});

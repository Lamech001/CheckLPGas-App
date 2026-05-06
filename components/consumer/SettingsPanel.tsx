import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ visible, onClose }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const notifications = await AsyncStorage.getItem('@notificationsEnabled');
      const location = await AsyncStorage.getItem('@locationEnabled');
      
      if (notifications !== null) setNotificationsEnabled(notifications === 'true');
      if (location !== null) setLocationEnabled(location === 'true');
    } catch {
      // Silently handle
    }
  };

  const handleToggleDarkMode = async (value: boolean) => {
    toggleTheme();
    
    // Save to Firestore for sync across devices
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          preferences: { darkMode: value },
          updatedAt: new Date(),
        }, { merge: true });
      } catch {
        // Silently handle
      }
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem('@notificationsEnabled', value.toString());
  };

  const toggleLocation = async (value: boolean) => {
    setLocationEnabled(value);
    await AsyncStorage.setItem('@locationEnabled', value.toString());
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onToggle 
  }: { 
    icon: string; 
    title: string; 
    subtitle?: string; 
    value: boolean; 
    onToggle: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIconContainer}>
        <FontAwesome5 name={icon} size={20} color="#1976D2" />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#767577', true: '#81b0ff' }}
        thumbColor={value ? '#1976D2' : '#f4f3f4'}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.panelContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome5 name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Appearance Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <SettingItem
                icon={isDarkMode ? 'moon' : 'sun'}
                title="Dark Mode"
                subtitle={isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                value={isDarkMode}
                onToggle={handleToggleDarkMode}
              />
            </View>

            {/* Notifications Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <SettingItem
                icon="bell"
                title="Push Notifications"
                subtitle="Get alerts for new suppliers"
                value={notificationsEnabled}
                onToggle={toggleNotifications}
              />
            </View>

            {/* Privacy Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy</Text>
              <SettingItem
                icon="map-marker-alt"
                title="Location Services"
                subtitle="Allow access to your location"
                value={locationEnabled}
                onToggle={toggleLocation}
              />
            </View>

            {/* About Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.aboutItem}>
                <FontAwesome5 name="info-circle" size={20} color="#1976D2" style={styles.aboutIcon} />
                <View>
                  <Text style={styles.aboutTitle}>GasAround Kenya</Text>
                  <Text style={styles.aboutVersion}>Version 1.0.0</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panelContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  aboutIcon: {
    marginRight: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  aboutVersion: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

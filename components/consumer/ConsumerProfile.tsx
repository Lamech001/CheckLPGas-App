import { auth, db, enableFirestoreNetwork } from '@/config/firebase';
import { AppColors, AppSizes } from '@/constants/appTheme';
import { FontAwesome5 } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ConsumerProfileProps {
  visible: boolean;
  onClose: () => void;
}

interface UserProfile {
  fullName: string;
  email: string;
  phoneNumber: string;
  location: string;
  role: string;
  createdAt?: string;
}

const { width, height } = Dimensions.get('window');

export const ConsumerProfile: React.FC<ConsumerProfileProps> = ({ visible, onClose }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadUserProfile();
    }
  }, [visible]);

  const loadUserProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('No user logged in. Please login again.');
        setLoading(false);
        return;
      }

      // Try to enable network if offline (Firestore offline mode)
      try {
        await enableFirestoreNetwork();
      } catch (networkErr) {
        // Ignore network enable errors, proceed anyway
      }

      // Get user data from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data() as any;
        setProfile({
          fullName: data.displayName || user.displayName || 'N/A',
          email: user.email || 'N/A',
          phoneNumber: data.phoneNumber || 'N/A',
          location: data.location || 'N/A',
          role: data.role || 'consumer',
          createdAt: (() => {
            try {
              const d = data?.createdAt;
              // Firestore Timestamp has toDate(); handle strings/undefined safely
              if (d && typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
              if (typeof d === 'string') return d;
              return 'N/A';
            } catch {
              return 'N/A';
            }
          })(),
        });
      } else {
        // Fallback to Auth data if Firestore doc doesn't exist
        setProfile({
          fullName: user.displayName || 'N/A',
          email: user.email || 'N/A',
          phoneNumber: user.phoneNumber || 'N/A',
          location: 'N/A',
          role: 'consumer',
          createdAt: 'N/A',
        });
      }
    } catch (err: any) {
      // Error handled silently - user sees friendly message in UI
      // No console.error to suppress uncaught error noise
      if (err.message?.includes('offline') || err.code?.includes('offline')) {
        setError('You appear to be offline. Please check your internet connection and try again.');
      } else {
        setError('Failed to load profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const ProfileItem = ({ icon, label, value }: { icon: string; label: string; value: string | undefined | null }) => (
    <View style={styles.profileItem}>
      <View style={styles.iconContainer}>
        <FontAwesome5 name={icon} size={18} color={AppColors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || 'N/A'}</Text>
      </View>
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
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <FontAwesome5 name="times" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          ) : profile ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Profile Avatar */}
              <View style={styles.avatarSection}>
                <View style={styles.avatarContainer}>
                  <FontAwesome5 name="user-circle" size={80} color="#1976D2" />
                </View>
                <Text style={styles.nameText}>{profile.fullName}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{profile.role.toUpperCase()}</Text>
                </View>
              </View>

              {/* Profile Details */}
              <View style={styles.detailsSection}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                
                <ProfileItem 
                  icon="user" 
                  label="Full Name" 
                  value={profile.fullName} 
                />
                <ProfileItem 
                  icon="envelope" 
                  label="Email Address" 
                  value={profile.email} 
                />
                <ProfileItem 
                  icon="phone" 
                  label="Phone Number" 
                  value={profile.phoneNumber} 
                />
                <ProfileItem 
                  icon="map-marker-alt" 
                  label="Location" 
                  value={profile.location} 
                />
                <ProfileItem 
                  icon="calendar-alt" 
                  label="Member Since" 
                  value={profile.createdAt} 
                />
              </View>

            </ScrollView>
          ) : error ? (
            <View style={styles.errorContainer}>
              <FontAwesome5 name="exclamation-circle" size={48} color="#f44336" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <FontAwesome5 name="exclamation-circle" size={48} color="#f44336" />
              <Text style={styles.errorText}>Failed to load profile</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
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
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  nameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: AppSizes.fontXSmall,
    color: AppColors.textTertiary,
    marginBottom: 2,
  },
  value: {
    fontSize: AppSizes.fontXLarge,
    color: AppColors.textPrimary,
    fontWeight: '500',
  },
  editIcon: {
    marginRight: AppSizes.spacingSmall,
  },
  editButtonText: {
    color: AppColors.white,
    fontSize: AppSizes.fontXLarge,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: AppSizes.fontXLarge,
    color: AppColors.textSecondary,
    marginTop: AppSizes.spacingLarge,
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: AppSizes.spacingLarge,
    paddingHorizontal: AppSizes.spacingXXLarge,
    paddingVertical: AppSizes.spacingMedium,
    backgroundColor: AppColors.primary,
    borderRadius: AppSizes.radiusMedium,
  },
  retryText: {
    color: AppColors.white,
    fontSize: AppSizes.fontMedium,
    fontWeight: '600',
  },
});

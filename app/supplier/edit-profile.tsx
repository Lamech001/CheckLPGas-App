import { AppStatusBar } from '@/components/AppStatusBar';
import { auth } from '@/config/firebase';
import { updateSupplierProfile } from '@/services/supplierAuthService';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    enterpriseName: '',
    phoneNumber: '',
    location: '',
    openingHours: {
      open: '08:00',
      close: '20:00',
    },
  });

  const loadSupplierData = async () => {
    try {
      setLoading(true);
      const { getSupplierData } = await import('@/services/supplierAuthService');
      const result = await getSupplierData(auth.currentUser?.uid || '');
      
      if (result.success && result.data) {
        setFormData({
          fullName: result.data.fullName || '',
          enterpriseName: result.data.enterpriseName || '',
          phoneNumber: result.data.phoneNumber || '',
          location: result.data.location?.address || '',
          openingHours: result.data.openingHours || { open: '08:00', close: '20:00' },
        });
      }
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    loadSupplierData();
  });

  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }
    if (!formData.enterpriseName.trim()) {
      Alert.alert('Error', 'Please enter your enterprise name');
      return;
    }
    if (!formData.phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    if (!formData.location.trim()) {
      Alert.alert('Error', 'Please enter your location');
      return;
    }

    setSaving(true);
    try {
      const result = await updateSupplierProfile(auth.currentUser?.uid || '', {
        fullName: formData.fullName,
        enterpriseName: formData.enterpriseName,
        phoneNumber: formData.phoneNumber,
        location: formData.location,
        openingHours: formData.openingHours,
      });

      if (result.success) {
        Alert.alert('Success', 'Your profile has been updated successfully');
        router.back();
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome5 name="chevron-left" size={20} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              placeholder="Enter your full name"
              placeholderTextColor="#999"
            />
          </View>

          {/* Enterprise Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Enterprise Name</Text>
            <TextInput
              style={styles.input}
              value={formData.enterpriseName}
              onChangeText={(text) => setFormData({ ...formData, enterpriseName: text })}
              placeholder="Enter your business name"
              placeholderTextColor="#999"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              placeholder="Enter your phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              placeholder="Enter your address"
              placeholderTextColor="#999"
            />
          </View>

          {/* Opening Hours */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Opening Hours</Text>
            <View style={styles.hoursRow}>
              <View style={styles.hourInput}>
                <Text style={styles.hourLabel}>Open</Text>
                <TextInput
                  style={styles.input}
                  value={formData.openingHours.open}
                  onChangeText={(text) => setFormData({ 
                    ...formData, 
                    openingHours: { ...formData.openingHours, open: text } 
                  })}
                  placeholder="08:00"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.hourInput}>
                <Text style={styles.hourLabel}>Close</Text>
                <TextInput
                  style={styles.input}
                  value={formData.openingHours.close}
                  onChangeText={(text) => setFormData({ 
                    ...formData, 
                    openingHours: { ...formData.openingHours, close: text } 
                  })}
                  placeholder="20:00"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome5 name="save" size={18} color="#fff" style={styles.saveIcon} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 12,
  },
  hourInput: {
    flex: 1,
  },
  hourLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpace: {
    height: 32,
  },
});

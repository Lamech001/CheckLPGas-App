import { LocationPicker } from '@/components/LocationPicker';
import {
  Divider,
  GoogleSignInButton,
  InputField,
  LocationBar,
  LoginLink,
  SignUpButton,
  SignupHeader,
} from '@/components/signup';
import { useConsumerSignup } from '@/hooks/useConsumerSignup';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConsumerSignup() {
  const router = useRouter();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const {
    formData,
    updateField,
    blurField,
    signUp,
    authState,
    fieldErrors,
    touchedFields,
    clearError,
  } = useConsumerSignup();

  const handleSignUp = async () => {
    // Immediate haptic feedback for fast button response
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await signUp();

    if (result.success) {
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Show email verification popup
      Alert.alert(
        'Verify Your Email',
        'A verification link has been sent to your email address. Please open your email and click on the link to verify your account.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/consumer/login'),
          }
        ]
      );
    } else {
      // Error haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', result.error || 'Failed to sign up. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    // Google Sign-In coming soon
    Alert.alert('Coming Soon', 'Signing in with Google is coming soon!');
    /*
    const result = await signInWithGoogle('consumer');

    if (result.success) {
      Alert.alert('Success', 'Signed in with Google successfully!');
    } else {
      Alert.alert('Error', result.error || 'Google sign-in failed');
    }
    */
  };

  const handleLogin = () => {
    router.push('/consumer/login');
  };

  const handleSetLocation = () => {
    setShowLocationPicker(true);
  };

  const handleSelectLocation = (location: string) => {
    updateField('location', location);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SignupHeader title="Consumer Sign Up" />

          {/* Error Display */}
          {authState.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{authState.error}</Text>
              <TouchableOpacity onPress={clearError}>
                <FontAwesome5 name="times" size={16} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          )}

          <LocationBar
            location={formData.location}
            onSetManually={handleSetLocation}
          />

          <InputField
            icon="user"
            iconColor="#4CAF50"
            placeholder="Full Name"
            value={formData.fullName}
            onChangeText={(text) => updateField('fullName', text)}
            onBlur={() => blurField('fullName')}
            autoCapitalize="words"
            error={touchedFields.has('fullName') ? fieldErrors.fullName : undefined}
          />

          <InputField
            icon="envelope"
            iconColor="#4CAF50"
            placeholder="Email Address"
            value={formData.email}
            onChangeText={(text) => updateField('email', text)}
            onBlur={() => blurField('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={touchedFields.has('email') ? fieldErrors.email : undefined}
          />

          <InputField
            icon="mobile-alt"
            iconColor="#4CAF50"
            placeholder="Phone Number"
            value={formData.phoneNumber}
            onChangeText={(text) => updateField('phoneNumber', text)}
            onBlur={() => blurField('phoneNumber')}
            keyboardType="phone-pad"
            error={touchedFields.has('phoneNumber') ? fieldErrors.phoneNumber : undefined}
          />

          <InputField
            icon="lock"
            iconColor="#666"
            placeholder="Password"
            value={formData.password}
            onChangeText={(text) => updateField('password', text)}
            onBlur={() => blurField('password')}
            secureTextEntry
            showToggle
            error={touchedFields.has('password') ? fieldErrors.password : undefined}
            helperText="At least 6 characters with letters and numbers"
          />

          <InputField
            icon="lock"
            iconColor="#666"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            onBlur={() => blurField('confirmPassword')}
            secureTextEntry
            showToggle
            error={touchedFields.has('confirmPassword') ? fieldErrors.confirmPassword : undefined}
          />

          <SignUpButton
            onPress={handleSignUp}
            isLoading={authState.isLoading}
          />
          <Divider />
          <GoogleSignInButton onPress={handleGoogleSignIn} />
          <LoginLink onPress={handleLogin} />
        </ScrollView>
      </KeyboardAvoidingView>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={handleSelectLocation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 40,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    flex: 1,
  },
});

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
import { signInWithGoogle, signUpWithEmail } from '@/services/authService';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
} from 'react-native';

export default function ConsumerSignup() {
  const router = useRouter();
  const { formData, updateField, validateForm } = useConsumerSignup();
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const handleSignUp = async () => {
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    const result = await signUpWithEmail({
      fullName: formData.fullName,
      phoneOrEmail: formData.phoneOrEmail,
      password: formData.password,
      location: formData.location,
    });
    console.log('Signup result:', result);
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    console.log('Google signin result:', result);
  };

  const handleLogin = () => {
    // Navigate to login page
    console.log('Navigate to login');
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
            autoCapitalize="words"
          />

          <InputField
            icon="mobile-alt"
            iconColor="#4CAF50"
            placeholder="Phone Number or Email"
            value={formData.phoneOrEmail}
            onChangeText={(text) => updateField('phoneOrEmail', text)}
            keyboardType="email-address"
          />

          <InputField
            icon="lock"
            iconColor="#666"
            placeholder="Password"
            value={formData.password}
            onChangeText={(text) => updateField('password', text)}
            secureTextEntry
          />

          <InputField
            icon="lock"
            iconColor="#666"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            secureTextEntry
          />

          <SignUpButton onPress={handleSignUp} />
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
});

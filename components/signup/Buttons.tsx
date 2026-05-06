import { FontAwesome5 } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SignUpButtonProps {
  onPress: () => void;
  title?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export const SignUpButton: React.FC<SignUpButtonProps> = ({ 
  onPress, 
  title = 'Sign Up',
  isLoading = false,
  disabled = false,
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.signUpButton, 
        (disabled || isLoading) && styles.signUpButtonDisabled
      ]} 
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.signUpButtonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

interface GoogleSignInButtonProps {
  onPress: () => void;
  title?: string;
  isLoading?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  onPress, 
  title = 'Continue with Google',
  isLoading = false,
}) => {
  return (
    <TouchableOpacity 
      style={[styles.googleButton, isLoading && styles.googleButtonDisabled]} 
      onPress={onPress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#DB4437" size="small" />
      ) : (
        <>
          <FontAwesome5 name="google" size={20} color="#DB4437" />
          <Text style={styles.googleButtonText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export const Divider: React.FC = () => {
  return (
    <View style={styles.dividerContainer}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
};

interface LoginLinkProps {
  onPress: () => void;
}

export const LoginLink: React.FC<LoginLinkProps> = ({ onPress }) => {
  return (
    <View style={styles.loginContainer}>
      <Text style={styles.loginText}>Already have an account? </Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.loginLink}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  signUpButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  signUpButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#666',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: 'black',
  },
  loginLink: {
    fontSize: 17,
    color: '#2E7D32',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

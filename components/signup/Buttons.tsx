import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SignUpButtonProps {
  onPress: () => void;
  title?: string;
}

export const SignUpButton: React.FC<SignUpButtonProps> = ({ onPress, title = 'Sign Up' }) => {
  return (
    <TouchableOpacity style={styles.signUpButton} onPress={onPress}>
      <Text style={styles.signUpButtonText}>{title}</Text>
    </TouchableOpacity>
  );
};

export const GoogleSignInButton: React.FC<SignUpButtonProps> = ({ onPress, title = 'Continue with Google' }) => {
  return (
    <TouchableOpacity style={styles.googleButton} onPress={onPress}>
      <FontAwesome5 name="google" size={20} color="#DB4437" />
      <Text style={styles.googleButtonText}>{title}</Text>
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
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

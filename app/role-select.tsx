import { FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppStatusBar } from '../components/AppStatusBar';

export default function RoleSelectScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const [selectedRole, setSelectedRole] = useState<'consumer' | 'supplier'>(
    (role as 'consumer' | 'supplier') || 'consumer'
  );


  const navigateToSignup = () => {
    if (selectedRole === 'consumer') {
      router.push('/consumer/signup');
    } else {
      // Navigate to supplier signup
      router.push('/supplier/signup');
    }
  };

  const navigateToLogin = () => {
    if (selectedRole === 'consumer') {
      router.push('/consumer/login');
    } else {
      router.push('/supplier/login');
    }
  };

  const handleSwitchRole = () => {
    setSelectedRole(selectedRole === 'consumer' ? 'supplier' : 'consumer');
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#4CAF50" barStyle="dark-content" />
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Select Your Role</Text>
        <Text style={styles.subtitle}>How would you like to proceed?</Text>

        {/* Role Options Container */}
        <View style={styles.optionsContainer}>
          {/* Consumer Option */}
          <TouchableOpacity
            style={[
              styles.roleOption,
              selectedRole === 'consumer' && styles.roleOptionSelectedConsumer
            ]}
            onPress={() => setSelectedRole('consumer')}
          >
            <View style={styles.roleContent}>
              <View style={styles.iconContainer}>
                <View style={styles.consumerIconBox}>
                  <FontAwesome5 name="home" size={28} color="#4CAF50" />
                  <View style={styles.smallGasIcon}>
                    <FontAwesome5 name="burn" size={14} color="#4CAF50" />
                  </View>
                </View>
              </View>
              <View style={styles.roleTextContainer}>
<Text style={[
                  styles.roleTitle,
                  selectedRole === 'consumer' && styles.roleTitleSelectedConsumer
                ]}>
                  I&apos;m a Consumer
                </Text>
                <Text style={styles.roleDescription}>Find Gas Prices Nearby</Text>
              </View>
            </View>
            {selectedRole === 'consumer' && (
              <View style={styles.checkmarkContainer}>
                <FontAwesome5 name="check-circle" size={26} color="#4CAF50" />
              </View>
            )}
          </TouchableOpacity>

          {/* Supplier Option */}
          <TouchableOpacity
            style={[
              styles.roleOption,
              selectedRole === 'supplier' && styles.roleOptionSelectedSupplier
            ]}
            onPress={() => setSelectedRole('supplier')}
          >
            <View style={styles.roleContent}>
              <View style={styles.iconContainer}>
                <View style={styles.supplierIconBox}>
                  <FontAwesome5 name="burn" size={26} color="#FF9800" />
                  <FontAwesome5 name="check-square" size={16} color="#FF9800" style={styles.supplierCheckIcon} />
                </View>
              </View>
              <View style={styles.roleTextContainer}>
<Text style={[
                  styles.roleTitle,
                  selectedRole === 'supplier' && styles.roleTitleSelectedSupplier
                ]}>
                  I&apos;m a Supplier
                </Text>
                <Text style={styles.roleDescription}>Manage My Gas Business</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              selectedRole === 'supplier' && styles.supplierLoginButton
            ]}
            onPress={navigateToLogin}
          >
            <FontAwesome5 name="sign-in-alt" size={18} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              selectedRole === 'supplier' && styles.supplierSignUpButton
            ]}
            onPress={navigateToSignup}
          >
            <FontAwesome5 name="user-plus" size={16} color={selectedRole === 'supplier' ? '#FF9800' : '#4CAF50'} style={styles.buttonIcon} />
            <Text style={[styles.signUpButtonText, selectedRole === 'supplier' && styles.supplierSignUpButtonText]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Switch Role */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>Not the right one? </Text>
          <TouchableOpacity onPress={handleSwitchRole}>
            <Text style={styles.switchLink}>Switch Role</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  roleOptionSelectedConsumer: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  roleOptionSelectedSupplier: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  roleOptionLast: {
    marginBottom: 0,
  },
  roleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  consumerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  smallGasIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  supplierIconBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  supplierCheckIcon: {
    marginLeft: 4,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#616161',
    marginBottom: 6,
  },
  roleTitleSelectedConsumer: {
    color: '#4CAF50',
  },
  roleTitleSelectedSupplier: {
    color: '#FF9800',
  },
  roleDescription: {
    fontSize: 15,
    color: '#9e9e9e',
  },
  checkmarkContainer: {
    marginLeft: 8,
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  loginButton: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  supplierLoginButton: {
    backgroundColor: '#FF9800',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 10,
  },
  signUpButton: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  supplierSignUpButton: {
    borderColor: '#FF9800',
  },
  signUpButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '600',
  },
  supplierSignUpButtonText: {
    color: '#FF9800',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#757575',
    fontSize: 16,
  },
  switchLink: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '500',
  },
});

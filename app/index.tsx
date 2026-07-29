
import { AppStatusBar } from '@/components/AppStatusBar';
import { SplashScreen } from '@/components/SplashScreen';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'consumer' | 'supplier' | null>(null);
  const [bootResolved, setBootResolved] = useState(false);

  useEffect(() => {
    const boot = async () => {
      // Small delay keeps UX consistent with existing splash.
      await new Promise((r) => setTimeout(r, 200));

      try {
        const { getPersistentSession } = await import('@/services/persistenceSessionService');
        const { getUserRole, onAuthChange } = await import('@/services/authService');
        
        const session = await getPersistentSession();

        // Check both local session marker AND Firebase Auth state
        if (session?.emailVerified && session.uid && session.role) {
          // Wait for Firebase Auth to be fully initialized and check user state
          let authCheckComplete = false;
          
          const unsubscribe = onAuthChange(async (firebaseUser) => {
            if (authCheckComplete) return; // Prevent multiple calls
            authCheckComplete = true;
            
            unsubscribe(); // Unsubscribe after first callback
            
            if (firebaseUser && firebaseUser.uid === session.uid) {
              // Verify the user's role matches the session
              const roleResult = await getUserRole(session.uid);
              
              if (roleResult.role === session.role) {
                // Both local session and Firebase Auth are valid - navigate to dashboard
                if (session.role === 'consumer') {
                  router.replace('/(tabs)');
                  return;
                } else if (session.role === 'supplier') {
                  router.replace('/supplier/dashboard');
                  return;
                }
              }
            }
            
            // If auth check fails, show role selection
            setIsLoading(false);
            setBootResolved(true);
          });
          
          // Set a timeout in case auth state doesn't change (Firebase Auth persistence delay)
          setTimeout(async () => {
            if (!authCheckComplete) {
              authCheckComplete = true;
              unsubscribe();
              
              // Fallback: Check auth.currentUser directly if onAuthChange didn't fire
              const { auth } = await import('@/config/firebase');
              const firebaseUser = auth.currentUser;
              
              if (firebaseUser && firebaseUser.uid === session.uid) {
                getUserRole(session.uid).then(async (roleResult: any) => {
                  if (roleResult.role === session.role) {
                    if (session.role === 'consumer') {
                      router.replace('/(tabs)');
                    } else if (session.role === 'supplier') {
                      router.replace('/supplier/dashboard');
                    }
                  } else {
                    setIsLoading(false);
                    setBootResolved(true);
                  }
                }).catch(() => {
                  setIsLoading(false);
                  setBootResolved(true);
                });
              } else {
                setIsLoading(false);
                setBootResolved(true);
              }
            }
          }, 5000); // Increased timeout to 5 seconds for production Firebase Auth persistence
          
          return; // Don't set loading false yet, wait for auth callback
        }
      } catch {
        // ignore; fall through to role selection
      }

      setIsLoading(false);
      setBootResolved(true);
    };

    boot();
  }, [router]);

  if (isLoading || !bootResolved) {

    return (
      <SplashScreen 
        message="Searching for nearby vendors..."
        onAnimationComplete={() => setIsLoading(false)}
      />
    );
  }

  const handleLogin = () => {
    if (selectedRole === 'consumer') {
      router.push('/consumer/login');
    } else if (selectedRole === 'supplier') {
      router.push('/supplier/login');
    }
  };

  const handleSignUp = () => {
    if (selectedRole) {
      router.push({
        pathname: '/role-select',
        params: { role: selectedRole }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#FFFFFF" />
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <FontAwesome5 name="fire" size={36} color="#fff" />
          </View>
          <Text style={styles.logoText}>GasAround</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Welcome to GasAround</Text>
        <Text style={styles.subtitle}>Find & Compare Cooking Gas Prices Near You</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Role Selection */}
        <Text style={styles.selectText}>Please select your role to continue:</Text>

        <View style={styles.cardsContainer}>
          {/* Consumer Card */}
          <TouchableOpacity
            style={[
              styles.consumerCard,
              selectedRole === 'consumer' && styles.cardSelected
            ]}
            onPress={() => setSelectedRole('consumer')}
          >
            <View style={styles.cardIconContainer}>
              <FontAwesome5 name="home" size={42} color="#fff" />
              <View style={styles.gasIconOverlay}>
                <FontAwesome5 name="burn" size={20} color="#4CAF50" />
              </View>
            </View>
            <Text style={styles.cardTitle}>Sign in as{'\n'}Consumer</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.cardSubtitle}>Find the Best Gas{'\n'}Prices</Text>
          </TouchableOpacity>

          {/* Supplier Card */}
          <TouchableOpacity
            style={[
              styles.supplierCard,
              selectedRole === 'supplier' && styles.cardSelected
            ]}
            onPress={() => setSelectedRole('supplier')}
          >
            <View style={styles.cardIconContainer}>
              <View style={styles.cylinderIconContainer}>
                <FontAwesome5 name="burn" size={36} color="#fff" />
              </View>
              <View style={styles.checkIconOverlay}>
                <FontAwesome5 name="check-square" size={18} color="#FF9800" />
              </View>
            </View>
            <Text style={styles.cardTitle}>Sign in as{'\n'}Supplier</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.cardSubtitle}>Manage Your{'\n'}Gas Business</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              !selectedRole && styles.loginButtonDisabled,
              selectedRole === 'supplier' && styles.supplierLoginButton
            ]}
            onPress={handleLogin}
            disabled={!selectedRole}
          >
            <FontAwesome5 
              name="sign-in-alt" 
              size={18} 
              color="#fff" 
              style={styles.buttonIcon}
            />
            <Text style={styles.loginButtonText}>
              Log In as {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : '...'}
            </Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              !selectedRole && styles.signUpButtonDisabled,
              selectedRole === 'supplier' && styles.supplierSignUpButton
            ]}
            onPress={handleSignUp}
            disabled={!selectedRole}
          >
            <FontAwesome5 
              name="user-plus" 
              size={16} 
              color={selectedRole === 'supplier' ? '#FF9800' : '#4CAF50'} 
              style={styles.buttonIcon}
            />
            <Text style={[
              styles.signUpButtonText,
              selectedRole === 'supplier' && styles.supplierSignUpButtonText
            ]}>
              Sign Up as {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : '...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer - Terms & Privacy */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing with this app, you agree to our{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.footerLink} onPress={() => router.push('/privacy')}>
              Privacy Policy
            </Text>
          </Text>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  selectText: {
    fontSize: 16,
    color: '#616161',
    marginBottom: 28,
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  consumerCard: {
    width: 170,
    height: 220,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#0D8A4f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  supplierCard: {
    width: 170,
    height: 220,
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#E86C1F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  cardIconContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  gasIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  cylinderIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  cardDivider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginVertical: 12,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.95,
  },
  continueButton: {
    width: '100%',
    height: 56,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
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
  loginButtonDisabled: {
    backgroundColor: '#ccc',
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
  signUpButtonDisabled: {
    borderColor: '#ccc',
  },
  signUpButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '600',
  },
  supplierSignUpButtonText: {
    color: '#FF9800',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
});

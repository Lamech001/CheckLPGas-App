import { AppStatusBar } from "@/components/AppStatusBar";
import { signInWithEmail } from "@/services/authService";
import type { PersistentSession } from "@/services/persistenceSessionService";
import { FontAwesome5 } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SupplierLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  const safeReplace = async (target: string) => {
    if (isNavigating || pathname === target) return;
    setIsNavigating(true);
    try {
      await router.replace({ pathname: target as any });
    } catch {
      // ignore navigation failures; login already succeeded
    } finally {
      setIsNavigating(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithEmail({
        email: email.trim(),
        password,
      });

      if (result.success) {
        // Validate that user is actually a supplier, not a consumer
        if (result.role === "consumer") {
          setIsLoading(false);
          Alert.alert(
            "Wrong Login Portal",
            "You are registered as a consumer. Please use the consumer login instead.",
            [{ text: "OK", style: "default" }],
          );
          return;
        }
        // Persist correct local session marker so startup/router does not redirect to consumer.
        try {
          const { persistVerifiedSession } =
            await import("@/services/persistenceSessionService");
          const sess: Omit<PersistentSession, "createdAt" | "updatedAt"> = {
            role: "supplier",
            uid: result.user?.uid || "",
            emailVerified: true,
          };
          // Fire-and-forget persistence; login already succeeded.
          await persistVerifiedSession(sess);
        } catch {
          // Ignore local persistence failures.
        }

        // Fetch and cache user data for offline access
        try {
          const { getUserData } = await import("@/services/authService");
          const { cacheUserProfile } = await import("@/services/cacheService");
          const userData = await getUserData(result.user?.uid || "");
          if (userData) {
            await cacheUserProfile(userData);
          }
        } catch {
          // Ignore caching failures; login already succeeded.
        }

        // Prefetch supplier dashboard data for offline-first instant dashboard
        try {
          const { getSupplierData } =
            await import("@/services/supplierAuthService");
          const uid = result.user?.uid || "";
          if (uid) {
            const res = await getSupplierData(uid);
            // getSupplierData itself persists offline cache on success
            if (!res?.success) {
              // ignore
            }
          }
        } catch {
          // Ignore caching failures; navigation should still work.
        }

        // INSTANT NAVIGATION: Go to supplier dashboard (orders are accessible from dashboard)
        setIsLoading(false);
        await safeReplace("/supplier/dashboard");
        return;
      } else if (result.emailNotVerified) {
        Alert.alert(
          "Email Not Verified",
          "Please verify your email before logging in.\n\n" +
            "We've sent a new verification link to your email.",
          [{ text: "OK", style: "default" }],
        );
      } else if (result.error === "offline") {
        setIsLoading(false);
        router.replace("/supplier/dashboard");
        return;
      } else {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (err: any) {
      if (err.message?.includes("network")) {
        setError("Network error. Please check your internet connection.");
      } else if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(
          err.message || "An error occurred during login. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(
        "Enter Email",
        "Please enter your email address to reset your password.",
      );
      return;
    }

    try {
      const { resetPassword } = await import("@/services/authService");
      const result = await resetPassword(email.trim());

      if (result.success) {
        Alert.alert(
          "Password Reset Email Sent",
          "We've sent a password reset link to your email address.",
        );
      } else {
        Alert.alert("Error", result.error || "Failed to send reset email");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email");
    }
  };

  const handleSignUp = () => {
    router.push("/supplier/signup");
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#FF6B35" barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoIcon}>
              <FontAwesome5 name="fire" size={50} color="#FF5722" />
            </View>
            <Text style={styles.logoText}>GasAround</Text>
          </View>

          {/* Main Card Container */}
          <View style={styles.cardContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Supplier Login</Text>
              <Text style={styles.subtitle}>
                Access your business dashboard
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => setError(null)}>
                  <FontAwesome5 name="times" size={16} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            )}

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <FontAwesome5 name="envelope" size={20} color="#FF9800" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIconContainer}>
                    <FontAwesome5 name="lock" size={20} color="#FF9800" />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <FontAwesome5
                      name={showPassword ? "eye-slash" : "eye"}
                      size={18}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotPasswordContainer}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Login Button */}
              <TouchableOpacity
                style={[
                  styles.loginButton,
                  (!email || !password || isLoading) &&
                    styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={!email || !password || isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[styles.loginButtonText, styles.loadingText]}>
                      Logging in...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.loginButtonText}>Log In</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>
                Don&apos;t have an account?{" "}
              </Text>
              <TouchableOpacity onPress={handleSignUp}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E65100",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 1,
  },
  cardContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffebee",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#d32f2f",
    fontSize: 14,
  },
  formContainer: {
    width: "100%",
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputIconContainer: {
    width: 36,
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#FF9800",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#FF9800",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: "#ffcc80",
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 10,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e9ecef",
  },
  dividerText: {
    fontSize: 12,
    color: "#999",
    marginHorizontal: 12,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
    color: "#666",
  },
  signupLink: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "bold",
  },
});

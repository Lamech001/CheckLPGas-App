import { auth } from "@/config/firebase";

import { getUserRole } from "@/services/authService";

import { FontAwesome5 } from "@expo/vector-icons";

import * as Linking from "expo-linking";

import { useLocalSearchParams, useRouter } from "expo-router";

import { applyActionCode, checkActionCode } from "firebase/auth";

import { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { AppStatusBar } from "@/components/AppStatusBar";

export default function VerifyEmailScreen() {
  const router = useRouter();

  const {
    email,
    role,
    from,
    verifying: verifyingParam,
    oobCode,
  } = useLocalSearchParams<{
    email: string;

    role: string;

    from: string;

    verifying: string;

    oobCode: string;
  }>();

  const [isVerifying, setIsVerifying] = useState(verifyingParam === "true");

  const [resendLoading, setResendLoading] = useState(false);

  const [verificationError, setVerificationError] = useState("");

  const [isVerified, setIsVerified] = useState(false);

  const handleDeepLinkVerification = useCallback(async (code: string) => {
    setIsVerifying(true);

    setVerificationError("");

    try {
      // Apply the action code to verify email

      await applyActionCode(auth, code);

      // Reload user to get updated emailVerified status

      const user = auth.currentUser;

      if (user) {
        await user.reload();

        if (user.emailVerified) {
          // Get user role and redirect

          const roleResult = await getUserRole(user.uid);

          const userRole = role || roleResult.role || "consumer";

          // Show success state

          setIsVerifying(false);

          setIsVerified(true);

          // Small delay to show success before redirect

          setTimeout(() => {
            // Persist local session marker for offline-first startup.

            // IMPORTANT: local marker is only set when Firebase confirms emailVerified.

            // Note: setTimeout callback is not async; do persistence via fire-and-forget.

            try {
              import("@/services/persistenceSessionService")

                .then(({ persistVerifiedSession }) =>
                  persistVerifiedSession({
                    role: userRole === "supplier" ? "supplier" : "consumer",

                    uid: user.uid,

                    emailVerified: true,
                  }),
                )

                .catch(() => {});
            } catch {
              // Silent fail - navigation still happens.
            }

            if (userRole === "supplier") {
              router.replace("/supplier/dashboard");
            } else {
              router.replace("/(tabs)");
            }
          }, 1500);
        }
      }
    } catch (error: any) {
      console.error("Email verification error:", error);

      setVerificationError(
        "Verification failed. The link may be expired or invalid.",
      );

      setIsVerifying(false);

      // Check what the error is

      try {
        await checkActionCode(auth, code);
      } catch {
        console.error("Action code check error");
      }
    }
  }, [role, router]);

  // Handle deep link verification with oobCode

  useEffect(() => {
    if (oobCode && verifyingParam === "true") {
      // Avoid calling setState synchronously within an effect.
      Promise.resolve().then(() => {
        handleDeepLinkVerification(oobCode);
      });
    }
  }, [oobCode, verifyingParam, handleDeepLinkVerification]);

  // Check current auth user once after render for signup verification flow

  useEffect(() => {
    if (oobCode) return;

    const checkVerified = async () => {
      const user = auth.currentUser;

      if (!user) return;

      try {
        await user.reload();

        if (user.emailVerified) {
          setIsVerified(true);

          setTimeout(() => {
            // Persist local session marker for offline-first startup
            const roleResult = role || "consumer";
            try {
              import("@/services/persistenceSessionService")
                .then(({ persistVerifiedSession }) =>
                  persistVerifiedSession({
                    role: roleResult === "supplier" ? "supplier" : "consumer",
                    uid: user.uid,
                    emailVerified: true,
                  }),
                )
                .catch(() => {});
            } catch {
              // Silent fail - navigation still happens
            }

            if (role === "supplier") {
              router.replace("/supplier/dashboard");
            } else {
              router.replace("/(tabs)");
            }
          }, 1500);
        }
      } catch {
        console.warn("[VerifyEmail] Could not reload user");
      }
    };

    checkVerified();
  }, [role, router, oobCode]);

  const handleOpenEmail = async () => {
    // Try to open default email app

    const url = "mailto:";

    try {
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Email App",
          "Please check your email app for the verification link.",
        );
      }
    } catch {
      Alert.alert(
        "Email App",
        "Please check your email app for the verification link.",
      );
    }
  };

  const handleResendEmail = async () => {
    setResendLoading(true);

    try {
      const user = auth.currentUser;

      if (user) {
        const { sendEmailVerification } = await import("firebase/auth");

        await sendEmailVerification(user);

        Alert.alert(
          "Email Sent",
          "A new verification email has been sent to your inbox.",
        );
      }
    } catch {
      Alert.alert("Error", "Failed to resend email. Please try again later.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToLogin = () => {
    if (from === "supplier") {
      router.replace("/supplier/login");
    } else {
      router.replace("/role-select");
    }
  };

  if (isVerifying) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <AppStatusBar backgroundColor="#4CAF50" barStyle="dark-content" />

        <ActivityIndicator size="large" color="#1976D2" />

        <Text style={styles.verifyingText}>Verifying your email...</Text>
      </SafeAreaView>
    );
  }

  if (isVerified) {
    return (
      <SafeAreaView style={[styles.container, styles.centerContent]}>
        <AppStatusBar backgroundColor="#4CAF50" barStyle="dark-content" />

        <View style={styles.successIconCircle}>
          <FontAwesome5 name="check" size={48} color="#fff" />
        </View>

        <Text style={styles.successTitle}>Email Verified!</Text>

        <Text style={styles.successText}>Redirecting to your dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppStatusBar backgroundColor="#4CAF50" barStyle="dark-content" />

      <View style={styles.content}>
        {/* Success Icon */}

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <FontAwesome5 name="envelope" size={48} color="#1976D2" />
          </View>

          <View style={styles.badge}>
            <FontAwesome5 name="check" size={14} color="#fff" />
          </View>
        </View>

        {/* Title */}

        <Text style={styles.title}>Check Your Email!</Text>

        {/* Description */}

        <Text style={styles.description}>
          We&apos;ve sent a verification link to:
        </Text>

        <Text style={styles.emailText}>{email || "your email address"}</Text>

        <Text style={styles.instructions}>
          Click the link in the email to verify your account and access your{" "}
          {role || "supplier"} dashboard.
        </Text>

        {/* Email Button */}

        <TouchableOpacity style={styles.emailButton} onPress={handleOpenEmail}>
          <FontAwesome5
            name="envelope-open"
            size={18}
            color="#fff"
            style={styles.buttonIcon}
          />

          <Text style={styles.emailButtonText}>Open Email App</Text>
        </TouchableOpacity>

        {/* Resend Section */}

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn&apos;t receive the email?</Text>

          <TouchableOpacity
            onPress={handleResendEmail}
            disabled={resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator size="small" color="#1976D2" />
            ) : (
              <Text style={styles.resendLink}>Resend Email</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Error Message */}

        {verificationError ? (
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" />

            <Text style={styles.errorText}>{verificationError}</Text>
          </View>
        ) : null}

        {/* Help Text */}

        <View style={styles.helpContainer}>
          <FontAwesome5 name="info-circle" size={16} color="#666" />

          <Text style={styles.helpText}>
            The verification link will expire in 24 hours. Check your spam
            folder if you don&apos;t see it.
          </Text>
        </View>

        {/* Back Button */}

        <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: "#fff",
  },

  centerContent: {
    justifyContent: "center",

    alignItems: "center",

    gap: 16,
  },

  content: {
    flex: 1,

    alignItems: "center",

    paddingHorizontal: 32,

    paddingTop: 60,
  },

  iconContainer: {
    position: "relative",

    marginBottom: 24,
  },

  iconCircle: {
    width: 100,

    height: 100,

    borderRadius: 50,

    backgroundColor: "#E3F2FD",

    justifyContent: "center",

    alignItems: "center",
  },

  badge: {
    position: "absolute",

    bottom: 0,

    right: 0,

    width: 32,

    height: 32,

    borderRadius: 16,

    backgroundColor: "#4CAF50",

    justifyContent: "center",

    alignItems: "center",

    borderWidth: 3,

    borderColor: "#fff",
  },

  title: {
    fontSize: 28,

    fontWeight: "700",

    color: "#1a1a1a",

    marginBottom: 16,

    textAlign: "center",
  },

  description: {
    fontSize: 16,

    color: "#666",

    textAlign: "center",

    marginBottom: 8,
  },

  emailText: {
    fontSize: 16,

    fontWeight: "600",

    color: "#1976D2",

    textAlign: "center",

    marginBottom: 16,
  },

  instructions: {
    fontSize: 15,

    color: "#444",

    textAlign: "center",

    lineHeight: 22,

    marginBottom: 32,
  },

  emailButton: {
    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#1976D2",

    paddingVertical: 16,

    paddingHorizontal: 32,

    borderRadius: 12,

    width: "100%",

    marginBottom: 24,
  },

  buttonIcon: {
    marginRight: 12,
  },

  emailButtonText: {
    color: "#fff",

    fontSize: 16,

    fontWeight: "600",
  },

  resendContainer: {
    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    marginBottom: 24,
  },

  resendText: {
    fontSize: 14,

    color: "#666",
  },

  resendLink: {
    fontSize: 14,

    color: "#1976D2",

    fontWeight: "600",
  },

  helpContainer: {
    flexDirection: "row",

    alignItems: "flex-start",

    backgroundColor: "#F5F5F5",

    padding: 16,

    borderRadius: 12,

    gap: 12,

    marginBottom: 32,
  },

  helpText: {
    flex: 1,

    fontSize: 13,

    color: "#666",

    lineHeight: 18,
  },

  backButton: {
    paddingVertical: 12,

    paddingHorizontal: 24,
  },

  backButtonText: {
    fontSize: 14,

    color: "#666",
  },

  verifyingText: {
    fontSize: 18,

    color: "#1976D2",

    fontWeight: "600",
  },

  errorContainer: {
    flexDirection: "row",

    alignItems: "flex-start",

    backgroundColor: "#FFEBEE",

    padding: 16,

    borderRadius: 12,

    gap: 12,

    marginBottom: 24,

    width: "100%",
  },

  errorText: {
    flex: 1,

    fontSize: 14,

    color: "#f44336",

    lineHeight: 20,
  },

  successIconCircle: {
    width: 100,

    height: 100,

    borderRadius: 50,

    backgroundColor: "#4CAF50",

    justifyContent: "center",

    alignItems: "center",

    marginBottom: 24,
  },

  successTitle: {
    fontSize: 28,

    fontWeight: "700",

    color: "#4CAF50",

    marginBottom: 12,
  },

  successText: {
    fontSize: 16,

    color: "#666",
  },
});

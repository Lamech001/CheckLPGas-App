import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface SplashScreenProps {
  message?: string;
  onAnimationComplete?: () => void;
}

export function SplashScreen({
  message = "Searching for nearby vendors...",
  onAnimationComplete,
}: SplashScreenProps) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.8));

  useEffect(() => {
    // Fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Call completion callback quickly
      if (onAnimationComplete) {
        setTimeout(onAnimationComplete, 500);
      }
    });
  }, [fadeAnim, scaleAnim, onAnimationComplete]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Logo Container with Orange Circle */}
        <View style={styles.logoContainer}>
          <View style={styles.circle}>
            <Image
              source={require("../assets/images/android-icon-foreground.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
        </View>

        {/* Brand Name */}
        <Text style={styles.brandName}>GasAround</Text>

        {/* Loading Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Loading Indicator */}
        <ActivityIndicator size="small" color="#F97316" style={styles.loader} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  circle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#FFF7ED", // Light orange background
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#F97316", // Orange border
  },
  logo: {
    width: 120,
    height: 120,
  },
  brandName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1E3A5F", // Dark blue
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 16,
    color: "#6B7280", // Gray
    marginBottom: 24,
    textAlign: "center",
  },
  loader: {
    marginTop: 8,
  },
});

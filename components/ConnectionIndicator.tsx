/**
 * Connection Indicator - Shows smooth connection status without errors
 * Appears briefly when connection is restored, disappears when stable
 */

import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export function ConnectionIndicator(): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected === true && state.isInternetReachable === true;
      
      if (isConnected) {
        // Show "Back online" briefly
        setMessage('Back online');
        setIsVisible(true);
        
        // Clear any existing timeout
        if (hideTimeout.current) {
          clearTimeout(hideTimeout.current);
        }
        
        // Hide after 2 seconds
        hideTimeout.current = setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setIsVisible(false));
        }, 2000);
      }
    });

    return () => {
      unsubscribe();
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, [fadeAnim]);

  useEffect(() => {
    if (isVisible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, fadeAnim]);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <View style={styles.dot} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

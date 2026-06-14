import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function LoadingOverlay({
  visible,
  label,
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});





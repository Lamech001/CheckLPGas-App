import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

// Complete example for setting status bar icons to black (dark-content)
// Works on both Android and iOS.
export default function App() {
  return (
    // Optional wrapper is fine; status bar is independent
    <>
      <StatusBar
        // Required: make icons/text dark
        barStyle="dark-content"
        // Required for Android to ensure icon contrast
        backgroundColor="#ffffff"
      />
    </>
  );
}

// Note:
// In your project you currently use expo-router with TSX screens.
// If you need this globally, put <StatusBar ... /> inside your root layout instead of this App.js.


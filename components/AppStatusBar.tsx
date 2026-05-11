import * as NavigationBar from 'expo-navigation-bar';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

interface AppStatusBarProps {
  backgroundColor?: string;
  barStyle?: 'default' | 'light-content' | 'dark-content';
  navBarButtonColor?: 'light' | 'dark';
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  backgroundColor = '#2E7D32',
  barStyle = 'light-content',
  navBarButtonColor = 'dark',
}) => {
  const pathname = usePathname();

  const applyStatusBar = useCallback(() => {
    // Set status bar color immediately using RN StatusBar for Android
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor(backgroundColor);
      RNStatusBar.setTranslucent(false);
      NavigationBar.setButtonStyleAsync(navBarButtonColor);
    }
    RNStatusBar.setBarStyle(barStyle);
  }, [backgroundColor, barStyle, navBarButtonColor]);

  useEffect(() => {
    applyStatusBar();
  }, [pathname, applyStatusBar]);

  // Return actual StatusBar component from expo-status-bar
  // Map barStyle: 'light-content' -> 'light', 'dark-content' -> 'dark', 'default' -> 'auto'
  const statusBarStyle = barStyle === 'light-content' ? 'light' : barStyle === 'dark-content' ? 'dark' : 'auto';
  return <StatusBar style={statusBarStyle as any} backgroundColor={backgroundColor} />;
};

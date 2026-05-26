import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';

interface AppStatusBarProps {
  backgroundColor?: string;
  /** @deprecated Always uses dark-content (dark icons) app-wide */
  barStyle?: 'default' | 'light-content' | 'dark-content';
  navBarButtonColor?: 'light' | 'dark';
}

/** Status bar with dark system icons (battery, time, signal) on every screen. */
export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  backgroundColor = '#FFFFFF',
}) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    RNStatusBar.setBarStyle('dark-content', true);
    RNStatusBar.setBackgroundColor(backgroundColor, true);
    RNStatusBar.setTranslucent(false);
    NavigationBar.setButtonStyleAsync('dark').catch(() => {});
  }, [backgroundColor]);

  return <StatusBar style="dark" backgroundColor={backgroundColor} translucent={false} />;
};

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

  // Let expo-status-bar handle the visual bar.
  // RN StatusBar updates can introduce a 1px divider on some Android devices.
  const statusBarStyle = barStyle === 'light-content' ? 'light' : barStyle === 'dark-content' ? 'dark' : 'auto';

  // IMPORTANT: on some Android devices, RN StatusBar background updates can render
  // a 1px divider line under the status bar in release/assembleRelease builds.
  // We avoid setting RN StatusBar styles here and rely only on expo-status-bar.
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(navBarButtonColor);
    }
  }, [pathname, navBarButtonColor]);


  return <StatusBar style={statusBarStyle as any} backgroundColor={backgroundColor} />;
};



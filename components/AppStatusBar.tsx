import { useNavigation } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';

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
  const navigation = useNavigation();

  const applyStatusBar = () => {
    // Set status bar color immediately
    StatusBar.setBackgroundColor(backgroundColor);
    StatusBar.setBarStyle(barStyle);
    
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(navBarButtonColor);
    }
    
    // Keep status bar visible and prevent it from hiding
    StatusBar.setTranslucent(false);
  };

  useEffect(() => {
    applyStatusBar();
    
    // Re-apply when screen comes into focus
    const unsubscribe = navigation.addListener('focus', applyStatusBar);
    return unsubscribe;
  }, [navigation, backgroundColor, barStyle, navBarButtonColor]);

  // Return null since we're using imperative API
  return null;
};

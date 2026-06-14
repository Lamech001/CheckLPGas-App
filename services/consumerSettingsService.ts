import AsyncStorage from '@react-native-async-storage/async-storage';

export type ConsumerSettings = {
  darkModeEnabled?: boolean;
  notificationsEnabled?: boolean;
  locationEnabled?: boolean;
};

export async function getConsumerSettings(): Promise<ConsumerSettings> {
  const [darkMode, notificationsEnabled, locationEnabled] = await Promise.all([
    AsyncStorage.getItem('@darkModeEnabled'),
    AsyncStorage.getItem('@notificationsEnabled'),
    AsyncStorage.getItem('@locationEnabled'),
  ]);

  return {
    darkModeEnabled: darkMode === 'true',
    notificationsEnabled: notificationsEnabled === 'true',
    locationEnabled: locationEnabled === 'true',
  };
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem('@notificationsEnabled');
  return v === null ? true : v === 'true';
}

export async function getLocationEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem('@locationEnabled');
  return v === null ? true : v === 'true';
}


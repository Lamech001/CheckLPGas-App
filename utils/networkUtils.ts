/**
 * Network Utilities - Network status detection and management
 */

import NetInfo from '@react-native-community/netinfo';

export interface NetworkState {
  isOnline: boolean;
  isConnected: boolean;
  type: string;
}

/**
 * Check if device is currently online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    console.error('Network check failed:', error);
    return false;
  }
};

/**
 * Get current network state
 */
export const getNetworkState = async (): Promise<NetworkState> => {
  try {
    const state = await NetInfo.fetch();
    return {
      isOnline: state.isConnected === true && state.isInternetReachable === true,
      isConnected: state.isConnected === true,
      type: state.type,
    };
  } catch (error) {
    console.error('Network state fetch failed:', error);
    return {
      isOnline: false,
      isConnected: false,
      type: 'none',
    };
  }
};

/**
 * Subscribe to network state changes
 */
export const subscribeToNetworkChanges = (
  callback: (state: NetworkState) => void
): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    callback({
      isOnline: state.isConnected === true && state.isInternetReachable === true,
      isConnected: state.isConnected === true,
      type: state.type,
    });
  });

  return unsubscribe;
};

/**
 * Wait for network to come online
 */
export const waitForOnline = (timeoutMs: number = 30000): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check immediately
    isOnline().then((online) => {
      if (online) {
        resolve(true);
        return;
      }
    });

    // Set up listener
    const unsubscribe = subscribeToNetworkChanges((state) => {
      if (state.isOnline) {
        unsubscribe();
        resolve(true);
      }
    });

    // Timeout
    setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
  });
};

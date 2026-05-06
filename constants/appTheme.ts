/**
 * App Theme Configuration
 * All colors, sizes, and constants are defined here to avoid hardcoding
 */

export const AppColors = {
  // Primary colors
  primary: '#1976D2',
  primaryLight: '#E3F2FD',
  primaryDark: '#1565C0',
  
  // Status colors
  success: '#00C853',
  successLight: '#4CAF50',
  error: '#FF1744',
  errorLight: '#f44336',
  warning: '#FF9800',
  
  // Neutral colors
  white: '#fff',
  black: '#000',
  background: '#f5f5f5',
  surface: '#fff',
  
  // Text colors
  textPrimary: '#1a1a1a',
  textSecondary: '#666',
  textTertiary: '#999',
  textLight: '#fff',
  
  // UI colors
  border: '#f0f0f0',
  borderLight: '#eee',
  shadow: '#000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  
  // Map colors
  mapUserMarker: '#0066FF',
  mapRadiusStroke: 'rgba(0, 102, 255, 0.8)',
  mapRadiusFill: 'rgba(0, 150, 255, 0.15)',
  mapSupplierOpen: '#00C853',
  mapSupplierClosed: '#FF1744',
  
  // Status bar
  statusBarSupplier: '#2E7D32',
  statusBarConsumer: '#1976D2',
  
  // Special
  flame: '#FF6B35',
  kenyanGreen: '#4CAF50',
};

export const AppSizes = {
  // Border radius
  radiusSmall: 6,
  radiusMedium: 8,
  radiusLarge: 12,
  radiusXLarge: 16,
  radiusXXLarge: 20,
  
  // Spacing
  spacingXS: 4,
  spacingSmall: 8,
  spacingMedium: 12,
  spacingLarge: 16,
  spacingXLarge: 20,
  spacingXXLarge: 24,
  
  // Font sizes
  fontXSmall: 12,
  fontSmall: 13,
  fontMedium: 14,
  fontLarge: 15,
  fontXLarge: 16,
  fontXXLarge: 20,
  fontTitle: 20,
  fontHeader: 24,
  
  // Icon sizes
  iconSmall: 14,
  iconMedium: 16,
  iconLarge: 18,
  iconXLarge: 20,
  iconXXLarge: 24,
  iconHuge: 48,
  
  // Component sizes
  buttonHeight: 48,
  inputHeight: 48,
  statusBarHeight: 50,
  menuWidth: 0.75, // 75% of screen width
  
  // Map
  mapStrokeWidth: 4,
  mapRadiusKm: 1,
  mapLatitudeDelta: 0.022,
  mapLongitudeDelta: 0.012,
};

export const AppConstants = {
  // App info
  appName: 'GasAround',
  appVersion: '1.0.0',
  appTagline: 'Find the Best Cooking Gas Prices Near You',
  supportEmail: 'support@gasafrica.com',
  
  // Radius
  defaultRadiusKm: 1,
  maxRadiusKm: 5,
  
  // Cylinder sizes
  cylinderSizes: [6, 13, 19] as const,
  
  // Time
  defaultOpeningTime: '08:00',
  defaultClosingTime: '18:00',
  
  // Validation
  minPasswordLength: 6,
  maxPasswordLength: 128,
  
  // Animation
  menuDelayMs: 300,
  modalDelayMs: 300,
  
  // Delays
  splashScreenDelay: 1500,
};

export const AppShadows = {
  small: {
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 } as const,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 } as const,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 3 } as const,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  menu: {
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 2, height: 0 } as const,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const AppFonts = {
  weightNormal: '400',
  weightMedium: '500',
  weightSemiBold: '600',
  weightBold: '700',
};

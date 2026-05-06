import { signUpWithEmail } from '@/services/authService';
import { getCurrentLocation } from '@/services/locationService';
import { useEffect, useState } from 'react';

interface SignupFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  location: string;
}

interface AuthState {
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export const useConsumerSignup = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    location: 'Detecting location...',
  });

  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    isAuthenticated: false,
  });

  // Get location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      const locationData = await getCurrentLocation();
      if (locationData) {
        setFormData(prev => ({ ...prev, location: locationData.address }));
      }
    };

    fetchLocation();
  }, []);

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): { isValid: boolean; error?: string } => {
    if (!formData.fullName.trim()) {
      return { isValid: false, error: 'Please enter your full name' };
    }
    if (!formData.email.trim()) {
      return { isValid: false, error: 'Please enter your email address' };
    }
    if (!formData.email.includes('@')) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    if (!formData.phoneNumber.trim()) {
      return { isValid: false, error: 'Please enter your phone number' };
    }
    if (!formData.password) {
      return { isValid: false, error: 'Please enter a password' };
    }
    if (formData.password.length < 6) {
      return { isValid: false, error: 'Password must be at least 6 characters' };
    }
    if (formData.password !== formData.confirmPassword) {
      return { isValid: false, error: 'Passwords do not match' };
    }
    return { isValid: true };
  };

  // Main signup handler - creates user and sends email verification
  const signUp = async (): Promise<{ success: boolean; error?: string }> => {
    const validation = validateForm();
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await signUpWithEmail({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        role: 'consumer',
        location: formData.location,
      });

      if (result.success) {
        setAuthState(prev => ({ 
          ...prev, 
          isLoading: false, 
          isAuthenticated: true 
        }));
        return { success: true };
      } else {
        const errorMsg = result.error || 'Signup failed';
        setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
        return { success: false, error: errorMsg };
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }
  };

  const clearError = () => {
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      location: 'Detecting location...',
    });
    setAuthState({
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });
  };

  return {
    formData,
    updateField,
    validateForm,
    signUp,
    authState,
    clearError,
    resetForm,
  };
};

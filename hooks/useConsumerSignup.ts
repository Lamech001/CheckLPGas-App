import { fastSignup } from '@/services/fastAuth';
import { getCurrentLocation } from '@/services/locationService';
import { useCallback, useEffect, useState } from 'react';

interface SignupFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  location: string;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  location?: string;
}

interface AuthState {
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  progress: number;
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

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    isAuthenticated: false,
    progress: 0,
  });

  // Calculate form completion progress
  const calculateProgress = useCallback(() => {
    const fields = ['fullName', 'email', 'phoneNumber', 'password', 'confirmPassword'];
    const filled = fields.filter(f => formData[f as keyof SignupFormData]?.trim?.()).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData]);

  // Update progress when form changes
  useEffect(() => {
    setAuthState(prev => ({ ...prev, progress: calculateProgress() }));
  }, [calculateProgress]);

  // Get location on mount with timeout
  useEffect(() => {
    const fetchLocation = async () => {
      const timeout = setTimeout(() => {
        setFormData(prev => ({ ...prev, location: 'Location detection timeout - tap to set manually' }));
      }, 5000);

      const locationData = await getCurrentLocation();
      clearTimeout(timeout);
      
      if (locationData) {
        setFormData(prev => ({ ...prev, location: locationData.address }));
      } else {
        setFormData(prev => ({ ...prev, location: 'Tap to set your location' }));
      }
    };

    fetchLocation();
  }, []);

  // Inline field validation
  const validateField = useCallback((field: keyof SignupFormData, value: string): string | undefined => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
        return undefined;
      case 'phoneNumber':
        if (!value.trim()) return 'Phone number is required';
        if (!/^[\d\s\-+()]{10,}$/.test(value)) return 'Please enter a valid phone number';
        return undefined;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) return 'Password needs letters and numbers';
        return undefined;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return undefined;
      default:
        return undefined;
    }
  }, [formData.password]);

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Mark field as touched
    setTouchedFields(prev => new Set(prev).add(field));
    
    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Validate confirm password when password changes
    if (field === 'password' && formData.confirmPassword) {
      const error = validateField('confirmPassword', formData.confirmPassword);
      setFieldErrors(prev => ({ ...prev, confirmPassword: error }));
    }
  };

  const blurField = (field: keyof SignupFormData) => {
    setTouchedFields(prev => new Set(prev).add(field));
    const error = validateField(field, formData[field]);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateForm = (): { isValid: boolean; error?: string; fieldErrors?: FieldErrors } => {
    const errors: FieldErrors = {};
    let isValid = true;

    // Validate all fields
    (Object.keys(formData) as Array<keyof SignupFormData>).forEach(field => {
      if (field !== 'location') {
        const error = validateField(field, formData[field]);
        if (error) {
          errors[field] = error;
          isValid = false;
        }
      }
    });

    // Mark all fields as touched
    setTouchedFields(new Set(Object.keys(formData)));
    setFieldErrors(errors);

    return { isValid, error: isValid ? undefined : Object.values(errors)[0], fieldErrors: errors };
  };

  // Main signup handler - creates user and sends email verification
  const signUp = async (): Promise<{ success: boolean; error?: string }> => {
    if (!validateForm().isValid) {
      return { success: false, error: 'Please fix the errors above' };
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use fast signup for instant feedback
      const result = await fastSignup({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        role: 'consumer',
      });

      if (result.success) {
        setAuthState(prev => ({ ...prev, isLoading: false, isAuthenticated: true }));
        return { success: true };
      } else {
        const errorMsg = result.error || 'Registration failed';
        setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
        return { success: false, error: errorMsg };
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    } finally {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }

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
      progress: 0,
    });
    setFieldErrors({});
    setTouchedFields(new Set());
  };

  return {
    formData,
    updateField,
    blurField,
    validateForm,
    signUp,
    authState,
    fieldErrors,
    touchedFields,
    clearError,
    resetForm,
  };
};

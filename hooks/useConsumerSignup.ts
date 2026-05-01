import { getCurrentLocation } from '@/services/locationService';
import { useEffect, useState } from 'react';

interface SignupFormData {
  fullName: string;
  phoneOrEmail: string;
  password: string;
  confirmPassword: string;
  location: string;
}

export const useConsumerSignup = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    fullName: '',
    phoneOrEmail: '',
    password: '',
    confirmPassword: '',
    location: 'Detecting location...',
  });

  useEffect(() => {
    // Try to get actual location
    const fetchLocation = async () => {
      const locationData = await getCurrentLocation();
      if (locationData) {
        setFormData(prev => ({ ...prev, location: locationData.address }));
      } else {
        setFormData(prev => ({ ...prev, location: "Murang'a, Kenya" }));
      }
    };
    
    fetchLocation();
  }, []);

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) return false;
    if (!formData.phoneOrEmail.trim()) return false;
    if (!formData.password) return false;
    if (formData.password !== formData.confirmPassword) return false;
    return true;
  };

  return {
    formData,
    updateField,
    validateForm,
  };
};

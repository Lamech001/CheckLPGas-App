export const signUpWithEmail = async (userData: {
  fullName: string;
  phoneOrEmail: string;
  password: string;
  location: string;
}) => {
  // TODO: Implement actual API call
  console.log('Signing up:', userData);
  return { success: true, message: 'Signup successful' };
};

export const signInWithGoogle = async () => {
  // TODO: Implement Google OAuth
  console.log('Google sign in');
  return { success: true, message: 'Google sign in successful' };
};

export const setLocationManually = async () => {
  // TODO: Implement location picker
  console.log('Opening location picker');
};

import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile, User } from 'firebase/auth';

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/config/firebase';

import * as Haptics from 'expo-haptics';



interface FastSignupData {

  fullName: string;

  email: string;

  password: string;

  phoneNumber: string;

  role: 'consumer' | 'supplier';

}



interface FastAuthResult {

  success: boolean;

  user?: User;

  error?: string;

  emailNotVerified?: boolean;

}



// Ultra-fast signup with immediate feedback

export const fastSignup = async (data: FastSignupData): Promise<FastAuthResult> => {

  try {

    // Immediate haptic feedback

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);



    // Create user account

    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);

    const user = userCredential.user;



    // Update profile immediately

    await updateProfile(user, { displayName: data.fullName });



    // Create user document in Firestore (fire and forget for speed)

    const userRef = doc(db, 'users', user.uid);

    const userData = {

      uid: user.uid,

      email: data.email,

      displayName: data.fullName,

      phoneNumber: data.phoneNumber,

      role: data.role,

      createdAt: serverTimestamp(),

      updatedAt: serverTimestamp(),

    };



    // Properly await Firestore write to ensure phone number is saved

    try {

      await setDoc(userRef, userData);

    } catch (err) {

      console.error('[FastAuth] User doc save failed:', err);

    }



    // Send verification email (don't await)

    sendEmailVerification(user).catch(() => {});



    // Success haptic

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);



    return { success: true, user };

  } catch (error: any) {

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);



    if (error.code === 'auth/email-already-in-use') {

      return {

        success: false,

        error: 'Looks like you already have an account! Please click the "Login" button above to sign in.'

      };

    }



    return {

      success: false,

      error: getFriendlyErrorMessage(error.code) || 'Registration failed. Please try again.'

    };

  }

};



// Ultra-fast login

export const fastLogin = async (email: string, password: string): Promise<FastAuthResult> => {

  try {

    // Immediate haptic feedback

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);



    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;



    if (!user.emailVerified) {

      sendEmailVerification(user).catch(() => {});

      return {

        success: false,

        error: 'Please verify your email before logging in. Check your inbox for the verification link.',

        emailNotVerified: true

      };

    }



    // Success haptic

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);



    return { success: true, user };

  } catch (error: any) {

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);



    return {

      success: false,

      error: getFriendlyErrorMessage(error.code) || 'Login failed. Please check your credentials.'

    };

  }

};



const getFriendlyErrorMessage = (errorCode: string): string => {

  switch (errorCode) {

    case 'auth/invalid-email':

      return 'Invalid email address. Please check and try again.';

    case 'auth/user-disabled':

      return 'This account has been disabled. Please contact support.';

    case 'auth/user-not-found':

      return 'No account found with this email. Please sign up first.';

    case 'auth/wrong-password':

      return 'Incorrect password. Please try again.';

    case 'auth/weak-password':

      return 'Password is too weak. Please use at least 6 characters.';

    case 'auth/too-many-requests':

      return 'Too many attempts. Please try again later.';

    default:

      return '';

  }

};


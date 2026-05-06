import { User } from 'firebase/auth';

export type UserRole = 'consumer' | 'supplier';

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  role: UserRole;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface GoogleSignInProvider {
  signIn: (role: UserRole) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  isAvailable: () => boolean;
}

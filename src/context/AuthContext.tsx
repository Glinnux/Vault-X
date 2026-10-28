import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { isUserAdmin } from '../services/adminService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isBanned: boolean;
  bannedReason: string;
  authError: string | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  recoveryNotice: { code: string; expiresAt: number } | null;
  clearRecoveryNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedReason, setBannedReason] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{ code: string; expiresAt: number } | null>(null);
  const isSigningInRef = useRef(false);

  const issueRecoveryCode = async (account: User) => {
    try {
      const token = await account.getIdToken();
      const response = await fetch('/api/recovery/issue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn('Recovery code was not issued:', await response.text());
        return;
      }
      const data = await response.json();
      if (data.code) {
        setRecoveryNotice({ code: data.code, expiresAt: Number(data.expiresAt) });
      }
    } catch (error) {
      console.warn('Recovery code request failed:', error);
    }
  };

  useEffect(() => {
    // Clear any residual demo storage keys
    localStorage.removeItem('clockin_vault_active_demo_uid');
    localStorage.removeItem('clockin_fake_users');

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(true);

      if (currentUser) {
        setIsAuthModalOpen(false);
        // Sync user profile document securely to Firestore users collection
        try {
          const isOwnerAdmin = isUserAdmin(currentUser.email, currentUser.uid);
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          setIsBanned(Boolean(docSnap.data()?.isBanned));
          setBannedReason(docSnap.data()?.bannedReason || '');

          if (isOwnerAdmin) {
            // Seed localStorage immediately with unrestricted admin plan
            try {
              localStorage.setItem(
                `clockin_vault_plan_${currentUser.uid}`,
                JSON.stringify({
                  plan: 'unlimited',
                  extraSlots: 999999,
                  maxCredentialSlots: 999999,
                  isUnlimited: true,
                  paymentStatus: 'verified',
                  paymentRef: 'ADMIN-UNRESTRICTED',
                  paymentCurrency: 'NGN',
                })
              );
            } catch (e) {
              // ignore
            }
          }

          const existingRole = docSnap.exists() ? docSnap.data().role : null;
          const assignedRole = isOwnerAdmin || existingRole === 'admin' ? 'admin' : 'user';
          const isUnlimitedRole = assignedRole === 'admin';

          if (!docSnap.exists()) {
            await setDoc(userDocRef, {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Vault User',
              photoURL: currentUser.photoURL || '',
              ...(isUnlimitedRole
                ? {
                    role: 'admin',
                    plan: 'unlimited',
                    extraSlots: 999999,
                    maxCredentialSlots: 999999,
                    paymentStatus: 'verified',
                    paymentRef: 'ADMIN-UNRESTRICTED',
                  }
                : {
                    role: 'user',
                    plan: 'free',
                    extraSlots: 0,
                    maxCredentialSlots: 10,
                  }),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(userDocRef, {
              displayName: currentUser.displayName || docSnap.data().displayName || 'Vault User',
              photoURL: currentUser.photoURL || docSnap.data().photoURL || '',
              ...(isUnlimitedRole
                ? {
                    role: 'admin',
                    plan: 'unlimited',
                    extraSlots: 999999,
                    maxCredentialSlots: 999999,
                    paymentStatus: 'verified',
                  }
                : {}),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn('Could not sync user profile record:', err);
          setIsBanned(false);
          setBannedReason('');
        }
      } else {
        setIsBanned(false);
        setBannedReason('');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        setIsBanned(Boolean(snapshot.data()?.isBanned));
        setBannedReason(snapshot.data()?.bannedReason || '');
      },
      (error) => {
        console.error('Failed to monitor account access status:', error);
      }
    );
  }, [user]);

  const signInWithGoogle = async () => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    try {
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      if (getAdditionalUserInfo(result)?.isNewUser) {
        await issueRecoveryCode(result.user);
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      if (err?.code === 'auth/cancelled-popup-request') return;
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before completion. Please click again to proceed.');
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Popup blocked by your browser. Please allow popups for this site in your browser URL bar, or run locally on http://localhost:3000.');
        return;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(`Domain Not Authorized: "${window.location.hostname}" is not authorized in Firebase for OAuth. Please add "${window.location.hostname}" to Firebase Console > Authentication > Settings > Authorized domains, or run locally on http://localhost:3000 where localhost is authorized by default.`);
        return;
      }
      if (err?.code === 'auth/network-request-failed') {
        setAuthError('Network error connecting to Firebase Authentication. Please check your internet connection or ad-blocker settings.');
        return;
      }
      console.error('Google Sign-In failed:', err);
      setAuthError(err?.message || 'Failed to sign in with Google.');
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      setAuthError(null);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.error('Email sign-in failed:', err);
      if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password provider is disabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method, click Email/Password, and toggle Enable.');
      } else if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setAuthError('Account not found or password incorrect. If you have not created an account yet, please click "Create Account" tab below first!');
      } else if (err?.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address (e.g. name@example.com).');
      } else if (err?.code === 'auth/too-many-requests') {
        setAuthError('Too many unsuccessful attempts. Please reset password or try again later.');
      } else if (err?.code === 'auth/network-request-failed') {
        setAuthError('Network error connecting to authentication servers. Please verify your internet connection.');
      } else {
        setAuthError(err?.message || 'Failed to sign in with email & password.');
      }
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    try {
      setAuthError(null);
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName && res.user) {
        await updateProfile(res.user, { displayName: displayName.trim() });
      }
      await issueRecoveryCode(res.user);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.error('Email registration failed:', err);
      if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password provider is disabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method, click Email/Password, and toggle Enable.');
      } else if (err?.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists. Switch to "Sign In" mode to enter your password.');
      } else if (err?.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters long.');
      } else if (err?.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(err?.message || 'Registration failed. Please check your credentials.');
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      console.error('Password reset email failed:', err);
      setAuthError(err?.message || 'Failed to send password reset email.');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setAuthError(null);
      setUser(null);
      setIsBanned(false);
      setBannedReason('');
      await fbSignOut(auth);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
      setAuthError('Failed to sign out. Please check your connection.');
    }
  };

  const clearAuthError = () => setAuthError(null);
  const clearRecoveryNotice = () => setRecoveryNotice(null);
  const openAuthModal = () => {
    setAuthError(null);
    setIsAuthModalOpen(true);
  };
  const closeAuthModal = () => {
    setAuthError(null);
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isBanned,
        bannedReason,
        authError,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
        clearAuthError,
        recoveryNotice,
        clearRecoveryNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

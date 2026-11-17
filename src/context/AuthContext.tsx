import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getAdditionalUserInfo,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { isUserAdmin } from '../services/adminService';
import { clearActiveVaultKey, createVaultKeyEnvelope, getVaultKeyEnvelope, rewrapVaultKeyWithRecovery, rotateVaultRecoveryKey as rotateRecoveryKey, unlockVaultWithPassword } from '../services/vaultCrypto';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isBanned: boolean;
  bannedReason: string;
  authError: string | null;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, pass: string, remember?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  vaultAccessStarted: boolean;
  continueToVault: () => void;
  recoveryNotice: { code: string } | null;
  clearRecoveryNotice: () => void;
  vaultUnlocked: boolean;
  vaultUnlockAnimationPending: boolean;
  clearVaultUnlockAnimationPending: () => void;
  unlockVault: (password: string) => Promise<void>;
  vaultRecoveryKeyNotice: string | null;
  clearVaultRecoveryKeyNotice: () => void;
  completeVaultPasswordRecovery: (recoveryKey: string, newPassword: string) => Promise<void>;
  rotateVaultRecoveryKey: (password: string) => Promise<void>;
  requestRecoveryCodeVerification: () => Promise<void>;
  verifyRecoveryCodeVerification: (code: string) => Promise<void>;
  issueRecoveryCodeWithPassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedReason, setBannedReason] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [vaultAccessStarted, setVaultAccessStarted] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{ code: string } | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultUnlockAnimationPending, setVaultUnlockAnimationPending] = useState(false);
  const [vaultRecoveryKeyNotice, setVaultRecoveryKeyNotice] = useState<string | null>(null);
  const isSigningInRef = useRef(false);
  const activeUidRef = useRef<string | null>(null);

  const unlockVault = async (password: string) => {
    if (!auth.currentUser) throw new Error('Sign in before unlocking your vault.');
    const envelope = await getVaultKeyEnvelope(auth.currentUser.uid);
    if (envelope) {
      await unlockVaultWithPassword(auth.currentUser.uid, password);
    } else {
      const setup = await createVaultKeyEnvelope(auth.currentUser.uid, password);
      setVaultRecoveryKeyNotice(setup.recoveryKey);
    }
    setVaultUnlockAnimationPending(true);
    setVaultUnlocked(true);
  };

  const completeVaultPasswordRecovery = async (recoveryKey: string, newPassword: string) => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before recovering your vault.');
    const hasPasswordProvider = account.providerData.some((provider) => provider.providerId === 'password');
    if (!hasPasswordProvider) throw new Error('Vault password recovery is available for email/password accounts.');
    const recoveryResult = await rewrapVaultKeyWithRecovery(account.uid, recoveryKey, newPassword);
    setVaultUnlockAnimationPending(true);
    setVaultUnlocked(true);
    setVaultRecoveryKeyNotice(recoveryResult.recoveryKey);
  };

  const rotateVaultRecoveryKey = async (password: string) => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before rotating your recovery key.');
    const recoveryKey = await rotateRecoveryKey(account.uid, password);
    setVaultRecoveryKeyNotice(recoveryKey);
    setVaultUnlockAnimationPending(true);
    setVaultUnlocked(true);
  };

  const requestRecoveryCodeVerification = async () => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before requesting a recovery code.');
    const token = await account.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/recovery/verification/request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not send the verification email.');
  };

  const verifyRecoveryCodeVerification = async (code: string) => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before confirming your recovery code.');
    const token = await account.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/recovery/verification/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.code) throw new Error(data.error || 'Could not issue a new recovery code.');
    setRecoveryNotice({ code: data.code });
  };

  const issueRecoveryCodeWithPassword = async (password: string) => {
    const account = auth.currentUser;
    if (!account?.email) throw new Error('Sign in with your email and password before requesting a recovery code.');
    const credential = EmailAuthProvider.credential(account.email, password);
    await reauthenticateWithCredential(account, credential);
    const token = await account.getIdToken(true);
    const response = await fetch(`${API_BASE_URL}/api/recovery/issue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.code) throw new Error(data.error || 'Could not issue a new recovery code.');
    setRecoveryNotice({ code: data.code });
  };

  const issueRecoveryCode = async (account: User) => {
    try {
      const token = await account.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/recovery/issue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.warn('Recovery code was not issued:', await response.text());
        return;
      }
      const data = await response.json();
      if (data.code) {
        setRecoveryNotice({ code: data.code });
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
      if (activeUidRef.current !== (currentUser?.uid || null)) {
        clearActiveVaultKey();
        setVaultUnlocked(false);
        setVaultUnlockAnimationPending(false);
        setVaultRecoveryKeyNotice(null);
        activeUidRef.current = currentUser?.uid || null;
      }
      setUser(currentUser);
      if (!currentUser) {
        clearActiveVaultKey();
        setVaultUnlocked(false);
        setVaultUnlockAnimationPending(false);
        setVaultRecoveryKeyNotice(null);
      }
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
    if (isSigningInRef.current) {
      setAuthError('A Google sign-in request is already in progress. Complete or close that window, then try again.');
      return false;
    }
    isSigningInRef.current = true;
    try {
      setAuthError(null);
      const result = await signInWithPopup(auth, googleProvider);
      setVaultAccessStarted(true);
      if (getAdditionalUserInfo(result)?.isNewUser) {
        await issueRecoveryCode(result.user);
      }
      setIsAuthModalOpen(false);
      return true;
    } catch (err: any) {
      if (err?.code === 'auth/cancelled-popup-request') {
        setAuthError('A Google sign-in request was replaced or cancelled. Please try again.');
        return false;
      }
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before completion. Please click again to proceed.');
        return false;
      }
      if (err?.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError: any) {
          console.error('Google Sign-In redirect failed:', redirectError);
          setAuthError(redirectError?.message || 'Google sign-in could not start. Check this site in Firebase authorized domains and try again.');
        }
        return false;
      }
      if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Google sign-in is disabled for this Firebase project. Enable the Google provider in Firebase Console > Authentication > Sign-in method.');
        return false;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(`Domain Not Authorized: "${window.location.hostname}" is not authorized in Firebase for OAuth. Please add "${window.location.hostname}" to Firebase Console > Authentication > Settings > Authorized domains, or run locally on http://localhost:3000 where localhost is authorized by default.`);
        return false;
      }
      if (err?.code === 'auth/network-request-failed') {
        setAuthError('Network error connecting to Firebase Authentication. Please check your internet connection or ad-blocker settings.');
        return false;
      }
      console.error('Google Sign-In failed:', err);
      setAuthError(err?.message || 'Failed to sign in with Google.');
      return false;
    } finally {
      isSigningInRef.current = false;
    }
  };

  const signInWithEmail = async (email: string, pass: string, remember = true) => {
    try {
      setAuthError(null);
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      setVaultAccessStarted(true);
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
      if (pass.length < 8) throw new Error('Choose a sign-in password with at least 8 characters so it can protect your vault key.');
      const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      setVaultAccessStarted(true);
      const keySetup = await createVaultKeyEnvelope(res.user.uid, pass);
      setVaultRecoveryKeyNotice(keySetup.recoveryKey);
      setVaultUnlockAnimationPending(true);
      setVaultUnlocked(true);
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
      clearActiveVaultKey();
      setVaultUnlocked(false);
      setVaultUnlockAnimationPending(false);
      setVaultAccessStarted(false);
      setVaultRecoveryKeyNotice(null);
      setIsBanned(false);
      setBannedReason('');
      await fbSignOut(auth);
    } catch (err: any) {
      console.error('Sign-out failed:', err);
      setAuthError('Failed to sign out. Please check your connection.');
    }
  };

  const clearAuthError = () => setAuthError(null);
  const continueToVault = () => setVaultAccessStarted(true);
  const clearRecoveryNotice = () => setRecoveryNotice(null);
  const clearVaultUnlockAnimationPending = () => setVaultUnlockAnimationPending(false);
  const clearVaultRecoveryKeyNotice = () => setVaultRecoveryKeyNotice(null);
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
        vaultAccessStarted,
        continueToVault,
        recoveryNotice,
        clearRecoveryNotice,
        vaultUnlocked,
        vaultUnlockAnimationPending,
        clearVaultUnlockAnimationPending,
        unlockVault,
        vaultRecoveryKeyNotice,
        clearVaultRecoveryKeyNotice,
        completeVaultPasswordRecovery,
        rotateVaultRecoveryKey,
        requestRecoveryCodeVerification,
        verifyRecoveryCodeVerification,
        issueRecoveryCodeWithPassword,
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

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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  recoveryNotice: { code: string } | null;
  clearRecoveryNotice: () => void;
  vaultUnlocked: boolean;
  unlockVault: (password: string) => Promise<void>;
  vaultRecoveryKeyNotice: string | null;
  clearVaultRecoveryKeyNotice: () => void;
  vaultRecoveryTicket: string | null;
  requestVaultRecoveryEmail: () => Promise<string>;
  confirmVaultRecoveryEmail: (token: string) => Promise<void>;
  completeVaultPasswordRecovery: (recoveryKey: string, newPassword: string) => Promise<void>;
  rotateVaultRecoveryKey: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedReason, setBannedReason] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<{ code: string } | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [vaultRecoveryKeyNotice, setVaultRecoveryKeyNotice] = useState<string | null>(null);
  const [vaultRecoveryTicket, setVaultRecoveryTicket] = useState<string | null>(() => sessionStorage.getItem('vault_x_recovery_ticket'));
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
    setVaultUnlocked(true);
  };

  const requestVaultRecoveryEmail = async () => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in with Google before requesting recovery.');
    const token = await account.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/vault/recovery-email/request`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not send the recovery email.');
    return String(data.message || 'Check your Google email for the confirmation link.');
  };

  const confirmVaultRecoveryEmail = async (emailToken: string) => {
    const response = await fetch(`${API_BASE_URL}/api/vault/recovery-email/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: emailToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ticket) throw new Error(data.error || 'That confirmation link is invalid or expired.');
    sessionStorage.setItem('vault_x_recovery_ticket', data.ticket);
    setVaultRecoveryTicket(data.ticket);
  };

  const completeVaultPasswordRecovery = async (recoveryKey: string, newPassword: string) => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before recovering your vault.');
    const hasConfirmedGoogleTicket = Boolean(vaultRecoveryTicket);
    const hasPasswordProvider = account.providerData.some((provider) => provider.providerId === 'password');
    if (!hasConfirmedGoogleTicket && !hasPasswordProvider) throw new Error('Confirm the recovery link sent to your Google email before continuing.');
    const recoveryResult = await rewrapVaultKeyWithRecovery(account.uid, recoveryKey, newPassword, !hasConfirmedGoogleTicket);
    const updatedEnvelope = recoveryResult.envelope;
    if (hasConfirmedGoogleTicket) {
      const idToken = await account.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/vault/recovery-email/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          ticket: vaultRecoveryTicket,
          passwordSalt: updatedEnvelope.passwordSalt,
          passwordIv: updatedEnvelope.passwordIv,
          passwordWrappedKey: updatedEnvelope.passwordWrappedKey,
          recoveryIv: updatedEnvelope.recoveryIv,
          recoveryWrappedKey: updatedEnvelope.recoveryWrappedKey,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not finish vault recovery.');
      sessionStorage.removeItem('vault_x_recovery_ticket');
      setVaultRecoveryTicket(null);
    }
    setVaultUnlocked(true);
    setVaultRecoveryKeyNotice(recoveryResult.recoveryKey);
  };

  const rotateVaultRecoveryKey = async (password: string) => {
    const account = auth.currentUser;
    if (!account) throw new Error('Sign in before rotating your recovery key.');
    const recoveryKey = await rotateRecoveryKey(account.uid, password);
    setVaultRecoveryKeyNotice(recoveryKey);
    setVaultUnlocked(true);
  };

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
        setVaultRecoveryKeyNotice(null);
        activeUidRef.current = currentUser?.uid || null;
      }
      setUser(currentUser);
      if (!currentUser) {
        clearActiveVaultKey();
        setVaultUnlocked(false);
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
      await unlockVault(pass);
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
      const keySetup = await createVaultKeyEnvelope(res.user.uid, pass);
      setVaultRecoveryKeyNotice(keySetup.recoveryKey);
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
  const clearRecoveryNotice = () => setRecoveryNotice(null);
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
        recoveryNotice,
        clearRecoveryNotice,
        vaultUnlocked,
        unlockVault,
        vaultRecoveryKeyNotice,
        clearVaultRecoveryKeyNotice,
        vaultRecoveryTicket,
        requestVaultRecoveryEmail,
        confirmVaultRecoveryEmail,
        completeVaultPasswordRecovery,
        rotateVaultRecoveryKey,
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

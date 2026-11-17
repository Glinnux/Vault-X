import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

interface PrivacySettingsValue {
  screenshotProtectionEnabled: boolean;
  setScreenshotProtectionEnabled: (enabled: boolean) => void;
}

const PrivacySettingsContext = createContext<PrivacySettingsValue | null>(null);
const PREFERENCE_PREFIX = 'vaultx_screenshot_privacy_';

function preferenceKey(uid: string) {
  return `${PREFERENCE_PREFIX}${uid}`;
}

function readPreference(uid: string | undefined): boolean {
  if (!uid) return true;
  try {
    return window.localStorage.getItem(preferenceKey(uid)) !== 'false';
  } catch {
    return true;
  }
}

export function PrivacySettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preference, setPreference] = useState<{ uid: string | undefined; enabled: boolean }>({ uid: undefined, enabled: true });
  const uid = user?.uid;

  useEffect(() => {
    setPreference({ uid, enabled: readPreference(uid) });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === preferenceKey(uid)) setPreference({ uid, enabled: event.newValue !== 'false' });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [uid]);

  const setScreenshotProtectionEnabled = useCallback((enabled: boolean) => {
    if (!uid) return;
    setPreference({ uid, enabled });
    try {
      // This stores only a boolean privacy preference, never vault data or credentials.
      window.localStorage.setItem(preferenceKey(uid), String(enabled));
    } catch {
      // Keep the setting active for this session when browser storage is unavailable.
    }
  }, [uid]);

  const value = useMemo(() => ({
    screenshotProtectionEnabled: preference.uid === uid ? preference.enabled : true,
    setScreenshotProtectionEnabled,
  }), [preference, setScreenshotProtectionEnabled, uid]);

  return <PrivacySettingsContext.Provider value={value}>{children}</PrivacySettingsContext.Provider>;
}

export function usePrivacySettings() {
  const context = useContext(PrivacySettingsContext);
  if (!context) throw new Error('usePrivacySettings must be used inside PrivacySettingsProvider.');
  return context;
}

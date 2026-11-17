import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AboutPage, AuthNotices, AuthPage, FeaturesPage, HomePage, HowItWorksPage, MainSiteLayout, NotFoundPage, SecurityPage } from './pages/PublicSite';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { PrivacySettingsProvider } from './context/PrivacySettingsContext';
import { VaultChatbot } from './components/VaultChatbot';
import { clearSuperAdminAccessSessionToken, getSuperAdminAccessSessionToken, isSuperAdminUser, validateSuperAdminAccessSession } from './services/adminService';

const VaultAccountPage = lazy(() => import('./pages/VaultAccountPage').then((module) => ({ default: module.VaultAccountPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage })));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage').then((module) => ({ default: module.SubscriptionPage })));

function SuperAdminRoute() {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (loading) return;
    let active = true;
    const sessionToken = getSuperAdminAccessSessionToken();
    if (!user || !isSuperAdminUser(user.email) || !sessionToken) {
      if (!user || !isSuperAdminUser(user.email)) clearSuperAdminAccessSessionToken();
      setAccess('denied');
      return () => { active = false; };
    }

    validateSuperAdminAccessSession(sessionToken)
      .then(() => {
        if (active) setAccess('allowed');
      })
      .catch(() => {
        if (active) setAccess('denied');
      });

    return () => { active = false; };
  }, [loading, user]);

  if (loading || access === 'checking') {
    return <main className="account-loading"><span className="account-spinner" />Verifying Super Admin session…</main>;
  }
  if (access === 'denied') {
    return (
      <main className="account-state">
        <div className="account-state-card">
          <h1>Super Admin access denied</h1>
          <p>Complete Super Admin verification from the Admin Dashboard to continue.</p>
          <Link className="button button-primary" to={user ? '/admin' : '/login'}>
            {user ? 'Return to Admin Dashboard' : 'Sign in'}
          </Link>
        </div>
      </main>
    );
  }
  return <Suspense fallback={<main className="account-loading"><span className="account-spinner" />Opening Super Admin dashboard…</main>}><AdminDashboardPage /></Suspense>;
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route element={<MainSiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="security" element={<SecurityPage />} />
        </Route>
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="vault" element={<Suspense fallback={<main className="account-loading"><span className="account-spinner" />Opening your vault…</main>}><VaultAccountPage /></Suspense>} />
        <Route path="admin" element={<Suspense fallback={<main className="account-loading"><span className="account-spinner" />Opening admin dashboard…</main>}><AdminDashboardPage /></Suspense>} />
        <Route path="superadmin" element={<SuperAdminRoute />} />
        <Route path="account" element={<Suspense fallback={<main className="account-loading"><span className="account-spinner" />Opening account…</main>}><AccountSettingsPage /></Suspense>} />
        <Route path="subscription" element={<Suspense fallback={<main className="account-loading"><span className="account-spinner" />Opening subscription…</main>}><SubscriptionPage /></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <AuthNotices />
      <VaultChatbot />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <LanguageProvider>
          <PrivacySettingsProvider>
            <AppRoutes />
          </PrivacySettingsProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

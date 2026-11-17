import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, CheckCheck, ChevronDown, CreditCard, Eye, EyeOff, FileKey2, FileText, KeyRound, LayoutDashboard, Lightbulb, LockKeyhole, MessageCircle, MessageSquare, Settings, ShieldCheck, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminChatPage } from '../components/AdminChatPage';
import { AdminUsersNavigationItem, AdminUsersPage, AdminUsersTab } from '../components/AdminUsersPage';
import { useAuth } from '../context/AuthContext';
import { AdminOverview, AdminOverviewError, clearSuperAdminAccessSessionToken, fetchAdminOverview, getSuperAdminAccessSessionToken, isSuperAdminUser, revokeSuperAdminAccessSession, SuperAdminAccessChallenge, SuperAdminAccessSession, verifySuperAdminOwnerWord, verifySuperAdminPassword } from '../services/adminService';
import { AdminRecord } from '../types/vault';

type AdminSection = 'overview' | 'users' | 'activity' | 'security' | 'settings';

const sections: Array<{ id: Exclude<AdminSection, 'overview'>; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activities', icon: Activity },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

const sectionForTab: Record<AdminUsersTab, Exclude<AdminSection, 'overview'>> = {
  users: 'users',
  admins: 'users',
  suggestions: 'activity',
  complaints: 'activity',
  feedback: 'activity',
  resolved: 'activity',
  payments: 'security',
  recovery: 'security',
  settings: 'settings',
};

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<AdminSection>('overview');
  const [expandedSection, setExpandedSection] = useState<Exclude<AdminSection, 'overview'> | null>(null);
  const [userConsoleTab, setUserConsoleTab] = useState<AdminUsersTab>('users');
  const [userConsoleNavigation, setUserConsoleNavigation] = useState<AdminUsersNavigationItem[]>([]);
  const [showAdminChat, setShowAdminChat] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showSuperAdminVerification, setShowSuperAdminVerification] = useState(false);
  const [superAdminVerificationStep, setSuperAdminVerificationStep] = useState<'password' | 'owner-word'>('password');
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [superAdminOwnerWord, setSuperAdminOwnerWord] = useState('');
  const [showSuperAdminPassword, setShowSuperAdminPassword] = useState(false);
  const [verifyingSuperAdmin, setVerifyingSuperAdmin] = useState(false);
  const [endingSuperAdminSession, setEndingSuperAdminSession] = useState(false);
  const [superAdminVerificationError, setSuperAdminVerificationError] = useState('');
  const [superAdminChallenge, setSuperAdminChallenge] = useState<SuperAdminAccessChallenge | null>(null);
  const [superAdminSession, setSuperAdminSession] = useState<SuperAdminAccessSession | null>(null);
  const isSuperAdmin = isSuperAdminUser(user?.email);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || authLoading) return;
    let active = true;
    setLoading(true);
    fetchAdminOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof AdminOverviewError && cause.status === 403) {
          setAccessDenied(true);
        } else {
          setError(cause instanceof Error ? cause.message : 'Could not load admin overview data.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user, authLoading]);

  useEffect(() => {
    if (!superAdminChallenge) return;
    const timeout = window.setTimeout(() => {
      setSuperAdminChallenge(null);
      setSuperAdminOwnerWord('');
      setSuperAdminVerificationStep('password');
      setSuperAdminVerificationError('Password verification expired. Enter your password again.');
    }, Math.max(0, superAdminChallenge.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [superAdminChallenge]);

  useEffect(() => {
    if (user && isSuperAdmin) {
      const sessionToken = getSuperAdminAccessSessionToken();
      setSuperAdminSession(sessionToken ? { sessionToken } : null);
      return;
    }
    if (!authLoading) clearSuperAdminAccessSessionToken();
    setSuperAdminSession(null);
  }, [user?.uid, isSuperAdmin, authLoading]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }, []);
  const updateUserConsoleNavigation = useCallback((items: AdminUsersNavigationItem[]) => {
    setUserConsoleNavigation(items);
  }, []);
  const changeSection = (nextSection: AdminSection) => {
    const firstTab = userConsoleNavigation.find((item) => sectionForTab[item.id] === nextSection);
    if (firstTab) setUserConsoleTab(firstTab.id);
    setSection(nextSection);
    setShowAdminChat(false);
  };
  const closeSuperAdminVerification = () => {
    if (verifyingSuperAdmin) return;
    setShowSuperAdminVerification(false);
    setSuperAdminVerificationStep('password');
    setSuperAdminPassword('');
    setSuperAdminOwnerWord('');
    setSuperAdminChallenge(null);
    setShowSuperAdminPassword(false);
    setSuperAdminVerificationError('');
  };
  const submitSuperAdminVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verifyingSuperAdmin) return;
    setVerifyingSuperAdmin(true);
    setSuperAdminVerificationError('');
    try {
      if (superAdminVerificationStep === 'password') {
        const challenge = await verifySuperAdminPassword(superAdminPassword);
        setSuperAdminChallenge(challenge);
        setSuperAdminVerificationStep('owner-word');
        setSuperAdminPassword('');
      } else {
        if (!superAdminChallenge) throw new Error('Password verification expired. Enter your password again.');
        const session = await verifySuperAdminOwnerWord(superAdminOwnerWord, superAdminChallenge.challengeToken);
        setSuperAdminSession(session);
        setShowSuperAdminVerification(false);
        setSuperAdminVerificationStep('password');
        setSuperAdminChallenge(null);
        setSuperAdminOwnerWord('');
        setShowSuperAdminPassword(false);
        navigate('/superadmin', { replace: true });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Verification failed.';
      setSuperAdminVerificationError(message);
      if (message.toLowerCase().includes('expired')) {
        setSuperAdminChallenge(null);
        setSuperAdminOwnerWord('');
        setSuperAdminVerificationStep('password');
      }
    } finally {
      setVerifyingSuperAdmin(false);
    }
  };
  const endSuperAdminSession = async () => {
    if (!superAdminSession || endingSuperAdminSession) return;
    const activeSession = superAdminSession;
    setEndingSuperAdminSession(true);
    try {
      await revokeSuperAdminAccessSession(activeSession.sessionToken);
      setSuperAdminSession(null);
      showToast('Super Admin session ended.', 'success');
      navigate('/admin', { replace: true });
    } catch (cause) {
      showToast(
        cause instanceof Error
          ? `${cause.message} The session remains active until it can be revoked.`
          : 'Could not revoke the server session. Please retry.',
        'error'
      );
    } finally {
      setEndingSuperAdminSession(false);
    }
  };

  const userTabIcons = {
    payments: CreditCard,
    suggestions: Lightbulb,
    complaints: AlertTriangle,
    feedback: MessageSquare,
    resolved: CheckCheck,
    admins: ShieldCheck,
    users: Users,
    recovery: KeyRound,
    settings: Settings,
  } satisfies Record<AdminUsersTab, typeof Users>;

  if (authLoading || !user || loading) {
    return <main className="account-loading"><span className="account-spinner" />Checking administrator access…</main>;
  }

  if (accessDenied) {
    return (
      <main className="account-state">
        <div className="account-state-card">
          <LockKeyhole size={32} />
          <h1>Access Denied</h1>
          <p>This account is not authorized to access administrator tools.</p>
          <Link className="button button-primary" to="/vault"><ArrowLeft size={17} /> Return to Vault</Link>
        </div>
      </main>
    );
  }

  const currentAdmin: AdminRecord[] = [{
    userId: user.uid,
    email: user.email || 'Administrator',
    displayName: user.displayName || 'Administrator',
    role: isSuperAdmin ? 'superadmin' : 'admin',
    addedAt: null,
  }];
  const dropdownSections = [
    ...sections,
    ...(isSuperAdmin ? [{ id: 'settings' as const, label: 'Settings', icon: Settings }] : []),
  ];

  return (
    <main className="admin-dashboard">
      <header className="account-header">
        <div className="site-container account-header-inner">
          <Link to="/vault" className="brand"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span><span>Vault-X</span></Link>
          <Link to="/vault" className="admin-back-link"><ArrowLeft size={16} /> Return to Vault</Link>
        </div>
      </header>

      <div className="site-container admin-content">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">{isSuperAdmin ? 'Primary owner access' : 'Authorized administration'}</span>
            <h1>{isSuperAdmin ? 'Super Admin Command Centre' : 'Admin Dashboard'}</h1>
            <p>System-level account and vault metadata. User secrets are never displayed here.</p>
          </div>
          <span className="admin-session"><ShieldCheck size={16} /> Signed in as {user.email}</span>
        </div>

        {isSuperAdmin && (
          <section className="super-admin-gate" aria-label="Super Admin access">
            <div className="super-admin-gate-copy">
              <span className="super-admin-gate-icon"><LockKeyhole size={20} /></span>
              <div>
                <span className="super-admin-gate-eyebrow">Restricted owner controls</span>
                <h2>Super Admin</h2>
                <p>A separate password check is required before entering the Super Admin workspace.</p>
              </div>
            </div>
            <div className="super-admin-gate-actions">
              {superAdminSession && (
                <span className="super-admin-gate-status" role="status">
                  <ShieldCheck size={15} /> Verified until you end the session
                </span>
              )}
              <button
                type="button"
                className="super-admin-gate-button"
                onClick={() => {
                  setSuperAdminVerificationStep('password');
                  setSuperAdminPassword('');
                  setSuperAdminOwnerWord('');
                  setSuperAdminChallenge(null);
                  setSuperAdminVerificationError('');
                  setShowSuperAdminVerification(true);
                }}
              >
                <LockKeyhole size={17} /> SUPER ADMIN
              </button>
              {superAdminSession && (
                <button type="button" className="super-admin-end-session" onClick={endSuperAdminSession} disabled={endingSuperAdminSession}>
                  {endingSuperAdminSession ? 'Ending…' : 'End session'}
                </button>
              )}
            </div>
            {superAdminSession && (
              <p className="super-admin-session-note">
                Password verification is active in this tab only. Protected Super Admin API requests must present this short-lived session.
              </p>
            )}
          </section>
        )}

        <nav className="admin-navigation" aria-label="Admin dashboard sections">
          <div className="admin-navigation-group">
            <button
              type="button"
              className={`admin-navigation-trigger admin-navigation-overview ${section === 'overview' ? 'is-active' : ''}`}
              aria-current={section === 'overview' ? 'page' : undefined}
              onClick={() => changeSection('overview')}
            >
              <LayoutDashboard size={17} />
              Overview
            </button>
          </div>
          {dropdownSections.map(({ id, label, icon: Icon }) => {
            const childItems = userConsoleNavigation.filter((item) => sectionForTab[item.id] === id);
            const isExpanded = expandedSection === id;
            const isActive = section === id;
            return (
              <div key={id} className={`admin-navigation-group ${isExpanded ? 'is-expanded' : ''}`}>
                <button
                  type="button"
                  className={`admin-navigation-trigger ${isActive ? 'is-active' : ''}`}
                  aria-expanded={isExpanded}
                  aria-controls={`admin-navigation-${id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setExpandedSection((current) => current === id ? null : id)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  <ChevronDown className="admin-navigation-chevron" size={16} aria-hidden="true" />
                </button>
                <div
                  id={`admin-navigation-${id}`}
                  className={`admin-navigation-children ${isExpanded ? 'is-expanded' : ''}`}
                  aria-hidden={!isExpanded}
                >
                  <div className="admin-navigation-children-inner">
                    {childItems.map(({ id: tabId, label: tabLabel, badge }) => {
                      const TabIcon = userTabIcons[tabId];
                      return (
                        <button
                          key={tabId}
                          type="button"
                          className={`admin-navigation-subsection ${userConsoleTab === tabId && isActive && !showAdminChat ? 'is-active' : ''}`}
                          aria-current={userConsoleTab === tabId && isActive && !showAdminChat ? 'page' : undefined}
                          onClick={() => {
                            setSection(id);
                            setUserConsoleTab(tabId);
                            setShowAdminChat(false);
                            setExpandedSection(id);
                          }}
                        >
                          <TabIcon size={15} />
                          <span>{tabLabel}</span>
                          {badge !== undefined && badge > 0 && <span className="admin-navigation-badge">{badge}</span>}
                        </button>
                      );
                    })}
                    {id === 'users' && (
                      <button
                        type="button"
                        className={`admin-navigation-subsection ${showAdminChat && isActive ? 'is-active' : ''}`}
                        aria-current={showAdminChat && isActive ? 'page' : undefined}
                        onClick={() => {
                          setSection('users');
                          setShowAdminChat(true);
                          setExpandedSection('users');
                        }}
                      >
                        <MessageCircle size={15} />
                        <span>Admin Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {error && <p className="account-error" role="alert">{error}</p>}

        {section === 'overview' && overview && (
          <>
            <section className="admin-stat-grid" aria-label="System statistics">
              <StatCard label="Total Users" value={overview.totalUsers} icon={Users} detail="Registered accounts" />
              <StatCard label="Active Users" value={overview.activeUsers} icon={Activity} detail="Signed in within 30 days" />
              <StatCard label="Total Credentials" value={overview.totalCredentials} icon={FileKey2} detail="Metadata count only" />
              <StatCard label="Total Documents" value={overview.totalDocuments} icon={FileText} detail="Metadata count only" />
            </section>

            <section className="admin-overview-grid">
              <div className="admin-panel">
                <div className="admin-panel-heading"><h2>Recent Users</h2><button type="button" className="admin-text-button" onClick={() => changeSection('users')}>View users</button></div>
                {overview.recentUsers.length ? (
                  <ul className="admin-recent-users">
                    {overview.recentUsers.map((recentUser) => (
                      <li key={recentUser.userId}>
                        <span className="admin-user-avatar"><Users size={17} /></span>
                        <span className="admin-user-detail">
                          <strong>{recentUser.displayName || (recentUser.email ? recentUser.email : 'Account details restricted')}</strong>
                          <small>{recentUser.email || `UID: ${recentUser.userId}`}</small>
                        </span>
                        <time>{recentUser.createdAt ? new Date(recentUser.createdAt).toLocaleDateString() : 'Date unavailable'}</time>
                      </li>
                    ))}
                  </ul>
                ) : <p className="admin-muted">No registered users are available to display.</p>}
              </div>

              <div className="admin-panel">
                <div className="admin-panel-heading"><h2>System Status</h2><span className="admin-status"><i /> Available</span></div>
                <ul className="admin-status-list">
                  <li><span>Administrator authorization</span><strong>Verified</strong></li>
                  <li><span>Vault metadata counts</span><strong>Available</strong></li>
                  <li><span>Credential contents</span><strong>Not exposed</strong></li>
                </ul>
                <p className="admin-muted">Counts are calculated server-side; credential and document contents remain private to their owners.</p>
              </div>
            </section>
          </>
        )}

        {(section !== 'overview' || expandedSection !== null) && !(section === 'users' && showAdminChat) && (
          <div className={section === 'overview' ? 'admin-navigation-preload' : undefined}>
            <AdminUsersPage
              onBackToVault={() => navigate('/vault')}
              onToast={showToast}
              activeTab={userConsoleTab}
              onActiveTabChange={setUserConsoleTab}
              onNavigationChange={updateUserConsoleNavigation}
            />
          </div>
        )}

        {section === 'users' && showAdminChat && (
          <AdminChatPage
            admins={currentAdmin}
            currentUser={user}
            isSuperAdmin={isSuperAdmin}
            onToast={showToast}
            onBackToConsole={() => setShowAdminChat(false)}
          />
        )}

      </div>
      {toast && <div className={`account-toast admin-toast-${toast.type}`} role="status">{toast.message}</div>}
      {showSuperAdminVerification && (
        <div className="super-admin-modal-backdrop">
          <section
            className="super-admin-verification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="super-admin-verification-title"
            aria-describedby="super-admin-verification-description"
          >
            <span className="super-admin-modal-icon"><ShieldCheck size={25} /></span>
            <span className="super-admin-gate-eyebrow">Additional security check</span>
            <h2 id="super-admin-verification-title">
              {superAdminVerificationStep === 'password' ? 'Super Admin Verification' : 'Owner Verification'}
            </h2>
            <p id="super-admin-verification-description">
              {superAdminVerificationStep === 'password'
                ? 'Enter your password to continue.'
                : 'Enter your 3-letter security word to confirm that you are the Vault-X owner.'}
            </p>
            <form onSubmit={submitSuperAdminVerification}>
              {superAdminVerificationStep === 'password' ? (
                <>
                  <label htmlFor="super-admin-password">Super Admin password</label>
                  <div className="super-admin-password-field">
                    <input
                      id="super-admin-password"
                      type={showSuperAdminPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoFocus
                      required
                      maxLength={1024}
                      value={superAdminPassword}
                      onChange={(event) => setSuperAdminPassword(event.target.value)}
                      disabled={verifyingSuperAdmin}
                    />
                    <button
                      type="button"
                      className="super-admin-password-toggle"
                      aria-label={showSuperAdminPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showSuperAdminPassword}
                      onClick={() => setShowSuperAdminPassword((visible) => !visible)}
                      disabled={verifyingSuperAdmin}
                    >
                      {showSuperAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor="super-admin-owner-word">3-letter security word</label>
                  <div className="super-admin-password-field super-admin-owner-word-field">
                    <input
                      id="super-admin-owner-word"
                      type="password"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      inputMode="text"
                      pattern="[A-Za-z]{3}"
                      maxLength={3}
                      required
                      autoFocus
                      value={superAdminOwnerWord}
                      onChange={(event) => setSuperAdminOwnerWord(event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase())}
                      disabled={verifyingSuperAdmin}
                    />
                  </div>
                </>
              )}
              {superAdminVerificationError && <p className="super-admin-verification-error" role="alert">{superAdminVerificationError}</p>}
              <div className="super-admin-verification-actions">
                {superAdminVerificationStep === 'owner-word' && (
                  <button
                    type="button"
                    className="super-admin-cancel-button"
                    onClick={() => {
                      setSuperAdminChallenge(null);
                      setSuperAdminOwnerWord('');
                      setSuperAdminVerificationStep('password');
                      setSuperAdminVerificationError('');
                    }}
                    disabled={verifyingSuperAdmin}
                  >
                    Back
                  </button>
                )}
                <button type="button" className="super-admin-cancel-button" onClick={closeSuperAdminVerification} disabled={verifyingSuperAdmin}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="super-admin-verify-button"
                  disabled={verifyingSuperAdmin || (superAdminVerificationStep === 'password' ? !superAdminPassword : superAdminOwnerWord.length !== 3)}
                >
                  {verifyingSuperAdmin ? <><span className="account-spinner" /> Verifying…</> : <><KeyRound size={17} /> {superAdminVerificationStep === 'password' ? 'Verify password' : 'Confirm owner'}</>}
                </button>
              </div>
            </form>
            <p className="super-admin-modal-footnote">Repeated failed attempts are temporarily locked by the server.</p>
          </section>
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value, icon: Icon, detail }: { label: string; value: number; icon: typeof Users; detail: string }) {
  return (
    <article className="admin-stat-card">
      <span className="admin-stat-icon"><Icon size={19} /></span>
      <span className="admin-stat-label">{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  );
}

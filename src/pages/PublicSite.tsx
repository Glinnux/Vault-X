import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Menu,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TERMS_AND_CONDITIONS, TERMS_VERSION } from '../content/terms';
import { useAuth } from '../context/AuthContext';

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'About Us', to: '/about' },
  { label: 'Security', to: '/security' },
];

const featureItems = [
  { icon: ShieldCheck, title: 'Secure Credential Storage', text: 'Keep important credentials organized in one secure location.' },
  { icon: Database, title: 'Smart Organization', text: 'Organize information into categories for easier management.' },
  { icon: Search, title: 'Fast Search', text: 'Find credentials quickly through a simple search experience.' },
  { icon: Fingerprint, title: 'Privacy Focused', text: 'Designed with privacy and responsible data handling in mind.' },
  { icon: LockKeyhole, title: 'Secure Authentication', text: 'Access your Vault-X account through secure authentication.' },
  { icon: Sparkles, title: 'Simple Dashboard', text: 'Manage everything from a clean and intuitive interface.' },
];

const processSteps = [
  { number: '01', title: 'Create Your Account', text: 'Set up your personal account to get started with Vault-X.' },
  { number: '02', title: 'Set Up Your Vault', text: 'Create a private, organized space for the credentials you manage.' },
  { number: '03', title: 'Add Your Credentials', text: 'Add and categorize the information you want to keep at hand.' },
  { number: '04', title: 'Manage Them Securely', text: 'Return to your vault to search, review, and manage your records.' },
];

const securityItems = [
  { title: 'Data Protection', text: 'Vault-X is designed to help you keep credential information organized and protected.' },
  { title: 'Authentication', text: 'Account access uses Firebase Authentication for supported sign-in methods.' },
  { title: 'Privacy', text: 'Privacy-conscious decisions guide how we shape the product experience.' },
  { title: 'Secure Architecture', text: 'The application uses a security-focused design and access controls.' },
];

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand ${inverse ? 'brand-inverse' : ''}`}>
      <span className="brand-mark" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span>
      <span>Vault-X</span>
    </span>
  );
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 8);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="site-container header-inner">
        <Link to="/" aria-label="Vault-X home"><Brand /></Link>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <Link className="button button-primary button-small" to="/vault">Open Vault</Link>
          ) : (
            <>
              <Link className="button button-outline button-small" to="/login">Login</Link>
              <Link className="button button-primary button-small" to="/signup">Get Started</Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      <div className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
        <div className="site-container mobile-nav-inner">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <Link className="button button-primary" to="/vault">Open Vault</Link>
          ) : (
            <>
              <Link className="button button-outline" to="/login">Login</Link>
              <Link className="button button-primary" to="/signup">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-grid">
        <div className="footer-about">
          <Link to="/"><Brand inverse /></Link>
          <p>One thoughtful place to organize and manage your digital credentials.</p>
        </div>
        <div className="footer-column">
          <h3>Product</h3>
          <Link to="/features">Features</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/security">Security</Link>
        </div>
        <div className="footer-column">
          <h3>Company</h3>
          <Link to="/about">About Us</Link>
          <a href="mailto:support@vault-x.app">Contact</a>
        </div>
        <div className="footer-column">
          <h3>Account</h3>
          <Link to="/login">Login</Link>
          <Link to="/signup">Get Started</Link>
        </div>
        <div className="footer-column">
          <h3>Explore</h3>
          <Link to="/security">Our approach</Link>
          <Link to="/features">Platform</Link>
        </div>
      </div>
      <div className="site-container footer-bottom">© 2026 Vault-X. All rights reserved.</div>
    </footer>
  );
}

export function MainSiteLayout() {
  return (
    <>
      <SiteHeader />
      <main className="route-main"><Outlet /></main>
      <SiteFooter />
    </>
  );
}

function PageIntro({ eyebrow, title, description, centered = true }: { eyebrow: string; title: string; description: string; centered?: boolean }) {
  return (
    <div className={`page-intro ${centered ? 'centered' : ''}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="section-title">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, index = 0 }: { icon: typeof ShieldCheck; title: string; text: string; index?: number }) {
  return (
    <Reveal className="feature-card-wrap" delay={index * 65}>
      <article className="feature-card">
        <span className="feature-icon"><Icon size={22} /></span>
        <h3>{title}</h3>
        <p>{text}</p>
        <span className="card-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
      </article>
    </Reveal>
  );
}

function DashboardPreview() {
  return (
    <div className="dashboard-art" aria-label="Illustration of the Vault-X credential dashboard">
      <div className="dashboard-orbit orbit-one" />
      <div className="dashboard-orbit orbit-two" />
      <div className="floating-security-card floating-top"><span className="floating-icon"><ShieldCheck size={18} /></span><span><b>Vault protected</b><small>Security status</small></span><i /></div>
      <div className="floating-security-card floating-bottom"><span className="floating-icon"><LockKeyhole size={17} /></span><span><b>Private by design</b><small>Access controlled</small></span></div>
      <div className="dashboard-window">
        <div className="dashboard-window-head"><Brand /><div className="window-dots"><i /><i /><i /></div></div>
        <div className="dashboard-layout">
          <aside className="dashboard-sidebar">
            <span className="dashboard-side-item selected"><ShieldCheck size={15} /> Vault</span>
            <span className="dashboard-side-item"><LockKeyhole size={15} /> Security</span>
            <span className="dashboard-side-item"><Database size={15} /> Storage</span>
          </aside>
          <div className="dashboard-content">
            <div className="dashboard-content-heading"><div><small>YOUR SPACE</small><b>Vault Overview</b></div><span className="online-dot">Protected</span></div>
            <div className="dashboard-search"><Search size={15} /><span>Search credentials</span><kbd>⌘ K</kbd></div>
            <div className="credential-row"><span className="credential-symbol"><KeyRound size={17} /></span><span><b>Work Email</b><small>Login credential</small></span><em><i /> Secure</em></div>
            <div className="credential-row"><span className="credential-symbol"><Database size={17} /></span><span><b>Bank Login</b><small>Financial</small></span><em><i /> Protected</em></div>
            <div className="dashboard-note"><ShieldCheck size={15} /> Your vault is ready when you are.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrimaryCta({ title = 'Ready to secure your digital world?', text = 'Create your Vault-X account and keep your credentials organized.' }: { title?: string; text?: string }) {
  return (
    <section className="cta-section">
      <div className="site-container cta-card">
        <div><span className="eyebrow">Take the next step</span><h2>{title}</h2><p>{text}</p></div>
        <div className="cta-actions">
          <Link className="button button-light" to="/signup">Get Started <ArrowRight size={17} /></Link>
          <Link className="cta-text-link" to="/login">Sign In <ChevronRight size={16} /></Link>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const previewFeatures = featureItems.slice(0, 4);
  return (
    <div className="page-transition">
      <section className="home-hero">
        <div className="hero-grid-pattern" />
        <div className="site-container home-hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker"><span /> A clearer way to manage credentials</span>
            <h1>Secure Your Digital World <span>With Vault-X</span></h1>
            <p>Manage, organize, and protect your important credentials in one secure and intelligent platform.</p>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to="/signup">Get Started <ArrowRight size={18} /></Link>
              <Link className="button button-hero-secondary button-large" to="/login">Explore Vault-X <ChevronRight size={17} /></Link>
            </div>
            <div className="hero-assurance"><ShieldCheck size={17} /><span>Security-minded design</span><span className="assurance-separator" /><span>Made for everyday clarity</span></div>
          </div>
          <DashboardPreview />
        </div>
        <a className="hero-scroll-cue" href="#why-vaultx" aria-label="Scroll to learn about Vault-X"><ArrowDown size={16} /></a>
      </section>

      <section id="why-vaultx" className="content-section home-features">
        <div className="site-container">
          <SectionTitle eyebrow="Why Vault-X" title="Everything important, organized with care" description="A focused set of tools to help you manage digital credentials with less friction." />
          <div className="feature-grid feature-grid-four">
            {previewFeatures.map((feature, index) => <FeatureCard key={feature.title} {...feature} index={index} />)}
          </div>
          <div className="section-link-row"><Link className="text-link" to="/features">Explore all features <ArrowRight size={17} /></Link></div>
        </div>
      </section>

      <section className="content-section process-preview">
        <div className="site-container">
          <SectionTitle eyebrow="A simple process" title="Start with a few clear steps" description="Set up your account, add the credentials you need, and manage them in one place." />
          <div className="steps-preview-grid">
            {processSteps.slice(0, 3).map((step) => (
              <Reveal key={step.number}><article className="step-preview-card"><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article></Reveal>
            ))}
          </div>
          <div className="section-link-row"><Link className="text-link" to="/how-it-works">Learn How It Works <ArrowRight size={17} /></Link></div>
        </div>
      </section>

      <section className="security-preview">
        <div className="site-container security-preview-inner">
          <div className="security-emblem"><ShieldCheck size={42} /></div>
          <div className="security-preview-copy"><span className="eyebrow">Security by intention</span><h2>Built with privacy and protection in mind.</h2><p>Vault-X takes a thoughtful approach to protecting account access and organizing sensitive information, without promising more than technology can guarantee.</p><Link className="text-link text-link-light" to="/security">Explore Security <ArrowRight size={17} /></Link></div>
        </div>
      </section>

      <section className="about-preview">
        <div className="site-container about-preview-inner">
          <div className="about-preview-mark"><span className="brand-mark"><img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" /></span><div className="about-orbit" /><div className="about-orbit second" /></div>
          <div><span className="eyebrow">About Vault-X</span><h2>Make managing digital credentials feel simpler.</h2><p>Vault-X brings clarity to the way people organize and manage important information in their digital lives.</p><Link className="text-link" to="/about">Learn More About Us <ArrowRight size={17} /></Link></div>
        </div>
      </section>
      <PrimaryCta />
    </div>
  );
}

export function FeaturesPage() {
  return (
    <div className="page-transition">
      <section className="interior-hero">
        <div className="site-container"><PageIntro eyebrow="Vault-X features" title="Everything You Need To Manage Your Digital Credentials" description="A considered toolkit for organizing, finding, and managing important credentials." /></div>
      </section>
      <section className="content-section">
        <div className="site-container feature-page-grid">
          {featureItems.map((feature, index) => <FeatureCard key={feature.title} {...feature} index={index} />)}
        </div>
      </section>
      <section className="feature-detail-section">
        <div className="site-container feature-detail-grid">
          <div className="feature-detail-art"><div className="detail-shield"><ShieldCheck size={42} /></div><div className="detail-line line-a" /><div className="detail-line line-b" /><div className="detail-line line-c" /></div>
          <div><span className="eyebrow">Designed for focus</span><h2>Less friction. More confidence.</h2><p>Vault-X combines clear organization with a straightforward experience, so you can spend less time tracking down information and more time getting on with your day.</p><Link className="text-link" to="/signup">Get Started <ArrowRight size={17} /></Link></div>
        </div>
      </section>
      <PrimaryCta />
    </div>
  );
}

export function HowItWorksPage() {
  return (
    <div className="page-transition">
      <section className="interior-hero">
        <div className="site-container"><PageIntro eyebrow="The process" title="How Vault-X Works" description="A simple way to organize and manage your digital credentials." /></div>
      </section>
      <section className="content-section workflow-section">
        <div className="site-container">
          <div className="workflow-timeline">
            {processSteps.map((step, index) => (
              <Reveal key={step.number} className={`workflow-row ${index % 2 ? 'reverse' : ''}`} delay={index * 90}>
                <div className="workflow-number">{step.number}</div>
                <div className="workflow-copy"><span>STEP {step.number}</span><h2>{step.title}</h2><p>{step.text}</p></div>
                <div className="workflow-illustration">{index === 0 ? <Fingerprint /> : index === 1 ? <Shield /> : index === 2 ? <KeyRound /> : <LockKeyhole />}<span className="workflow-illustration-ring" /></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <PrimaryCta title="Your vault starts with one simple step." text="Create an account and begin organizing your digital credentials." />
    </div>
  );
}

export function AboutPage() {
  const values = [
    { title: 'Security', text: 'We take the responsibility of handling sensitive information seriously.' },
    { title: 'Privacy', text: 'We value thoughtful, transparent choices that respect personal data.' },
    { title: 'Simplicity', text: 'Important tools should feel clear, approachable, and easy to use.' },
    { title: 'Innovation', text: 'We keep improving how people organize and manage digital credentials.' },
  ];
  return (
    <div className="page-transition">
      <section className="about-hero">
        <div className="site-container about-hero-grid">
          <div><span className="eyebrow">About Vault-X</span><h1>Built To Make Digital Security Simpler</h1><p>Vault-X helps bring important digital credentials together in a clear, organized environment designed around privacy and user confidence.</p><Link className="button button-primary" to="/features">Discover the platform <ArrowRight size={17} /></Link></div>
          <div className="about-hero-art"><div className="about-art-grid" /><div className="about-art-shield"><ShieldCheck size={68} /></div><div className="about-art-chip chip-one"><LockKeyhole size={18} /> Private</div><div className="about-art-chip chip-two"><Check size={18} /> Organized</div></div>
        </div>
      </section>
      <section className="content-section mission-section">
        <div className="site-container mission-grid">
          <Reveal><article className="mission-card"><span className="eyebrow">Our mission</span><h2>Make digital credential management simpler, organized, and security-focused.</h2><p>We want people to have a more intentional way to manage the information that helps them navigate their digital lives.</p></article></Reveal>
          <Reveal delay={90}><article className="mission-card mission-card-green"><span className="eyebrow">Our vision</span><h2>A modern environment for managing important information with confidence.</h2><p>Vault-X aims to make secure credential management easier to understand and easier to use.</p></article></Reveal>
        </div>
      </section>
      <section className="content-section values-section">
        <div className="site-container"><SectionTitle eyebrow="What guides us" title="Our values" /><div className="values-grid">{values.map((value, index) => <Reveal key={value.title} delay={index * 70}><article className="value-card"><span className="value-check"><Check size={18} /></span><h3>{value.title}</h3><p>{value.text}</p></article></Reveal>)}</div></div>
      </section>
      <PrimaryCta />
    </div>
  );
}

export function SecurityPage() {
  return (
    <div className="page-transition">
      <section className="security-page-hero">
        <div className="site-container security-hero-grid">
          <div><span className="eyebrow">A considered approach</span><h1>Security Is At The Core Of Vault-X</h1><p>Security and privacy guide how Vault-X is designed and how users manage access to their credentials.</p><Link className="button button-light" to="/signup">Create Your Vault <ArrowRight size={17} /></Link></div>
          <div className="security-hero-visual"><div className="security-ring ring-a" /><div className="security-ring ring-b" /><div className="security-lock"><ShieldCheck size={74} /></div><span className="security-signal signal-a"><LockKeyhole size={17} /></span><span className="security-signal signal-b"><Fingerprint size={17} /></span></div>
        </div>
      </section>
      <section className="content-section security-details">
        <div className="site-container"><SectionTitle eyebrow="Security principles" title="Thoughtful protection at every layer" description="No system can promise perfect security. Vault-X focuses on responsible practices and clear user control." /><div className="security-detail-grid">{securityItems.map((item, index) => <Reveal key={item.title} delay={index * 70}><article className="security-detail-card"><span className="security-detail-icon">{index === 0 ? <Database /> : index === 1 ? <LockKeyhole /> : index === 2 ? <Fingerprint /> : <ShieldCheck />}</span><h3>{item.title}</h3><p>{item.text}</p></article></Reveal>)}</div></div>
      </section>
      <section className="user-control-section"><div className="site-container user-control-inner"><span className="user-control-icon"><KeyRound size={27} /></span><div><span className="eyebrow">Your information, your decisions</span><h2>User Control</h2><p>Vault-X is built to help users manage their own credentials and account access with clear, understandable controls.</p></div></div></section>
      <PrimaryCta title="Make security part of your routine." text="Bring your digital credentials into a more organized space." />
    </div>
  );
}

function TermsDialog({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const [atEnd, setAtEnd] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const checkEnd = () => {
    const element = contentRef.current;
    if (element) setAtEnd(element.scrollTop + element.clientHeight >= element.scrollHeight - 8);
  };

  return (
    <div className="terms-backdrop" role="presentation">
      <section className="terms-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-heading">
        <div className="terms-heading"><div><span className="eyebrow">Please review</span><h2 id="terms-heading">Vault-X Terms and Conditions</h2><small>Effective date: {TERMS_VERSION}</small></div><button type="button" className="icon-button" aria-label="Close terms" onClick={onClose}><X size={19} /></button></div>
        <div ref={contentRef} className="terms-content" onScroll={checkEnd}><pre>{TERMS_AND_CONDITIONS}</pre></div>
        <div className="terms-footer"><span>{atEnd ? 'You have reached the end of the terms.' : 'Scroll to the bottom to continue.'}</span><button type="button" className="button button-primary" disabled={!atEnd} onClick={onAccept}>I have read the terms</button></div>
      </section>
    </div>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const { user, loading: authLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const location = useLocation();

  useEffect(() => {
    clearAuthError();
    setLocalError('');
    setMessage('');
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && user) navigate('/vault', { replace: true });
  }, [authLoading, user, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();
    setLocalError('');
    setMessage('');
    if (isSignup && password !== confirmPassword) {
      setLocalError('Your passwords do not match.');
      return;
    }
    if (isSignup && (!termsRead || !termsAccepted)) {
      setLocalError('Please read and accept the Terms and Conditions to create an account.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignup) await signUpWithEmail(email, password, fullName);
      else await signInWithEmail(email, password, remember);
      navigate('/vault');
    } catch {
      // AuthContext exposes the Firebase error in authError.
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    clearAuthError();
    setLocalError('');
    if (isSignup && (!termsRead || !termsAccepted)) {
      setLocalError('Please read and accept the Terms and Conditions to create an account.');
      return;
    }
    setSubmitting(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) navigate('/vault');
    } catch {
      // AuthContext exposes the Firebase error in authError.
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    clearAuthError();
    setLocalError('');
    if (!email.trim()) {
      setLocalError('Enter your email address first, then select Forgot Password.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setMessage(`Password reset instructions were sent to ${email}.`);
    } catch {
      // AuthContext exposes the Firebase error in authError.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page page-transition">
      <div className="auth-shell">
        <section className="auth-brand-panel">
          <Link to="/" className="auth-brand"><Brand inverse /></Link>
          <div className="auth-brand-content">
            <span className="auth-panel-kicker"><ShieldCheck size={15} /> YOUR DIGITAL LIFE, IN ORDER</span>
            <h1>{isSignup ? 'Create Your Secure Vault' : 'Welcome Back to Vault-X'}</h1>
            <p>{isSignup ? 'Start managing your digital credentials with Vault-X.' : 'Securely access and manage your digital credentials.'}</p>
            <div className="auth-visual">
              <div className="auth-visual-grid" />
              <div className="auth-visual-ring ring-one" /><div className="auth-visual-ring ring-two" />
              <div className="auth-visual-shield"><ShieldCheck size={64} /></div>
              <span className="auth-visual-chip chip-a"><LockKeyhole size={16} /> Private</span>
              <span className="auth-visual-chip chip-b"><Check size={16} /> Protected</span>
            </div>
          </div>
          <div className="auth-panel-bottom"><span><LockKeyhole size={14} /> Thoughtful security. Clear control.</span><span>© 2026 Vault-X</span></div>
        </section>
        <section className="auth-form-panel">
          <div className="auth-mobile-brand"><Link to="/"><Brand /></Link></div>
          <div className="auth-form-wrap">
            <span className="eyebrow">{isSignup ? 'Start with Vault-X' : 'Secure access'}</span>
            <h2>{isSignup ? 'Create Account' : 'Welcome Back!'}</h2>
            <p className="auth-form-subtitle">{isSignup ? 'Create your Vault-X account to get started.' : 'Sign in to your Vault-X account.'}</p>
            {(authError || localError) && <div className="auth-alert" role="alert">{authError || localError}</div>}
            {message && <div className="auth-success" role="status">{message}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {isSignup && <label>Full Name<input type="text" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" /></label>}
              <label>Email Address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
              <label>Password
                <span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={isSignup ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
              </label>
              {isSignup && <label>Confirm Password<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm your password" /></label>}
              {!isSignup && <div className="auth-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label><button type="button" className="inline-action" onClick={handleReset} disabled={submitting}>Forgot Password?</button></div>}
              {isSignup && <label className="terms-checkbox"><input type="checkbox" disabled={!termsRead} checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I agree to the <button type="button" className="inline-action" onClick={() => setShowTerms(true)}>Terms and Conditions</button>{!termsRead && <small> (read them first)</small>}</span></label>}
              <button type="submit" className="button button-primary auth-submit" disabled={submitting}>{submitting ? 'Please wait…' : isSignup ? 'Create Account' : 'Sign In'} <ArrowRight size={17} /></button>
            </form>

            <div className="auth-divider"><span>OR</span></div>
            <button type="button" className="google-button" onClick={handleGoogle} disabled={submitting}><span className="google-g">G</span>{submitting ? 'Connecting to Google…' : 'Continue with Google'}</button>
            <p className="auth-switch">{isSignup ? 'Already have an account?' : "Don't have an account?"} <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Sign In' : 'Create Account'}</Link></p>
          </div>
          <div className="auth-form-bottom"><Link to="/">Back to Vault-X</Link><span>Secure account access</span></div>
        </section>
      </div>
      {showTerms && <TermsDialog onClose={() => setShowTerms(false)} onAccept={() => { setTermsRead(true); setTermsAccepted(true); setShowTerms(false); }} />}
    </main>
  );
}

export function NotFoundPage() {
  return <div className="not-found page-transition"><span className="eyebrow">404 · Page not found</span><h1>This page isn’t in your vault.</h1><p>The link may be incorrect or the page may have moved.</p><Link className="button button-primary" to="/">Return Home <ArrowRight size={17} /></Link></div>;
}

export function AuthNotices() {
  const {
    recoveryNotice,
    clearRecoveryNotice,
    vaultRecoveryKeyNotice,
    clearVaultRecoveryKeyNotice,
  } = useAuth();

  if (vaultRecoveryKeyNotice) {
    return (
      <div className="terms-backdrop">
        <section className="notice-dialog" role="dialog" aria-modal="true" aria-labelledby="vault-key-title">
          <span className="notice-icon"><KeyRound size={23} /></span>
          <h2 id="vault-key-title">Save your Vault recovery key</h2>
          <p>This key helps recover access to encrypted vault data. Store it somewhere private; it will not be shown again.</p>
          <code>{vaultRecoveryKeyNotice}</code>
          <button type="button" className="button button-primary" onClick={clearVaultRecoveryKeyNotice}>I saved my recovery key</button>
        </section>
      </div>
    );
  }

  if (recoveryNotice) {
    return (
      <div className="terms-backdrop">
        <section className="notice-dialog" role="dialog" aria-modal="true" aria-labelledby="email-code-title">
          <span className="notice-icon"><KeyRound size={23} /></span>
          <h2 id="email-code-title">Save your recovery code</h2>
          <p>This one-time code can help you request an email change if you lose access to your sign-in email. Store it somewhere private.</p>
          <code>{recoveryNotice.code}</code>
          <button type="button" className="button button-primary" onClick={clearRecoveryNotice}>I saved my code</button>
        </section>
      </div>
    );
  }

  return null;
}

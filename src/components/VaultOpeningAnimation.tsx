import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, SkipForward } from 'lucide-react';

type VaultOpeningStage = 'intro' | 'turning' | 'welcome' | 'opening' | 'waiting' | 'entering';

interface VaultOpeningAnimationProps {
  readyToEnter: boolean;
  onComplete: () => void;
}

export function VaultOpeningAnimation({ readyToEnter, onComplete }: VaultOpeningAnimationProps) {
  const [stage, setStage] = useState<VaultOpeningStage>('intro');
  const [skipRequested, setSkipRequested] = useState(false);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const preparingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    skipButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSkipRequested(true);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (skipRequested && !readyToEnter) preparingRef.current?.focus();
  }, [readyToEnter, skipRequested]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStage('waiting');
      return;
    }

    const timers = [
      window.setTimeout(() => setStage('turning'), 1000),
      window.setTimeout(() => setStage('welcome'), 2900),
      window.setTimeout(() => setStage('opening'), 3900),
      window.setTimeout(() => setStage('waiting'), 5400),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (skipRequested) {
      if (readyToEnter) onComplete();
      return;
    }
    if (stage === 'waiting' && readyToEnter) {
      setStage('entering');
      return;
    }
    if (stage === 'entering') {
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
      const timer = window.setTimeout(onComplete, duration);
      return () => window.clearTimeout(timer);
    }
  }, [onComplete, readyToEnter, skipRequested, stage]);

  return (
    <div
      className={`vault-opening-overlay vault-opening-${stage}`}
      role="dialog"
      aria-modal="true"
      aria-label="Vault-X secure access"
    >
      <div className="vault-opening-ambient" aria-hidden="true" />
      {skipRequested ? (
        <div ref={preparingRef} className="vault-opening-preparing" role="status" tabIndex={-1}>
          <LoaderCircle size={23} className="vault-opening-loader" />
          <p>Preparing your private vault…</p>
        </div>
      ) : (
        <div className="vault-opening-content">
          <p className="vault-opening-eyebrow">VAULT-X SECURE ACCESS</p>
          <div className="vault-opening-scene">
            <div className="vault-opening-interior" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="vault-opening-door" aria-hidden="true">
              <svg viewBox="0 0 420 420" role="presentation">
                <defs>
                  <radialGradient id="vault-steel-face" cx="38%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#26362d" />
                    <stop offset="52%" stopColor="#111a15" />
                    <stop offset="100%" stopColor="#080d0a" />
                  </radialGradient>
                  <linearGradient id="vault-steel-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a5b2a9" />
                    <stop offset="22%" stopColor="#27342c" />
                    <stop offset="50%" stopColor="#78847b" />
                    <stop offset="74%" stopColor="#18241c" />
                    <stop offset="100%" stopColor="#849188" />
                  </linearGradient>
                </defs>
                <circle cx="210" cy="210" r="196" className="vault-opening-door-shadow" />
                <circle cx="210" cy="210" r="190" fill="url(#vault-steel-ring)" />
                <circle cx="210" cy="210" r="176" className="vault-opening-door-rim" />
                <circle cx="210" cy="210" r="162" fill="url(#vault-steel-face)" className="vault-opening-door-face" />
                <circle cx="210" cy="210" r="147" className="vault-opening-door-track" />
                <circle cx="210" cy="210" r="132" className="vault-opening-door-inner" />
                <g className="vault-opening-door-ridges">
                  <circle cx="210" cy="210" r="181" />
                  <circle cx="210" cy="210" r="169" />
                  <circle cx="210" cy="210" r="111" />
                  <circle cx="210" cy="210" r="101" />
                </g>
                <g className="vault-opening-bolts">
                  <rect x="198" y="34" width="24" height="24" rx="5" />
                  <rect x="198" y="362" width="24" height="24" rx="5" />
                  <rect x="34" y="198" width="24" height="24" rx="5" />
                  <rect x="362" y="198" width="24" height="24" rx="5" />
                </g>
                <g className="vault-opening-rivets">
                  {Array.from({ length: 12 }, (_, index) => {
                    const angle = (index * Math.PI) / 6;
                    const x = 210 + Math.cos(angle) * 176;
                    const y = 210 + Math.sin(angle) * 176;
                    return <circle key={index} cx={x} cy={y} r="3.5" />;
                  })}
                </g>
                <g className="vault-opening-wheel">
                  <circle cx="210" cy="210" r="79" className="vault-opening-wheel-ring" />
                  <circle cx="210" cy="210" r="65" className="vault-opening-wheel-plate" />
                  {[0, 60, 120].map((rotation) => (
                    <g key={rotation} transform={`rotate(${rotation} 210 210)`} className="vault-opening-wheel-spoke">
                      <line x1="210" y1="150" x2="210" y2="270" />
                      <rect x="199" y="127" width="22" height="38" rx="10" />
                    </g>
                  ))}
                  <circle cx="210" cy="210" r="25" className="vault-opening-wheel-hub-outer" />
                  <circle cx="210" cy="210" r="15" className="vault-opening-wheel-hub" />
                  <circle cx="210" cy="210" r="4" className="vault-opening-wheel-pin" />
                </g>
              </svg>
            </div>
            <div className="vault-opening-seal" aria-hidden="true">
              <img src={`${import.meta.env.BASE_URL}vault-x-mark.svg`} alt="" />
              <span />
            </div>
            {stage === 'welcome' && (
              <div className="vault-opening-welcome-message" role="status">
                <h1>WELCOME TO <span>VAULT-X</span></h1>
                <p>Your private world is ready.</p>
              </div>
            )}
          </div>
          {stage === 'waiting' && !readyToEnter && (
            <p className="vault-opening-status" role="status">Preparing your private vault…</p>
          )}
          <button ref={skipButtonRef} type="button" className="vault-opening-skip" onClick={() => setSkipRequested(true)}>
            <SkipForward size={15} />
            Skip animation
          </button>
        </div>
      )}
    </div>
  );
}

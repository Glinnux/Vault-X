import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Cloud, FileLock2, KeyRound, ShieldCheck, Smartphone, Users } from 'lucide-react';

const networkNodes = [
  { label: 'Identity', Icon: Users, className: 'home-node--top', delay: 0.1 },
  { label: 'Credentials', Icon: KeyRound, className: 'home-node--right', delay: 0.2 },
  { label: 'Documents', Icon: FileLock2, className: 'home-node--bottom-right', delay: 0.3 },
  { label: 'Your devices', Icon: Smartphone, className: 'home-node--bottom-left', delay: 0.4 },
  { label: 'Cloud storage', Icon: Cloud, className: 'home-node--left', delay: 0.5 },
];

const connectorPaths = [
  'M 350 205 L 350 55',
  'M 350 205 L 600 135',
  'M 350 205 L 535 355',
  'M 350 205 L 165 355',
  'M 350 205 L 100 135',
];

export const HomeNetworkAnimation: React.FC = () => {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="home-network-panel"
      aria-labelledby="home-network-title"
    >
      <div className="home-network-topline">
        <span className="home-network-kicker"><span /> VAULT X / SECURITY LAYER</span>
        <span className="home-network-version">NX-01</span>
      </div>
      <div className="home-network-copy">
        <h2 id="home-network-title">One vault. Every important thing.</h2>
        <p>Your identity, credentials, documents, and devices connected in one protected space.</p>
      </div>

      <div className="home-network-stage" aria-label="Vault security network">
        <div className="home-network-grid" />
        <div className="home-network-orbit home-network-orbit--outer" />
        <div className="home-network-orbit home-network-orbit--inner" />
        <svg className="home-network-lines" viewBox="0 0 700 410" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="home-network-gradient" x1="100" y1="50" x2="600" y2="360" gradientUnits="userSpaceOnUse">
              <stop stopColor="#52e486" />
              <stop offset="1" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          {connectorPaths.map((path, index) => (
            <g key={path}>
              <path className="home-network-line-base" d={path} />
              <motion.path
                className="home-network-line-active"
                d={path}
                stroke="url(#home-network-gradient)"
                pathLength={1}
                initial={reducedMotion ? false : { pathLength: 0, opacity: 0.25 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.9, delay: reducedMotion ? 0 : 0.2 + index * 0.12, ease: 'easeOut' }}
              />
            </g>
          ))}
        </svg>

        {networkNodes.map(({ label, Icon, className, delay }) => (
          <motion.div
            key={label}
            className={`home-network-node ${className}`}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : delay }}
          >
            <span className="home-network-node-icon"><Icon aria-hidden="true" /></span>
            <span className="home-network-node-label">{label}</span>
          </motion.div>
        ))}

        <div className="home-network-hub-anchor">
          <motion.div
            className="home-network-hub"
            initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
            animate={reducedMotion ? { scale: 1, opacity: 1 } : { scale: [0.94, 1.03, 1], opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.9, delay: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
          >
            <span className="home-network-hub-ring" />
            <ShieldCheck className="home-network-shield" strokeWidth={1.7} aria-label="Vault security hub" />
            <span className="home-network-hub-status">ENCRYPTED</span>
          </motion.div>
        </div>
      </div>
      <div className="home-network-footer">
        <span><i /> PRIVATE BY DESIGN</span>
        <span>IDENTITY <b>·</b> DATA <b>·</b> ACCESS</span>
      </div>
    </section>
  );
};

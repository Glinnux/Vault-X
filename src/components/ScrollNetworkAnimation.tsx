import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Cloud, FileLock2, KeyRound, ShieldCheck, Smartphone, Users } from 'lucide-react';

const networkNodes = [
  { label: 'Identity', Icon: Users, className: 'scroll-node--top' },
  { label: 'Credentials', Icon: KeyRound, className: 'scroll-node--right' },
  { label: 'Documents', Icon: FileLock2, className: 'scroll-node--bottom-right' },
  { label: 'Your devices', Icon: Smartphone, className: 'scroll-node--bottom-left' },
  { label: 'Cloud storage', Icon: Cloud, className: 'scroll-node--left' },
];

const connectorPaths = [
  'M 350 205 L 350 55',
  'M 350 205 L 600 135',
  'M 350 205 L 535 355',
  'M 350 205 L 165 355',
  'M 350 205 L 100 135',
];

export const ScrollNetworkAnimation: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const hubScale = useTransform(scrollYProgress, [0, 0.25, 0.58, 1], [0.62, 0.78, 1.16, 1.04]);
  const hubGlow = useTransform(scrollYProgress, [0, 0.42, 0.72, 1], [0.12, 0.22, 0.58, 0.42]);
  const hubBoxShadow = useTransform(hubGlow, (glow) => `0 0 ${18 + glow * 42}px rgba(88,168,50,${glow}), inset 0 0 22px rgba(88,168,50,0.12)`);
  const lineProgress = useTransform(scrollYProgress, [0.08, 0.34, 0.72], [0, 0.35, 1]);
  const nodeOpacity = useTransform(scrollYProgress, [0.02, 0.34, 0.7], [0.38, 0.72, 1]);

  return (
    <section
      ref={sectionRef}
      className="scroll-network-section relative isolate mx-auto my-12 w-full max-w-6xl overflow-clip rounded-3xl border border-slate-700/70 bg-slate-950/65 px-4 py-12 sm:my-16 sm:px-8 sm:py-16"
      aria-labelledby="scroll-network-title"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_55%,rgba(88,168,50,0.08),transparent_54%)]" />
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 font-mono text-[10px] tracking-[0.18em] text-cyan-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
          ONE SECURE ENCLAVE
        </span>
        <h2 id="scroll-network-title" className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Your data, connected by one vault
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Scroll to see the vault come into focus and connect your identity, credentials, documents, devices, and storage.
        </p>
      </div>

      <div className="scroll-network-stage relative mx-auto mt-8 max-w-4xl" aria-label="Vault security network animation">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 700 410" preserveAspectRatio="none" fill="none" aria-hidden="true">
          {connectorPaths.map((path) => (
            <g key={path}>
              <path d={path} stroke="#DCE7D6" strokeWidth="2" />
              <motion.path
                d={path}
                stroke="url(#vault-network-gradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                pathLength={1}
                style={{ pathLength: reducedMotion ? 1 : lineProgress }}
              />
            </g>
          ))}
          <defs>
            <linearGradient id="vault-network-gradient" x1="100" y1="50" x2="600" y2="360" gradientUnits="userSpaceOnUse">
              <stop stopColor="#58A832" />
              <stop offset="1" stopColor="#347A29" />
            </linearGradient>
          </defs>
        </svg>

        {networkNodes.map(({ label, Icon, className }) => (
          <motion.div
            key={label}
            className={`scroll-network-node ${className}`}
            style={{ opacity: reducedMotion ? 1 : nodeOpacity }}
          >
            <div className="scroll-network-node__shape"><Icon aria-hidden="true" /></div>
            <span>{label}</span>
          </motion.div>
        ))}

        <motion.div
          className="scroll-network-hub absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/70 bg-slate-950 text-cyan-200"
          style={{
            scale: reducedMotion ? 1 : hubScale,
            boxShadow: reducedMotion ? '0 0 24px rgba(88,168,50,0.2)' : hubBoxShadow,
          }}
        >
          <div className="absolute inset-2 rounded-full border border-cyan-300/20" />
          <ShieldCheck className="h-9 w-9 sm:h-11 sm:w-11" strokeWidth={1.6} aria-label="Vault security hub" />
        </motion.div>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] tracking-[0.14em] text-slate-500">SCROLL TO CONNECT</p>
    </section>
  );
};

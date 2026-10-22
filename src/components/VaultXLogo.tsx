import React from 'react';

interface VaultXLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showGlow?: boolean;
  withText?: boolean;
}

export const VaultXLogo: React.FC<VaultXLogoProps> = ({
  size = 'md',
  className = '',
  showGlow = true,
  withText = false,
}) => {
  const pixelSize =
    typeof size === 'number'
      ? size
      : size === 'xs'
      ? 20
      : size === 'sm'
      ? 28
      : size === 'md'
      ? 40
      : size === 'lg'
      ? 56
      : 80;

  return (
    <div className={`inline-flex items-center space-x-3 select-none ${className}`}>
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{ width: pixelSize, height: pixelSize }}
      >
        {/* Ambient Emerald Glow Backing */}
        {showGlow && (
          <div
            className="absolute inset-0 rounded-2xl bg-emerald-500/25 blur-md pointer-events-none transform scale-110"
            aria-hidden="true"
          />
        )}

        {/* Vector SVG Monogram 'Vault X' */}
        <svg
          viewBox="0 0 120 120"
          width="100%"
          height="100%"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
        >
          <defs>
            {/* Primary Emerald Gradient */}
            <linearGradient id="vxEmeraldPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Vibrant White-to-Mint Titanium Gradient */}
            <linearGradient id="vxWhiteFacet" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ecfdf5" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </linearGradient>

            {/* Dark Jade Bevel Shadow */}
            <linearGradient id="vxJadeDark" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#064e3b" />
              <stop offset="100%" stopColor="#022c22" />
            </linearGradient>

            {/* Core Glow Filter */}
            <radialGradient id="vxCoreLight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Plate: Rounded Hexagonal Shield/Vault Safe Door */}
          <rect
            x="6"
            y="6"
            width="108"
            height="108"
            rx="26"
            fill="#06120c"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeOpacity="0.45"
          />

          {/* Micro Precision Corner Bevels */}
          <circle cx="16" cy="16" r="2.5" fill="#34d399" opacity="0.6" />
          <circle cx="104" cy="16" r="2.5" fill="#34d399" opacity="0.6" />
          <circle cx="16" cy="104" r="2.5" fill="#34d399" opacity="0.6" />
          <circle cx="104" cy="104" r="2.5" fill="#34d399" opacity="0.6" />

          {/* Orbital Vault Ring */}
          <circle
            cx="60"
            cy="60"
            r="44"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeOpacity="0.25"
            strokeDasharray="4 6"
          />

          {/* ARM 1 (Top-Left to Bottom-Right): Emerald Facet */}
          <path
            d="M 28 28 L 46 22 L 92 92 L 74 98 Z"
            fill="url(#vxEmeraldPrimary)"
          />
          <path
            d="M 28 28 L 38 25 L 82 95 L 74 98 Z"
            fill="url(#vxJadeDark)"
            opacity="0.3"
          />

          {/* ARM 2 (Top-Right to Bottom-Left): Titanium White Facet */}
          <path
            d="M 92 28 L 74 22 L 28 92 L 46 98 Z"
            fill="url(#vxWhiteFacet)"
          />
          <path
            d="M 92 28 L 84 25 L 36 95 L 46 98 Z"
            fill="#6ee7b7"
            opacity="0.5"
          />

          {/* Interlocking Overlap Matrix & Precision Central Diamond */}
          <polygon
            points="60,42 78,60 60,78 42,60"
            fill="#042f22"
            stroke="#34d399"
            strokeWidth="2"
          />

          {/* Central Vault Core Indicator: Micro-safe Iris */}
          <circle cx="60" cy="60" r="14" fill="url(#vxCoreLight)" />
          <circle cx="60" cy="60" r="7" fill="#ffffff" />
          <circle cx="60" cy="60" r="3" fill="#064e3b" />

          {/* Vault Locking Aperture Crosshairs */}
          <line x1="60" y1="46" x2="60" y2="52" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="60" y1="68" x2="60" y2="74" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="46" y1="60" x2="52" y2="60" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="68" y1="60" x2="74" y2="60" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      {withText && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-xl tracking-tight text-white font-mono">
              VAULT<span className="text-emerald-400">X</span>
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              PRO
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80">
            Zero-Knowledge Enclave
          </span>
        </div>
      )}
    </div>
  );
};

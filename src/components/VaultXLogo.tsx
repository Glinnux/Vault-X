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
        {/* Ambient Blue Glow Backing */}
        {showGlow && (
          <div
            className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-md pointer-events-none transform scale-110"
            aria-hidden="true"
          />
        )}

        <img
          src="/vault-x-logo.png"
          alt="Vault X"
          width="100%"
          height="100%"
          draggable={false}
          className="relative z-10 object-contain drop-shadow-[0_4px_12px_rgba(37,99,235,0.3)] animate-subtle-float"
        />
      </div>

      {withText && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-xl tracking-tight text-white font-mono">
              VAULT<span className="text-emerald-400">-X</span>
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

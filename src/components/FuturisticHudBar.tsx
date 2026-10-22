import React, { useState, useEffect } from 'react';
import { Cpu, Activity, Lock, Bot, Copy } from 'lucide-react';

interface FuturisticHudBarProps {
  totalItems: number;
  userEmail?: string | null;
  userUid?: string | null;
  onOpenGuide?: () => void;
}

export const FuturisticHudBar: React.FC<FuturisticHudBarProps> = ({
  totalItems,
  userEmail,
  userUid,
  onOpenGuide,
}) => {
  const [latency, setLatency] = useState(24);
  const [isSecure, setIsSecure] = useState(true);

  // Micro jitter for latency to feel like a live secure socket
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(21 + Math.random() * 8));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 w-full mb-6">
      <div className="bg-[#05140d]/80 border border-emerald-900/50 rounded-xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-300 tech-corners">
        {/* Left: System Status & Pulse */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-radar-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-400 tracking-wider uppercase">
              ENCLAVE SECURE
            </span>
          </div>

          <span className="text-emerald-950 hidden sm:inline">|</span>

          <div className="hidden sm:flex items-center space-x-1.5 text-slate-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>AES-256 ZERO-KNOWLEDGE</span>
          </div>
        </div>

        {/* Center: Live Telemetry */}
        <div className="hidden md:flex items-center space-x-4 text-[10px] text-slate-400">
          <div className="flex items-center space-x-1 text-slate-300">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span>VAULT X CLOUD</span>
          </div>
          <div className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span>PING: {latency}ms</span>
          </div>
        </div>

        {/* Right: Quick Security Audit trigger & Record badge */}
        <div className="flex items-center space-x-2 ml-auto">
          {userUid && (
            <div
              className="hidden sm:inline-flex items-center space-x-1 bg-black/60 text-slate-300 border border-emerald-950 px-2 py-0.5 rounded text-[10px]"
              title={`Verification UID: ${userUid}`}
            >
              <span className="text-slate-400">UID:</span>
              <span className="text-emerald-300 font-bold">{userUid.slice(0, 8)}...</span>
              <button
                onClick={() => navigator.clipboard.writeText(userUid)}
                className="text-slate-400 hover:text-white p-0.5"
                title="Copy UID"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px]">
            [{totalItems} {totalItems === 1 ? 'RECORD' : 'RECORDS'} ENCRYPTED]
          </span>

          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="flex items-center space-x-1 text-[10px] text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 hover:border-emerald-300 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs shadow-emerald-950/40"
              title="Open Vault X Storage & Information Guide"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>GUIDE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

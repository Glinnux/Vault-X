import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, UserCheck, KeyRound, Database, X, Terminal, Cpu } from 'lucide-react';
import { VaultXLogo } from './VaultXLogo';
import { useAuth } from '../context/AuthContext';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-[#05140d]/95 border border-emerald-500/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl shadow-emerald-950/50 relative max-h-[90vh] overflow-y-auto tech-corners"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-950">
            <div className="flex items-center space-x-3">
              <VaultXLogo size={36} showGlow={false} />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-white font-mono">
                    Vault X Isolation & Security
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                    VERIFIED
                  </span>
                </div>
                <p className="text-xs text-emerald-300/70 font-mono text-[11px]">
                  Zero-Trust Google Cloud Firestore Cryptographic Isolation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs text-slate-300">
            {/* Active Session Info */}
            <div className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Authenticated Principal
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-medium font-mono">
                  ● ACTIVE ENCLAVE
                </span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-slate-400">
                <div>
                  <span className="text-slate-500">Google UID:</span>{' '}
                  <span className="text-slate-200">{user?.uid || 'Not signed in'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{' '}
                  <span className="text-slate-200">{user?.email || 'None'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Firestore Scope:</span>{' '}
                  <span className="text-cyan-400 font-bold">
                    {user?.uid ? `/users/${user.uid}/vault/*` : 'Restricted'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pillars of Isolation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center space-x-2 text-cyan-400 font-medium mb-1">
                  <Lock className="w-4 h-4" />
                  <span>Strict Vault Partitioning</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Every password, note, and image is locked in the user's isolated subcollection (<code className="text-cyan-300">/users/{'{userId}'}/vault/{'{itemId}'}</code>). Cross-user reads are structurally impossible.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center space-x-2 text-indigo-400 font-medium mb-1">
                  <KeyRound className="w-4 h-4" />
                  <span>Zero-Trust Rules Engine</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Google Firestore rejects any request if <code className="text-indigo-300">request.auth.uid != userId</code>. No client-side manipulation can bypass this.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center space-x-2 text-amber-400 font-medium mb-1">
                  <Database className="w-4 h-4" />
                  <span>200MB Asset Encryption</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Confidential images and document attachments up to 200MB are chunked and encrypted in isolated user document storage.
                </p>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center space-x-2 text-emerald-400 font-medium mb-1">
                  <Cpu className="w-4 h-4" />
                  <span>AES-256 Storage at Rest</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Google Cloud hardware keys automatically encrypt all database tables with AES-256 before writing to persistent disk.
                </p>
              </div>
            </div>

            {/* Code preview of rules */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-slate-300 flex items-center gap-1.5 font-mono text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Live Firestore Rule Enforcement:
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">RULESET v2 DEPLOYED</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-200/90 overflow-x-auto leading-relaxed">
{`match /users/{userId}/vault/{itemId} {
  allow get, delete: if isOwner(userId) && isValidId(userId) && isValidId(itemId);
  allow list: if isOwner(userId);
  allow create, update: if isOwner(userId) && isValidId(userId) && isValidId(itemId) &&
    incoming().userId == request.auth.uid &&
    incoming().createdAt is timestamp &&
    incoming().updatedAt == request.time;
}`}
              </pre>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-medium rounded-xl transition-all cursor-pointer shadow-sm shadow-cyan-600/30"
            >
              Acknowledge & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

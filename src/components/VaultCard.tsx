import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  Trash2,
  Star,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Download,
  Maximize2,
  X,
  Lock,
  Cpu,
} from 'lucide-react';
import { VaultItem } from '../types/vault';
import { formatBytes, resolveVaultFileUrl } from '../services/imageStorageService';

interface VaultCardProps {
  item: VaultItem;
  slotIndex?: number;
  canEdit?: boolean;
  onEdit: (item: VaultItem) => void;
  onDelete: (itemId: string) => Promise<void>;
  onToggleFavorite: (itemId: string, current: boolean) => Promise<void>;
  onCopySuccess: (text: string) => void;
  onLockedEditClick?: (slotIndex: number) => void;
}

const CYBER_CHARS = ['0', '1', 'X', '#', '$', '%', '&', 'Ψ', 'Δ', '8', '9', 'Z'];

export const VaultCard: React.FC<VaultCardProps> = ({
  item,
  slotIndex,
  canEdit = true,
  onEdit,
  onDelete,
  onToggleFavorite,
  onCopySuccess,
  onLockedEditClick,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(item.imageUrl);

  // Futuristic Decrypt scramble state
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [scramblePreview, setScramblePreview] = useState('');

  useEffect(() => {
    let active = true;
    setResolvedImageUrl(item.imageUrl);
    if (item.imageUrl?.startsWith('supabase://')) {
      resolveVaultFileUrl(item.imageUrl).then((url) => {
        if (active) setResolvedImageUrl(url);
      }).catch(() => {
        if (active) setResolvedImageUrl(undefined);
      });
    }
    return () => { active = false; };
  }, [item.imageUrl]);

  // Auto-hide password after 15 seconds for privacy
  useEffect(() => {
    if (showPassword) {
      const timer = setTimeout(() => setShowPassword(false), 15000);
      return () => clearTimeout(timer);
    }
  }, [showPassword]);

  // Handle password reveal with a 250ms cyber terminal decrypt scramble
  const handleTogglePassword = () => {
    if (showPassword) {
      setShowPassword(false);
      setIsDecrypting(false);
      return;
    }

    if (!item.password) {
      setShowPassword(true);
      return;
    }

    setIsDecrypting(true);
    let iterations = 0;
    const maxIterations = 5;
    const len = Math.min(item.password.length, 16);

    const interval = setInterval(() => {
      iterations++;
      let scrambled = '';
      for (let i = 0; i < len; i++) {
        scrambled += CYBER_CHARS[Math.floor(Math.random() * CYBER_CHARS.length)];
      }
      setScramblePreview(scrambled);

      if (iterations >= maxIterations) {
        clearInterval(interval);
        setIsDecrypting(false);
        setShowPassword(true);
      }
    }, 45);
  };

  const handleCopyUsername = () => {
    if (!item.username) return;
    navigator.clipboard.writeText(item.username);
    setCopiedUser(true);
    onCopySuccess('Username decrypted to clipboard');
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!item.password) return;
    navigator.clipboard.writeText(item.password);
    setCopiedPass(true);
    onCopySuccess('Password decrypted & copied securely');
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      await onDelete(item.id);
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Service badges & colors
  const getServiceBadge = () => {
    const s = (item.service || item.title).toLowerCase();
    if (s.includes('google')) {
      return { label: 'Google', bg: 'bg-red-500/15 text-red-400 border-red-500/30' };
    }
    if (s.includes('facebook')) {
      return { label: 'Facebook', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    }
    if (s.includes('github')) {
      return { label: 'GitHub', bg: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
    }
    if (s.includes('apple')) {
      return { label: 'Apple', bg: 'bg-slate-400/15 text-slate-200 border-slate-400/30' };
    }
    if (item.type === 'document') {
      return { label: 'Document', bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    }
    return { label: item.service || 'Credential', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  };

  const badge = getServiceBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-[#05140d]/85 hover:bg-[#071c12]/95 border border-emerald-950 hover:border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-md hover:shadow-emerald-950/40 transition-all duration-300 group relative scanline-container tech-corners backdrop-blur-sm"
    >
      {/* Top row: Icon, Title, Badge, Favorite & Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-black/60 border border-emerald-950 group-hover:border-emerald-500/40 flex items-center justify-center flex-shrink-0 shadow-inner transition-colors">
            {item.type === 'credential' ? (
              <KeyRound className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
            ) : (
              <FileText className="w-5 h-5 text-emerald-300 group-hover:text-white transition-colors" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.bg}`}>
                {badge.label}
              </span>
              {!canEdit && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 flex items-center gap-1 font-semibold" title={`Slot #${(slotIndex ?? 0) + 1} is View-Only because subscription has expired. Renew to edit.`}>
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>VIEW-ONLY</span>
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
              <span className="capitalize">{item.category}</span>
              {typeof slotIndex === 'number' && (
                <span className="text-[10px] font-mono text-slate-500">
                  #Slot {slotIndex + 1}
                </span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 flex items-center gap-0.5 text-[11px] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Favorite & Control actions */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={() => onToggleFavorite(item.id, Boolean(item.favorite))}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              item.favorite ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={item.favorite ? 'Unpin favorite' : 'Pin to favorites'}
          >
            <Star className={`w-4 h-4 ${item.favorite ? 'fill-yellow-400' : ''}`} />
          </button>

          {!canEdit ? (
            <button
              onClick={() => onLockedEditClick?.(slotIndex ?? 0)}
              className="p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer border border-amber-500/20"
              title={`View-Only Slot #${(slotIndex ?? 0) + 1}. Editing locked after countdown expiration. Click to learn how to renew.`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </button>
          ) : (
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Edit Item"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center space-x-1 animate-in fade-in">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
              title="Delete from Vault"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Credential Data Fields */}
      {item.type === 'credential' && (
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/80">
          {/* Username row */}
          {item.username && (
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-500 text-[11px] font-mono">USER:</span>
                <span className="font-mono text-slate-200 truncate select-all">{item.username}</span>
              </div>
              <button
                onClick={handleCopyUsername}
                className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded transition-colors cursor-pointer ml-2 flex-shrink-0"
                title="Copy username"
              >
                {copiedUser ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Password row with futuristic decrypt scramble */}
          {item.password && (
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-500 text-[11px] font-mono">KEY:</span>
                <span className="font-mono text-slate-200 tracking-wider truncate select-all">
                  {isDecrypting ? (
                    <span className="text-cyan-400 animate-pulse font-bold">{scramblePreview}</span>
                  ) : showPassword ? (
                    <span className="text-emerald-300">{item.password}</span>
                  ) : (
                    '••••••••••••••••'
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                <button
                  onClick={handleTogglePassword}
                  className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded transition-colors cursor-pointer"
                  title={showPassword ? 'Mask key' : 'Decrypt & reveal key'}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={handleCopyPassword}
                  className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/30 rounded transition-colors cursor-pointer"
                  title="Copy password"
                >
                  {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document / Notes display */}
      {item.notes && (
        <div className={`mt-3 pt-2.5 ${item.type === 'document' ? '' : 'border-t border-slate-800/60'}`}>
          <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] text-slate-500">
              {item.type === 'document' ? '[DOC_PAYLOAD]' : '[SECURE_NOTE]'}:
            </span>
            {item.notes.length > 120 && (
              <button
                onClick={() => setExpandedNotes(!expandedNotes)}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer text-[10px]"
              >
                {expandedNotes ? (
                  <><span>Collapse</span><ChevronUp className="w-3 h-3" /></>
                ) : (
                  <><span>Expand</span><ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
          <div
            className={`text-xs text-slate-300 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 whitespace-pre-wrap font-mono leading-relaxed break-words ${
              !expandedNotes && item.notes.length > 120 ? 'line-clamp-3' : ''
            }`}
          >
            {item.notes}
          </div>
        </div>
      )}

      {/* Image Attachment Display (Max 50MB) */}
      {resolvedImageUrl && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/60">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-mono text-[10px]">ENCRYPTED_ASSET:</span>
            </span>
            {item.imageSize && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formatBytes(item.imageSize)}
              </span>
            )}
          </div>

          <div
            onClick={() => setShowLightbox(true)}
            className="group/img relative bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl overflow-hidden cursor-pointer transition-all flex items-center p-2 space-x-3"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 relative">
              <img
                src={resolvedImageUrl}
                alt={item.imageName || 'Attached document'}
                className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate group-hover/img:text-cyan-300 transition-colors">
                {item.imageName || 'Document Image'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click to inspect full resolution
              </p>
            </div>

            <div className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900/60 group-hover/img:bg-cyan-600/30 group-hover/img:text-cyan-200 transition-all">
              <Maximize2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Full Resolution Modal */}
      {showLightbox && resolvedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowLightbox(false);
          }}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col relative tech-corners"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal top bar */}
            <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-white">
              <div className="flex items-center space-x-2 truncate pr-4">
                <ImageIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="font-semibold truncate">{item.imageName || item.title}</span>
                {item.imageSize && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    ({formatBytes(item.imageSize)})
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href={resolvedImageUrl}
                  download={item.imageName || 'vault-image'}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Download</span>
                </a>

                <button
                  onClick={() => setShowLightbox(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image display */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60">
              <img
                src={resolvedImageUrl}
                alt={item.imageName || 'Full resolution view'}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

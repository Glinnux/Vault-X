import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
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
import { useAuth } from '../context/AuthContext';
import { usePrivacySettings } from '../context/PrivacySettingsContext';

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
  const [showUsername, setShowUsername] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
  const [revealBlocked, setRevealBlocked] = useState(false);
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
  const scrambleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, vaultUnlocked } = useAuth();
  const { screenshotProtectionEnabled } = usePrivacySettings();
  const location = useLocation();

  const hideSensitiveValues = useCallback(() => {
    setShowPassword(false);
    setShowUsername(false);
    setShowUrl(false);
    setShowNotes(false);
    setShowAttachment(false);
    setShowLightbox(false);
    setExpandedNotes(false);
    setIsDecrypting(false);
    setShowPrivacyWarning(false);
    setRevealBlocked(false);
    if (scrambleIntervalRef.current) {
      clearInterval(scrambleIntervalRef.current);
      scrambleIntervalRef.current = null;
    }
  }, []);

  const requireAuthenticatedReveal = (reveal: () => void) => {
    if (!user || !vaultUnlocked) {
      setRevealBlocked(true);
      return;
    }
    setRevealBlocked(false);
    setShowPrivacyWarning(true);
    reveal();
  };

  const hasRevealedSensitiveValue = showPassword || showUsername || showUrl || showNotes || showAttachment;

  useEffect(() => {
    let active = true;
    let createdObjectUrl: string | undefined;
    setResolvedImageUrl(item.imageUrl);
    if (item.imageUrl?.startsWith('supabase://')) {
      resolveVaultFileUrl(item.imageUrl, item.imageIv, item.imageType).then((url) => {
        if (active) {
          createdObjectUrl = url?.startsWith('blob:') ? url : undefined;
          setResolvedImageUrl(url);
        }
      }).catch(() => {
        if (active) setResolvedImageUrl(undefined);
      });
    }
    return () => {
      active = false;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [item.imageUrl, item.imageIv, item.imageType]);

  // Hide all revealed values when authentication/unlock ends or route navigation occurs.
  useEffect(() => {
    if (!user || !vaultUnlocked) hideSensitiveValues();
  }, [user, vaultUnlocked, hideSensitiveValues]);

  useEffect(() => {
    hideSensitiveValues();
  }, [location.pathname, location.search, hideSensitiveValues]);

  // On browsers, screenshots cannot be blocked; privacy mode hides exposed values on blur/tab switch.
  useEffect(() => {
    const hideWhenHidden = () => {
      if (document.visibilityState === 'hidden') hideSensitiveValues();
    };
    const hideOnBlur = () => {
      if (screenshotProtectionEnabled) hideSensitiveValues();
    };
    window.addEventListener('blur', hideOnBlur);
    window.addEventListener('pagehide', hideSensitiveValues);
    document.addEventListener('visibilitychange', hideWhenHidden);
    return () => {
      window.removeEventListener('blur', hideOnBlur);
      window.removeEventListener('pagehide', hideSensitiveValues);
      document.removeEventListener('visibilitychange', hideWhenHidden);
    };
  }, [hideSensitiveValues, screenshotProtectionEnabled]);

  // Revealed data is temporary, including notes, usernames, URLs, and attachment previews.
  useEffect(() => {
    if (!hasRevealedSensitiveValue) return;
    const timer = window.setTimeout(hideSensitiveValues, 15_000);
    return () => window.clearTimeout(timer);
  }, [hasRevealedSensitiveValue, hideSensitiveValues]);

  useEffect(() => {
    if (!showLightbox) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowLightbox(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showLightbox]);

  // Handle password reveal with a 250ms cyber terminal decrypt scramble
  const handleTogglePassword = () => {
    if (showPassword) {
      setShowPassword(false);
      setIsDecrypting(false);
      return;
    }

    if (!user || !vaultUnlocked) {
      setRevealBlocked(true);
      return;
    }
    setRevealBlocked(false);
    setShowPrivacyWarning(true);

    if (!item.password) {
      setShowPassword(true);
      return;
    }

    setIsDecrypting(true);
    let iterations = 0;
    const maxIterations = 5;
    const len = Math.min(item.password.length, 16);

    scrambleIntervalRef.current = setInterval(() => {
      iterations++;
      let scrambled = '';
      for (let i = 0; i < len; i++) {
        scrambled += CYBER_CHARS[Math.floor(Math.random() * CYBER_CHARS.length)];
      }
      setScramblePreview(scrambled);

      if (iterations >= maxIterations) {
        if (scrambleIntervalRef.current) clearInterval(scrambleIntervalRef.current);
        scrambleIntervalRef.current = null;
        setIsDecrypting(false);
        setShowPassword(true);
      }
    }, 45);
  };

  const handleCopyUsername = () => {
    if (!item.username) return;
    if (!showUsername) {
      requireAuthenticatedReveal(() => setShowUsername(true));
      return;
    }
    if (!user || !vaultUnlocked) return;
    navigator.clipboard.writeText(item.username);
    setCopiedUser(true);
    onCopySuccess('Username decrypted to clipboard');
    setTimeout(() => setCopiedUser(false), 2000);
  };

  const handleCopyPassword = () => {
    if (!item.password) return;
    if (!showPassword) {
      handleTogglePassword();
      return;
    }
    if (!user || !vaultUnlocked) return;
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
    if (item.type === 'document') {
      return { label: 'Document', bg: 'badge-document' };
    }
    if (s.includes('google')) {
      return { label: 'Google', bg: 'badge-service' };
    }
    if (s.includes('facebook')) {
      return { label: 'Facebook', bg: 'badge-service' };
    }
    if (s.includes('github')) {
      return { label: 'GitHub', bg: 'badge-service' };
    }
    if (s.includes('apple')) {
      return { label: 'Apple', bg: 'badge-service' };
    }
    return { label: item.service || 'Credential', bg: 'badge-credential' };
  };

  const badge = getServiceBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="vault-card-modern bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm transition-all duration-300 group relative"
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
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}>
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
              <span className={`category-badge category-${item.category}`}>
                {item.category === 'document' ? 'Document' : item.category}
              </span>
              {typeof slotIndex === 'number' && (
                <span className="text-[10px] font-mono text-slate-500">
                  #Slot {slotIndex + 1}
                </span>
              )}
              {item.url && (showUrl ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 flex items-center gap-0.5 text-[11px] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="max-w-[120px] truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => requireAuthenticatedReveal(() => setShowUrl(true))}
                  className="vault-sensitive-reveal-button"
                  aria-label={`Reveal website address for ${item.title}`}
                >
                  <Eye size={13} /> Reveal link
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Favorite & Control actions */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <button
            onClick={() => onToggleFavorite(item.id, Boolean(item.favorite))}
            aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
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
              aria-label={`Editing locked for slot ${(slotIndex ?? 0) + 1}`}
              className="p-1.5 text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/50 rounded-lg transition-colors cursor-pointer border border-amber-500/20"
              title={`View-Only Slot #${(slotIndex ?? 0) + 1}. Editing locked after countdown expiration. Click to learn how to renew.`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </button>
          ) : (
            <button
              onClick={() => onEdit(item)}
              aria-label={`Edit ${item.title}`}
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
                aria-label={`Confirm delete ${item.title}`}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                aria-label="Cancel delete"
                className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              aria-label={`Delete ${item.title}`}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
              title="Delete from Vault"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {revealBlocked && (
        <p className="vault-sensitive-warning" role="alert">
          Sign in and unlock your vault before revealing protected information.
        </p>
      )}
      {showPrivacyWarning && hasRevealedSensitiveValue && (
        <p className="vault-sensitive-warning" role="status" aria-live="polite">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Sensitive information is visible. Browser screenshots may still capture it. Values hide after 15 seconds, when you leave this view, or when this tab loses focus.</span>
        </p>
      )}

      {/* Credential Data Fields */}
      {item.type === 'credential' && (
        <div className="space-y-2 mt-3 pt-3 border-t border-slate-800/80">
          {/* Username row */}
          {item.username && (
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-500 text-xs font-mono">USER:</span>
                <span className={`font-mono truncate ${showUsername ? 'text-slate-200 select-all' : 'vault-sensitive-masked'}`}>
                  {showUsername ? item.username : '\u2022'.repeat(10)}
                </span>
              </div>
              <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => showUsername ? setShowUsername(false) : requireAuthenticatedReveal(() => setShowUsername(true))}
                  aria-label={showUsername ? `Hide username for ${item.title}` : `Reveal username for ${item.title}`}
                  aria-pressed={showUsername}
                  className="p-1 text-slate-400 hover:text-emerald-300 rounded transition-colors cursor-pointer"
                  title={showUsername ? 'Hide username' : 'Reveal username'}
                >
                  {showUsername ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyUsername}
                  aria-label={`Copy username for ${item.title}`}
                  className="p-1 text-slate-400 hover:text-emerald-300 rounded transition-colors cursor-pointer"
                  title={showUsername ? 'Copy username' : 'Reveal username before copying'}
                >
                  {copiedUser ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Password row with futuristic decrypt scramble */}
          {item.password && (
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800/80 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-500 text-[11px] font-mono">KEY:</span>
                <span className={`font-mono tracking-wider truncate ${showPassword ? 'text-emerald-300 select-all' : 'vault-sensitive-masked'}`}>
                  {isDecrypting ? (
                    <span className="text-cyan-400 animate-pulse font-bold">{scramblePreview}</span>
                  ) : showPassword ? (
                    <span>{item.password}</span>
                  ) : (
                    '\u2022'.repeat(12)
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                <button
                  onClick={handleTogglePassword}
                  aria-label={showPassword ? `Hide password for ${item.title}` : `Show password for ${item.title}`}
                  className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded transition-colors cursor-pointer"
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
                  aria-label={`Copy password for ${item.title}`}
                  className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded transition-colors cursor-pointer"
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
            <div className="flex items-center gap-2">
              {showNotes && item.notes.length > 120 && (
              <button
                onClick={() => setExpandedNotes(!expandedNotes)}
                aria-label={expandedNotes ? 'Collapse notes' : 'Expand notes'}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer text-[10px]"
              >
                {expandedNotes ? (
                  <><span>Collapse</span><ChevronUp className="w-3 h-3" /></>
                ) : (
                  <><span>Expand</span><ChevronDown className="w-3 h-3" /></>
                )}
              </button>
              )}
              <button
                type="button"
                onClick={() => showNotes ? setShowNotes(false) : requireAuthenticatedReveal(() => setShowNotes(true))}
                className="vault-sensitive-reveal-button"
                aria-label={showNotes ? `Hide notes for ${item.title}` : `Reveal notes for ${item.title}`}
                aria-pressed={showNotes}
              >
                {showNotes ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Reveal notes</>}
              </button>
            </div>
          </div>
          {showNotes ? (
            <div
              className={`text-xs text-slate-200 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 whitespace-pre-wrap font-mono leading-relaxed break-words ${
                !expandedNotes && item.notes.length > 120 ? 'line-clamp-3' : ''
              }`}
            >
              {item.notes}
            </div>
          ) : (
            <div className="vault-sensitive-masked rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 text-xs font-mono" aria-hidden="true">
              {'\u2022'.repeat(16)}
            </div>
          )}
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
            {showAttachment && (
              <button type="button" onClick={() => { setShowAttachment(false); setShowLightbox(false); }} className="vault-sensitive-reveal-button">
                <EyeOff size={13} /> Hide file
              </button>
            )}
          </div>

          {showAttachment ? (
            <button
              type="button"
              onClick={() => setShowLightbox(true)}
              aria-label={`Preview ${item.imageName || item.title}`}
              className="group/img relative w-full bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 rounded-xl overflow-hidden cursor-pointer transition-all flex items-center p-2 space-x-3 text-left"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 relative">
                <img src={resolvedImageUrl} alt="" className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{item.imageName || 'Attached document'}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Open private preview</p>
              </div>
              <Maximize2 className="w-4 h-4 text-emerald-300" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => requireAuthenticatedReveal(() => setShowAttachment(true))}
              className="vault-sensitive-reveal-button min-h-[58px] w-full justify-center"
              aria-label={`Reveal attached file for ${item.title}`}
            >
              <Eye size={15} /> Reveal attached file
            </button>
          )}
        </div>
      )}

      {/* Lightbox Full Resolution Modal */}
      {showLightbox && resolvedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={`Document preview: ${item.imageName || item.title}`}
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
                  aria-label={`Download ${item.imageName || 'vault image'}`}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-xs hidden sm:inline">Download</span>
                </a>

                <button
                  onClick={() => setShowLightbox(false)}
                  aria-label="Close document preview"
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

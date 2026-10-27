import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  KeyRound,
  FileText,
  Eye,
  EyeOff,
  Tag,
  Star,
  Check,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { VaultCategory, VaultItemType } from '../types/vault';
import { useAuth } from '../context/AuthContext';
import { ImageUploader } from './ImageUploader';
import { uploadVaultImage } from '../services/imageStorageService';

interface AddVaultItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialCount?: number;
  maxSlots?: number;
  onNavigateToPayment?: () => void;
  isUnlimited?: boolean;
  onAdd: (data: {
    type: VaultItemType;
    title: string;
    service?: string;
    username?: string;
    password?: string;
    url?: string;
    category: VaultCategory;
    notes?: string;
    imageUrl?: string;
    imageName?: string;
    imageSize?: number;
    imageType?: string;
    favorite?: boolean;
  }) => Promise<void>;
}

const PRESETS = [
  { name: 'Google', url: 'https://accounts.google.com', category: 'social' as VaultCategory, color: 'text-red-400 border-red-500/30' },
  { name: 'Facebook', url: 'https://www.facebook.com', category: 'social' as VaultCategory, color: 'text-blue-400 border-blue-500/30' },
  { name: 'GitHub', url: 'https://github.com/login', category: 'work' as VaultCategory, color: 'text-slate-300 border-slate-600' },
  { name: 'Apple', url: 'https://appleid.apple.com', category: 'personal' as VaultCategory, color: 'text-slate-200 border-slate-500' },
  { name: 'Microsoft', url: 'https://login.microsoftonline.com', category: 'work' as VaultCategory, color: 'text-amber-400 border-amber-500/30' },
  { name: 'Amazon', url: 'https://amazon.com', category: 'personal' as VaultCategory, color: 'text-orange-400 border-orange-500/30' },
  { name: 'Bank / Finance', url: '', category: 'finance' as VaultCategory, color: 'text-emerald-400 border-emerald-500/30' },
];

export const AddVaultItemModal: React.FC<AddVaultItemModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  credentialCount = 0,
  maxSlots = 10,
  onNavigateToPayment,
  isUnlimited = false,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<VaultItemType>('credential');
  const isSlotLimitReached = !isUnlimited && credentialCount >= maxSlots;
  const [title, setTitle] = useState('');
  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<VaultCategory>('social');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);

  // Image attachment state (max 200MB)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setService(preset.name);
    setTitle(`${preset.name} Account`);
    setCategory(preset.category);
    setType('credential');
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { text: 'Weak', color: 'bg-rose-500 text-rose-400', width: '30%' };
    if (score <= 4) return { text: 'Good', color: 'bg-amber-500 text-amber-400', width: '70%' };
    return { text: 'Strong', color: 'bg-emerald-500 text-emerald-400', width: '100%' };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSlotLimitReached) {
      setError(`All ${maxSlots} vault item slots are in use. Please upgrade for more slots.`);
      return;
    }
    if (!title.trim()) {
      setError('Title or name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let uploadedImageInfo: { url: string; name: string; size: number; type: string } | undefined;

      if (imageFile && user) {
        const tempId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        uploadedImageInfo = await uploadVaultImage(user.uid, tempId, imageFile, (progress) => {
          setUploadProgress(progress);
        });
      }

      await onAdd({
        type,
        title: title.trim(),
        service: service.trim() || undefined,
        username: username.trim() || undefined,
        password: password || undefined,
        category,
        notes: notes.trim() || undefined,
        imageUrl: uploadedImageInfo?.url,
        imageName: uploadedImageInfo?.name,
        imageSize: uploadedImageInfo?.size,
        imageType: uploadedImageInfo?.type,
        favorite,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl w-full max-w-xl p-4 sm:p-6 shadow-2xl shadow-cyan-950/30 relative max-h-[90dvh] overflow-y-auto tech-corners"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-950/70 border border-indigo-800/60 rounded-xl text-indigo-400">
              {type === 'credential' ? <KeyRound className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {type === 'credential' ? 'Add New Credential' : 'Save Personal Document'}
              </h3>
              <p className="text-xs text-slate-400">
                Encrypted & isolated in your private Firestore partition
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

        {/* Item Type Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => setType('credential')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              type === 'credential'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Login Credentials</span>
          </button>
          <button
            type="button"
            onClick={() => setType('document')}
            className={`flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              type === 'document'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Personal Document</span>
          </button>
        </div>

        {/* Slot Limit Warning Banner */}
        {isSlotLimitReached && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/70 border border-rose-500/50 shadow-lg text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-bold text-white tracking-wide">
                  VAULT ITEM SLOT LIMIT REACHED ({credentialCount}/{maxSlots})
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  You have filled all <strong>{maxSlots} vault item slots</strong>. Each credential or document uses one slot. Upgrade with plans starting at <strong>₦2,000 Naira</strong> to allot <strong>extra slots (up to unlimited)</strong>.
                </p>
                {onNavigateToPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToPayment();
                    }}
                    className="mt-2.5 inline-flex items-center space-x-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs px-3.5 py-1.5 rounded-lg shadow-md cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>View Naira Upgrade Plans (from ₦2,000)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fast presets for credentials */}
        {type === 'credential' && (
          <div className="mb-4">
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
              Quick Presets (Google, Facebook, etc.):
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => handleSelectPreset(p)}
                  className={`text-xs px-2.5 py-1 rounded-lg border bg-slate-950 hover:bg-slate-800 transition-all cursor-pointer flex items-center space-x-1 ${p.color}`}
                >
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {type === 'credential' ? 'Account Label / Service' : 'Document Title'} <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'credential' ? 'e.g. Google Login, Facebook Main' : 'e.g. Passport Details, Backup Codes'}
              maxLength={200}
              required
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {/* Credential specific fields: Username & Password */}
          {type === 'credential' && (
            <>
              {/* Username / Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="name@gmail.com or username"
                    maxLength={320}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Platform / Service
                  </label>
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="Google, Facebook, AWS..."
                    maxLength={100}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              {/* Password with Generator */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password / Secret
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    maxLength={500}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-mono text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength indicator */}
                {strength && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} transition-all`} style={{ width: strength.width }} />
                    </div>
                    <span className={`text-[10px] font-medium ${strength.color}`}>{strength.text}</span>
                  </div>
                )}
              </div>

            </>
          )}

          {/* Category & Star grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VaultCategory)}
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
              >
                <option value="social">Social Logins (Google, Facebook)</option>
                <option value="work">Work & Team</option>
                <option value="personal">Personal Accounts</option>
                <option value="finance">Banking & Finance</option>
                <option value="document">Documents & Notes</option>
                <option value="other">Other / Custom</option>
              </select>
            </div>

            <div className="flex items-center gap-2 sm:pt-6">
              <input
                type="checkbox"
                id="vault-favorite"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <label htmlFor="vault-favorite" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />
                Pin / Mark as Favorite
              </label>
            </div>
          </div>

          {/* Personal Document Content / Secret Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {type === 'document' ? 'Confidential Document Content' : 'Security Notes / Recovery Questions'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={5000}
              rows={type === 'document' ? 5 : 2}
              placeholder={
                type === 'document'
                  ? 'Paste confidential passport, tax, contract or seed phrase records here...'
                  : 'Add security questions, 2FA backup codes, PIN...'
              }
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none resize-none"
            />
          </div>

          {/* Image Attachment (Up to 200MB) */}
          <div className="pt-1">
            <ImageUploader
              onFileSelect={(file) => setImageFile(file)}
              uploadProgress={uploadProgress}
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isSlotLimitReached}
              className={`px-5 py-2 text-xs font-medium text-white rounded-xl shadow-md transition-all ${
                isSlotLimitReached
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 cursor-pointer disabled:opacity-50'
              }`}
            >
              {submitting
                ? 'Encrypting & Saving...'
                : isSlotLimitReached
                ? `Slot Limit Full (${maxSlots}/${maxSlots})`
                : 'Save to Vault'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

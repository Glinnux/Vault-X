import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, KeyRound, FileText, Eye, EyeOff, Globe, Tag, Star, AlertCircle } from 'lucide-react';
import { VaultCategory, VaultItem } from '../types/vault';
import { useAuth } from '../context/AuthContext';
import { ImageUploader } from './ImageUploader';
import { resolveVaultFileUrl, uploadVaultImage } from '../services/imageStorageService';

interface EditVaultItemModalProps {
  item: VaultItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, updates: Partial<VaultItem>) => Promise<void>;
}

export const EditVaultItemModal: React.FC<EditVaultItemModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<VaultCategory>('social');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);

  // Image states
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const [imageSize, setImageSize] = useState<number | undefined>(undefined);
  const [imageType, setImageType] = useState<string | undefined>(undefined);
  const [imageIv, setImageIv] = useState<string | undefined>(undefined);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setService(item.service || '');
      setUsername(item.username || '');
      setPassword(item.password || '');
      setUrl(item.url || '');
      setCategory(item.category);
      setNotes(item.notes || '');
      setImageUrl(item.imageUrl);
      setPreviewImageUrl(item.imageUrl);
      if (item.imageUrl?.startsWith('supabase://')) {
        resolveVaultFileUrl(item.imageUrl, item.imageIv, item.imageType).then((url) => setPreviewImageUrl(url)).catch(() => setPreviewImageUrl(undefined));
      }
      setImageName(item.imageName);
      setImageSize(item.imageSize);
      setImageType(item.imageType);
      setImageIv(item.imageIv);
      setImageFile(null);
      setFavorite(Boolean(item.favorite));
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let finalImageUrl = imageUrl;
      let finalImageName = imageName;
      let finalImageSize = imageSize;
      let finalImageType = imageType;
      let finalImageIv = imageIv;

      if (imageFile && user) {
        const uploaded = await uploadVaultImage(user.uid, item.id, imageFile, (p) => setUploadProgress(p));
        finalImageUrl = uploaded.url;
        setPreviewImageUrl(URL.createObjectURL(imageFile));
        finalImageName = uploaded.name;
        finalImageSize = uploaded.size;
        finalImageType = uploaded.type;
        finalImageIv = uploaded.iv;
      }

      await onSave(item.id, {
        title: title.trim(),
        service: service.trim() || undefined,
        username: username.trim() || undefined,
        password: password || undefined,
        url: url.trim() || undefined,
        category,
        notes: notes.trim() || undefined,
        imageUrl: finalImageUrl,
        imageName: finalImageName,
        imageSize: finalImageSize,
        imageType: finalImageType,
        imageIv: finalImageIv,
        favorite,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
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
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-950/70 border border-indigo-800/60 rounded-xl text-indigo-400">
              {item.type === 'credential' ? <KeyRound className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Edit Vault Item</h3>
              <p className="text-xs text-slate-400">Update encrypted records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none"
            />
          </div>

          {item.type === 'credential' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username / Email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={320}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Platform / Service</label>
                  <input
                    type="text"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    maxLength={100}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={500}
                    className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-mono text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  Website URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  maxLength={1024}
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </>
          )}

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
                id="edit-vault-favorite"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <label htmlFor="edit-vault-favorite" className="text-xs text-slate-300 cursor-pointer flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/20" />
                Pin / Mark as Favorite
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {item.type === 'document' ? 'Document Content' : 'Security Notes'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={5000}
              rows={4}
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none resize-none"
            />
          </div>

          {/* Image Attachment (Up to 50MB) */}
          <div className="pt-1">
            <ImageUploader
              currentImageUrl={previewImageUrl}
              currentImageName={imageName}
              uploadProgress={uploadProgress}
              onFileSelect={(f) => {
                setImageFile(f);
                if (!f) {
                  setImageUrl(undefined);
                  setImageName(undefined);
                  setImageSize(undefined);
                  setImageType(undefined);
                }
              }}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

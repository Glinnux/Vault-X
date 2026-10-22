import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, AlertCircle, FileCheck } from 'lucide-react';
import { validateImageFile, formatBytes, MAX_IMAGE_SIZE_BYTES } from '../services/imageStorageService';

interface ImageUploaderProps {
  currentImageUrl?: string;
  currentImageName?: string;
  onFileSelect: (file: File | null) => void;
  uploadProgress?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImageUrl,
  currentImageName,
  onFileSelect,
  uploadProgress,
}) => {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(currentImageName || null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    const validation = validateImageFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid image file.');
      onFileSelect(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    onFileSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setSelectedFileName(null);
    setSelectedFileSize(null);
    setError(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Image Attachment</span>
          <span className="text-[10px] text-slate-500 font-normal">(Max 200MB)</span>
        </label>
        {selectedFileSize && (
          <span className="text-[11px] text-slate-400 font-mono">
            {formatBytes(selectedFileSize)}
          </span>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Drop zone / Preview container */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-3.5 transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/30'
            : preview
            ? 'border-slate-700 bg-slate-950/60'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
          onChange={handleChange}
          className="hidden"
        />

        {preview ? (
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex-shrink-0 relative group flex items-center justify-center">
              {selectedFileName?.toLowerCase().endsWith('.pdf') ? (
                <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/60 p-2 rounded">PDF</span>
              ) : (
                <img
                  src={preview}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5 text-xs text-white font-medium truncate">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{selectedFileName || 'Attached File'}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedFileSize ? `${formatBytes(selectedFileSize)} • ` : ''}Click to change file
              </p>
              {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            <Upload className="w-6 h-6 mx-auto text-slate-500 mb-1" />
            <p className="text-xs text-slate-300 font-medium">
              Click or drag document / image here
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              PDF, Documents, PNG, JPG, WebP up to <strong className="text-slate-400">200MB</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Smartphone, Check, ChevronDown, Sparkles } from 'lucide-react';
import {
  useLanguage,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../context/LanguageContext';

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  compact = false,
  className = '',
}) => {
  const {
    selectedPreference,
    detectedPhoneLanguage,
    currentLanguage,
    isAutoMode,
    setLanguage,
    t,
    currentLangInfo,
  } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const detectedInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === detectedPhoneLanguage) ||
    SUPPORTED_LANGUAGES[0];

  const handleSelect = (lang: 'auto' | SupportedLanguage) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1.5 text-xs font-mono font-medium rounded-xl border transition-all cursor-pointer shadow-sm ${
          isAutoMode
            ? 'bg-slate-900/90 hover:bg-slate-800/90 text-cyan-300 border-cyan-500/40 hover:border-cyan-400'
            : 'bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 border-slate-700 hover:border-slate-600'
        } ${compact ? 'px-2.5 py-1.5' : 'px-3 py-1.5'}`}
        title={`Language: ${currentLangInfo.nativeName} (${isAutoMode ? 'Auto phone language' : 'Manual'})`}
        aria-label="Change Language"
        aria-expanded={isOpen}
      >
        <span className="text-sm">{currentLangInfo.flag}</span>
        {isAutoMode ? (
          <span className="flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-cyan-400 hidden xs:inline" />
            <span className="font-bold">{currentLangInfo.code.toUpperCase()}</span>
            <span className="text-[10px] text-cyan-400/80 hidden sm:inline">(Auto)</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-slate-400 hidden xs:inline" />
            <span className="font-bold">{currentLangInfo.code.toUpperCase()}</span>
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="vault-dropdown-panel absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-2xl z-50 p-2 text-xs tech-corners">
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-white font-bold text-xs">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{t('language_label', 'Language Settings')}</span>
            </div>
            {isAutoMode && (
              <span className="text-[10px] bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Phone Synced</span>
              </span>
            )}
          </div>

          {/* Option 1: Automatic Phone Language */}
          <div className="p-1">
            <button
              onClick={() => handleSelect('auto')}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                isAutoMode
                  ? 'bg-gradient-to-r from-cyan-950/70 to-indigo-950/70 border border-cyan-500/50 text-white'
                  : 'hover:bg-slate-800/70 text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-1.5 rounded-lg border ${
                    isAutoMode
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 group-hover:text-cyan-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>{t('auto_phone_lang', 'Auto (Phone Language)')}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Detected: {detectedInfo.flag} {detectedInfo.nativeName} ({detectedInfo.name})
                  </div>
                </div>
              </div>
              {isAutoMode && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
            </button>
          </div>

          {/* Divider */}
          <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-t border-slate-800/80 mt-1">
            {t('manual_lang_select', 'Manual Language Selection')}
          </div>

          {/* Scrollable Language List */}
          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1 custom-scrollbar">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = !isAutoMode && currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? 'bg-indigo-950/70 border border-indigo-500/50 text-white'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base">{lang.flag}</span>
                    <div>
                      <span className="font-medium text-xs text-white group-hover:text-cyan-300 transition-colors">
                        {lang.nativeName}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                        ({lang.name})
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Real-time phone language sync</span>
            <span className="text-cyan-400">14 Languages</span>
          </div>
        </div>
      )}
    </div>
  );
};

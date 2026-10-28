import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';
import { TERMS_AND_CONDITIONS, TERMS_VERSION } from '../content/terms';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReadComplete: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onReadComplete }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setReachedEnd(false);
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    const checkPosition = () => {
      const atEnd = content.scrollTop + content.clientHeight >= content.scrollHeight - 8;
      setReachedEnd(atEnd);
    };

    checkPosition();
    content.addEventListener('scroll', checkPosition, { passive: true });
    return () => content.removeEventListener('scroll', checkPosition);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="w-full max-w-3xl max-h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-slate-950 text-white shadow-2xl shadow-amber-950/50"
      >
        <header className="flex items-start justify-between gap-4 border-b border-amber-400/30 bg-amber-950/40 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-amber-300/50 bg-amber-400/15 p-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Important: required reading</p>
              <h2 id="terms-title" className="mt-1 text-lg font-bold sm:text-xl">Vault X Terms and Conditions</h2>
              <p className="mt-1 text-xs text-slate-300">Effective date: {TERMS_VERSION}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close terms" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={contentRef} className="max-h-[58dvh] overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-cyan-100">
            <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
            <span>Read to the bottom. The agreement button becomes available only after the terms have been viewed to the end.</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-200">{TERMS_AND_CONDITIONS}</pre>
        </div>

        <footer className="border-t border-amber-400/30 bg-slate-950 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-xs">
            {reachedEnd ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            <span className={reachedEnd ? 'text-emerald-300' : 'text-amber-200'}>
              {reachedEnd ? 'You reached the end of the Terms.' : 'Scroll to the bottom before continuing.'}
            </span>
          </div>
          <button
            type="button"
            disabled={!reachedEnd}
            onClick={() => {
              onReadComplete();
              onClose();
            }}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            I have read the Terms and Conditions
          </button>
        </footer>
      </section>
    </div>
  );
};

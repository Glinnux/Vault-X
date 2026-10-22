import React, { useState } from 'react';
import { Radio, Download, Copy, Check, X, ExternalLink, Sparkles } from 'lucide-react';
import { Task } from '../types/todo';

interface ShareExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export const ShareExportModal: React.FC<ShareExportModalProps> = ({
  isOpen,
  onClose,
  tasks,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMarkdown = () => {
    const lines = [
      `# Vault X Export (${new Date().toLocaleDateString()})`,
      `Total Items: ${tasks.length}`,
      '',
      '## Vault Items',
      ...tasks.map((t) => {
        const meta = [
          t.category ? `category: ${t.category}` : '',
          t.priority ? `priority: ${t.priority}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        return `- **${t.title}** ${meta ? `(${meta})` : ''}`;
      }),
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vault-x-items-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-950/60 border border-sky-800/60 rounded-xl text-sky-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Collaboration & Real-Time Sync</h3>
              <p className="text-xs text-slate-400">Sync across sessions or export your task list</p>
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
          {/* Real-time Multi-Device Sync Card */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-sky-400 font-medium mb-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Two-Way Real-Time Sync</span>
            </div>
            <p className="text-slate-300 leading-relaxed mb-3">
              Vault X uses persistent Firestore WebSockets. Any record added, updated, or deleted in one browser tab or on your phone instantly reflects everywhere you are signed in.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl px-3 py-2 text-[11px] font-mono outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all cursor-pointer whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Export Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Markdown Summary */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-white mb-1">Markdown Report</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
                  Copy formatted markdown checklist to paste in Slack, Docs, or GitHub.
                </p>
              </div>
              <button
                onClick={handleCopyMarkdown}
                className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-medium transition-colors cursor-pointer"
              >
                {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMarkdown ? 'Markdown Copied!' : 'Copy Markdown'}</span>
              </button>
            </div>

            {/* JSON Export */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-white mb-1">Download JSON</h4>
                <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
                  Backup your personal tasks as raw JSON for archiving or import.
                </p>
              </div>
              <button
                onClick={handleExportJson}
                className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON ({tasks.length})</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

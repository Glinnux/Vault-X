import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  Mail,
  Copy,
  Check,
  Lock,
  Sparkles,
  RotateCcw,
  KeyRound,
  FileText,
  ShieldCheck,
  Tag,
  ExternalLink,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  isEmailNotice?: boolean;
}

interface VaultChatbotProps {
  onOpenAddItem?: () => void;
  onOpenSecurity?: () => void;
  isOpenExternal?: boolean;
  onToggleOpen?: (open: boolean) => void;
  vaultSummary?: {
    total: number;
    credentials: number;
    documents: number;
    favorites: number;
    categories: string[];
  };
}

const DEFAULT_SUPPORT_EMAIL = 'oluwolefaith92@gmail.com';
const SUPPORT_EMAIL_LABEL = 'Help';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const QUICK_PROMPTS = [
  {
    icon: KeyRound,
    label: 'How to store a password?',
    query: 'How do I securely store and encrypt passwords in the vault?',
  },
  {
    icon: FileText,
    label: 'How to store documents & notes?',
    query: 'How do I store confidential documents, recovery seeds, and private notes?',
  },
  {
    icon: ShieldCheck,
    label: 'How is my stored data protected?',
    query: 'How does the storage isolation and security work for my vault items?',
  },
  {
    icon: Tag,
    label: 'How to organize with tags & favorites?',
    query: 'How do I organize my stored information with categories, tags, and favorites?',
  },
  {
    icon: Mail,
    label: 'Send complaint or abstract inquiry',
    query: 'I have a complaint or an abstract inquiry. How do I contact the administrator?',
  },
];

export const VaultChatbot: React.FC<VaultChatbotProps> = ({
  onOpenAddItem,
  onOpenSecurity,
  isOpenExternal,
  onToggleOpen,
  vaultSummary,
}) => {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    if (onToggleOpen) {
      onToggleOpen(val);
    }
  };
  const [supportEmail, setSupportEmail] = useState<string>(DEFAULT_SUPPORT_EMAIL);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initial greeting
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your **CyberVault Storage Guide**. I can guide you on how to securely store passwords, confidential documents, and organize your vault items.\n\n*Notice: For any abstract inquiries or complaints, please reach out directly through the **${SUPPORT_EMAIL_LABEL}**.*`,
      timestamp: new Date(),
    },
  ]);

  // Fetch configured support email from server if available
  useEffect(() => {
    fetch('/api/support-info')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.supportEmail) {
          setSupportEmail(data.supportEmail);
        }
      })
      .catch(() => {
        // Fall back to default support email
      });
  }, []);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // If user is NOT signed in, the chatbot is strictly unavailable
  if (!user) {
    return null;
  }

  const handleCopyEmail = (emailToCopy: string) => {
    navigator.clipboard.writeText(emailToCopy);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const gmailHelpUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent('Vault X Help Request')}`;

  const handleSendMessage = async (userPromptText?: string) => {
    const textToSend = (userPromptText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!userPromptText) {
      setInputMessage('');
    }
    setIsLoading(true);

    // Greetings should be instant and should never trigger the long AI request.
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!?,.\s]*$/i.test(textToSend)) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'Hello! How can I help you use Vault X today?',
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      // Build history payload
      const history = messages.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text,
      }));

      const idToken = await auth.currentUser?.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          message: textToSend,
          history,
          vaultSummary,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const replyText = data.reply || 'Guidance received.';
      const activeEmail = data.supportEmail || supportEmail;
      const displayReplyText = activeEmail
        ? replyText.split(activeEmail).join(SUPPORT_EMAIL_LABEL)
        : replyText;
      if (data.supportEmail) {
        setSupportEmail(data.supportEmail);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: displayReplyText,
        timestamp: new Date(),
        isEmailNotice:
          replyText.includes(activeEmail) ||
          replyText.toLowerCase().includes('complaint') ||
          replyText.toLowerCase().includes('abstract'),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      // Fallback response with administrator contact email
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: `I encountered a network issue communicating with the server.\n\nFor any abstract questions, assistance, or complaints, please contact the administrator through the **${SUPPORT_EMAIL_LABEL}**.`,
          timestamp: new Date(),
          isEmailNotice: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: 'assistant',
        text: `Chat reset. How can I guide you with your vault information storage today?\n\n*Reminder: Any abstract inquiries or complaints should be sent through the **${SUPPORT_EMAIL_LABEL}**.*`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-50 font-sans">
      <AnimatePresence>
        {!isOpen ? (
          /* Floating Trigger Beacon */
          <motion.button
            key="chat-trigger"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-900/95 p-0 text-slate-100 shadow-xl shadow-cyan-950/60 backdrop-blur-md cursor-pointer transition-all hover:border-cyan-400 hover:bg-slate-800"
            title="Open CyberVault Storage & Security Guide"
          >
            {/* Holographic Pulse */}
            <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>

            <Bot className="h-7 w-7 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          </motion.button>
        ) : (
          /* Chat Window Modal / Panel */
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[calc(100vw-2.5rem)] sm:w-[420px] max-w-[460px] h-[580px] max-h-[85vh] flex flex-col bg-[#0b101c]/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/70 backdrop-blur-xl tech-corners overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-cyan-500/20">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-xs font-semibold tracking-wide text-white uppercase font-mono">
                      CyberVault Storage Guide
                    </h3>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Signed-in User Guidance • Firestore Isolated</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleResetChat}
                  title="Reset conversation"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Minimize Guide"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Support Notice Ribbon */}
            <div className="bg-slate-900/90 border-b border-slate-800 px-3.5 py-1.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <div className="flex items-center space-x-1.5 truncate">
                <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">
                  Complaints / Abstract inquiries:{' '}
                  <a href={gmailHelpUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-300 font-medium hover:underline">{SUPPORT_EMAIL_LABEL}</a>
                </span>
              </div>
              <button
                onClick={() => handleCopyEmail(supportEmail)}
                className="shrink-0 flex items-center space-x-1 text-slate-300 hover:text-white bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700 hover:border-cyan-500/40 transition-colors cursor-pointer"
                title="Copy support email"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[9px] text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-2.5 h-2.5 text-slate-400" />
                    <span className="text-[9px]">Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl p-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-cyan-600/90 text-white rounded-br-xs border border-cyan-400/40'
                        : 'bg-slate-900/90 text-slate-200 rounded-bl-xs border border-slate-800/90 backdrop-blur-sm'
                    }`}
                  >
                    {/* Render message with line breaks and highlights */}
                    <div className="space-y-1.5 leading-relaxed">
                      {msg.text.split('\n').map((line, idx) => {
                        if (!line.trim()) return <div key={idx} className="h-1.5" />;

                        return (
                          <p
                            key={idx}
                          >
                            {line.split(/\*\*(.*?)\*\*/g).map((part, partIndex) =>
                              partIndex % 2 === 1 ? (
                                <strong key={partIndex} className="text-white font-semibold">
                                  {part}
                                </strong>
                              ) : (
                                <React.Fragment key={partIndex}>{part}</React.Fragment>
                              )
                            )}
                          </p>
                        );
                      })}
                    </div>

                    {/* Interactive Action Card if the message mentions admin email or complaints */}
                    {msg.role === 'assistant' &&
                      (msg.isEmailNotice || msg.text.includes(supportEmail)) && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col space-y-2">
                          <span className="text-[10px] text-cyan-300 font-mono font-medium flex items-center space-x-1">
                            <Info className="w-3 h-3 text-cyan-400" />
                            <span>Administrator Contact Gateway</span>
                          </span>

                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={gmailHelpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Email {SUPPORT_EMAIL_LABEL}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <button
                              onClick={() => handleCopyEmail(supportEmail)}
                              className="inline-flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer"
                            >
                              {copiedEmail ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy Address</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                  </div>

                  <span className="text-[9px] text-slate-500 font-mono mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center space-x-2 text-cyan-400 bg-slate-900/80 border border-cyan-500/20 rounded-xl px-3 py-2 w-fit">
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></span>
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    ></span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Querying Vault Guide...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            {messages.length <= 4 && (
              <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                {QUICK_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      disabled={isLoading}
                      onClick={() => handleSendMessage(prompt.query)}
                      className="shrink-0 flex items-center space-x-1 bg-slate-800/80 hover:bg-slate-700/80 hover:border-cyan-500/40 border border-slate-700/70 rounded-full px-2.5 py-1 text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      <Icon className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-slate-900/90 border-t border-slate-800">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask how to store information or passwords..."
                  disabled={isLoading}
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500 rounded-xl pl-3.5 pr-11 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`absolute right-1.5 p-1.5 rounded-lg transition-all ${
                    inputMessage.trim() && !isLoading
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Send inquiry"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-500 font-mono">
                <span>Vault Info Guide • Gemini AI</span>
                {onOpenAddItem && (
                  <button
                    onClick={onOpenAddItem}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    + Open Add Record Modal
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

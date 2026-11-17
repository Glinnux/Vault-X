import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  X,
  Send,
  Bot,
  Mail,
  Copy,
  Check,
  Lock,
  RotateCcw,
  KeyRound,
  FileText,
  ShieldCheck,
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

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.+?\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key} className="vault-chat-inline-code">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function parseMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function renderChatMarkdown(text: string): React.ReactNode[] {
  // Some model responses escape Markdown punctuation; unescape syntax before parsing it.
  const normalized = text.replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1');
  const lines = normalized.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  const isListItem = (line: string) => /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line);
  const isTableSeparator = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} className="vault-chat-markdown-rule" />);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const Heading = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      blocks.push(
        <Heading key={`heading-${index}`} className="vault-chat-markdown-heading">
          {renderInlineMarkdown(heading[2], `heading-${index}`)}
        </Heading>
      );
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = parseMarkdownTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(parseMarkdownTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="vault-chat-markdown-table-wrap">
          <table className="vault-chat-markdown-table">
            <thead><tr>{headers.map((cell, cellIndex) => (
              <th key={`th-${cellIndex}`}>{renderInlineMarkdown(cell, `th-${index}-${cellIndex}`)}</th>
            ))}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={`tr-${rowIndex}`}>{headers.map((_, cellIndex) => (
                <td key={`td-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] || '', `td-${index}-${rowIndex}-${cellIndex}`)}</td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (isListItem(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && isListItem(lines[index].trim()) === true && /^\d+\./.test(lines[index].trim()) === ordered) {
        items.push(lines[index].trim().replace(/^(?:[-*+]\s+|\d+\.\s+)/, ''));
        index += 1;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={`list-${index}`} className="vault-chat-markdown-list">
          {items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}</li>)}
        </List>
      );
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,6}\s|(?:-{3,}|\*{3,}|_{3,})$)/.test(lines[index].trim()) && !isListItem(lines[index].trim())) {
      if (lines[index].includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) break;
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`} className="vault-chat-markdown-paragraph">{renderInlineMarkdown(paragraph.join(' '), `paragraph-${index}`)}</p>);
  }

  return blocks;
}

const DEFAULT_SUPPORT_EMAIL = 'oluwolefaith92@gmail.com';
const SUPPORT_EMAIL_LABEL = 'Help';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const createWelcomeMessage = (): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  text: `Hello! I am your **Vault-X Support Assistant**. I can guide you on how to securely store passwords, confidential documents, and organize your vault items.\n\n*For account assistance, please reach out through **${SUPPORT_EMAIL_LABEL}**.*`,
  timestamp: new Date(),
});

const QUICK_PROMPTS = [
  {
    icon: KeyRound,
    label: 'How do I add a credential?',
    query: 'How do I add a credential to my Vault-X vault?',
  },
  {
    icon: FileText,
    label: 'How can I upgrade my storage?',
    query: 'How can I upgrade my Vault-X storage subscription?',
  },
  {
    icon: ShieldCheck,
    label: 'How do I protect my vault?',
    query: 'How can I protect my Vault-X vault and account?',
  },
  {
    icon: FileText,
    label: 'How do I use Vault-X?',
    query: 'How do I use the Vault-X vault?',
  },
  {
    icon: Mail,
    label: 'How do I get help?',
    query: 'I need help from the developers please?',
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
  const userId = user?.uid;
  const reducedMotion = useReducedMotion();
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
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [greetingReady, setGreetingReady] = useState(false);
  const [greetingQuestionIndex, setGreetingQuestionIndex] = useState(0);
  const [typedGreeting, setTypedGreeting] = useState('');
  const [greetingShownForUser, setGreetingShownForUser] = useState('');
  const [visibleViewport, setVisibleViewport] = useState<{ height: number; bottomInset: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const greetingRevealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewport = () => {
      setVisibleViewport({
        height: viewport.height,
        bottomInset: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height),
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage()]);

  useEffect(() => {
    setMessages([createWelcomeMessage()]);
    setInputMessage('');
    setGreetingVisible(false);
    setGreetingReady(false);
    setGreetingQuestionIndex(0);
    setTypedGreeting('');
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGreetingVisible(false);
      setGreetingShownForUser('');
      return;
    }

    try {
      if (sessionStorage.getItem(`vaultx-chat-greeting-seen-${userId}`) === '1') {
        setGreetingShownForUser(userId);
      } else {
        setGreetingShownForUser('');
      }
    } catch (error) {
      console.warn('Could not read the chat greeting preference:', error);
      setGreetingShownForUser('');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || isOpen || greetingShownForUser === userId) return;

    const timer = window.setTimeout(() => {
      setGreetingVisible(true);
      try {
        sessionStorage.setItem(`vaultx-chat-greeting-seen-${userId}`, '1');
      } catch (error) {
        console.warn('Could not save the chat greeting preference:', error);
      }
      setGreetingShownForUser(userId);
      greetingRevealTimerRef.current = window.setTimeout(() => {
        setGreetingReady(true);
      }, 1000);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [userId, isOpen, greetingShownForUser]);

  useEffect(() => () => {
    if (greetingRevealTimerRef.current !== null) {
      window.clearTimeout(greetingRevealTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!greetingVisible || !greetingReady || isOpen) return;

    const question = QUICK_PROMPTS[greetingQuestionIndex].label;
    if (reducedMotion) {
      setTypedGreeting(question);
      return;
    }

    let characterIndex = 0;
    setTypedGreeting('');
    let rotateTimer: number | undefined;
    const typeTimer = window.setInterval(() => {
      characterIndex += 1;
      setTypedGreeting(question.slice(0, characterIndex));
      if (characterIndex >= question.length) {
        window.clearInterval(typeTimer);
        rotateTimer = window.setTimeout(
          () => setGreetingQuestionIndex((index) => (index + 1) % QUICK_PROMPTS.length),
          3000
        );
      }
    }, 38);
    return () => {
      window.clearInterval(typeTimer);
      if (rotateTimer !== undefined) window.clearTimeout(rotateTimer);
    };
  }, [greetingVisible, greetingReady, greetingQuestionIndex, isOpen, reducedMotion]);

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

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

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
  const keyboardOpen = Boolean(visibleViewport && visibleViewport.bottomInset > 80);
  const chatWindowStyle = keyboardOpen && visibleViewport
    ? { maxHeight: `${Math.max(180, visibleViewport.height - 32)}px` }
    : undefined;
  const chatContainerStyle = keyboardOpen && visibleViewport
    ? { bottom: `${visibleViewport.bottomInset + 16}px` }
    : undefined;

  const rememberGreetingDismissal = () => {
    if (!user) return;
    setGreetingVisible(false);
    setGreetingShownForUser(user.uid);
    try {
      sessionStorage.setItem(`vaultx-chat-greeting-seen-${user.uid}`, '1');
    } catch (error) {
      console.warn('Could not save the chat greeting preference:', error);
    }
  };

  const openChat = () => {
    rememberGreetingDismissal();
    setIsOpen(true);
  };

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
      if (typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('The chat service returned an empty or invalid response.');
      }
      const replyText = data.reply;
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
    <div className="vault-chatbot-root fixed bottom-6 right-4 z-[60] font-sans" style={chatContainerStyle}>
      <AnimatePresence>
        {!isOpen ? (
          /* Floating Trigger Beacon */
          <React.Fragment key="chat-trigger">
          {greetingVisible && (
            <motion.div
              className="vault-chat-greeting"
              initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
              role="status"
              aria-live="polite"
            >
              <button type="button" className="vault-chat-greeting-open" onClick={openChat} aria-label="Open Vault-X support chat">
                <span className="vault-chat-greeting-title">Hi! Need help managing your Vault-X account?</span>
                {!greetingReady ? (
                  <span className="vault-chat-greeting-dots" aria-label="Suggested question is loading">
                    <i /><i /><i />
                  </span>
                ) : (
                  <>
                    <span className="vault-chat-greeting-caption">A question to get started</span>
                    <span className="vault-chat-greeting-question">
                      {typedGreeting}
                      {!reducedMotion && <span className="vault-chat-caret" aria-hidden="true" />}
                    </span>
                  </>
                )}
              </button>
              <button type="button" className="vault-chat-greeting-close" onClick={rememberGreetingDismissal} aria-label="Dismiss chat greeting">
                <X size={15} />
              </button>
              {greetingReady && (
                <button
                  type="button"
                  className="vault-chat-greeting-send"
                  onClick={() => {
                    const prompt = QUICK_PROMPTS[greetingQuestionIndex];
                    openChat();
                    void handleSendMessage(prompt.query);
                  }}
                  aria-label={`Ask: ${QUICK_PROMPTS[greetingQuestionIndex].label}`}
                >
                  Ask
                </button>
              )}
            </motion.div>
          )}
          <motion.button
            key="chat-launcher"
            initial={reducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reducedMotion ? undefined : { scale: 0.8, opacity: 0 }}
            whileHover={reducedMotion ? undefined : { scale: 1.06 }}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            onClick={openChat}
            className="vault-chat-launcher group relative flex h-14 w-14 items-center justify-center rounded-full p-0 cursor-pointer"
            title="Open Vault-X Support Assistant"
            aria-label="Open Vault-X Support Assistant"
          >
            <span className="vault-chat-launcher-wave" aria-hidden="true" />
            <span className="absolute right-1 top-1 flex h-2.5 w-2.5" aria-hidden="true">
              <span className="vault-chat-launcher-ping absolute inline-flex h-full w-full rounded-full"></span>
              <span className="vault-chat-launcher-status relative inline-flex h-2.5 w-2.5 rounded-full"></span>
            </span>

            <Bot className="h-7 w-7 transition-colors" aria-hidden="true" />
          </motion.button>
          </React.Fragment>
        ) : (
          /* Chat Window Modal / Panel */
          <motion.div
            key="chat-window"
            initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="vault-chat-window w-[calc(100vw-2.5rem)] sm:w-[420px] max-w-[460px] h-[580px] max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={chatWindowStyle}
            role="dialog"
            aria-label="Vault-X Support Assistant"
            aria-modal="false"
          >
            {/* Header */}
            <div className="vault-chat-header flex items-center justify-between px-4 py-3">
              <div className="flex items-center space-x-2.5">
                <div className="vault-chat-avatar w-8 h-8 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h3 className="vault-chat-title text-xs font-semibold tracking-wide uppercase">
                      Vault-X Support Assistant
                    </h3>
                    <span className="vault-chat-online inline-block w-2 h-2 rounded-full"></span>
                  </div>
                  <p className="vault-chat-subtitle text-[10px] flex items-center space-x-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Private support for your signed-in account</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleResetChat}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  className="vault-chat-header-action p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Minimize chat"
                  aria-label="Minimize chat"
                  className="vault-chat-header-action p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Support Notice Ribbon */}
            <div className="vault-chat-support px-3.5 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 truncate">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Account help:{' '}
                  <a href={gmailHelpUrl} target="_blank" rel="noopener noreferrer">{SUPPORT_EMAIL_LABEL}</a>
                </span>
              </div>
              <button
                onClick={() => handleCopyEmail(supportEmail)}
                className="vault-chat-copy-support shrink-0 flex items-center space-x-1 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Copy support email"
                aria-label="Copy support email"
              >
                {copiedEmail ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="vault-chat-messages flex-1 overflow-y-auto p-4 space-y-3.5 text-sm" aria-live="polite">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`vault-chat-message flex flex-col ${msg.role === 'user' ? 'items-end vault-chat-message--user' : 'items-start vault-chat-message--assistant'}`}
                >
                  <div
                    className={`vault-chat-bubble max-w-[88%] rounded-xl p-3 shadow-sm ${msg.role === 'user' ? 'vault-chat-bubble--user' : 'vault-chat-bubble--assistant'}`}
                  >
                    <div className="vault-chat-markdown space-y-2 leading-relaxed">
                      {renderChatMarkdown(msg.text)}
                    </div>

                    {/* Interactive Action Card if the message mentions admin email or complaints */}
                    {msg.role === 'assistant' &&
                      (msg.isEmailNotice || msg.text.includes(supportEmail)) && (
                        <div className="vault-chat-contact mt-3 pt-2.5 flex flex-col space-y-2">
                          <span className="vault-chat-contact-title text-xs font-medium flex items-center space-x-1">
                            <Info className="w-3 h-3" />
                            <span>Support contact</span>
                          </span>

                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={gmailHelpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="vault-chat-contact-link inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Email {SUPPORT_EMAIL_LABEL}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>

                            <button
                              onClick={() => handleCopyEmail(supportEmail)}
                              className="vault-chat-contact-copy inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              {copiedEmail ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Address</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                  </div>

                  <span className="vault-chat-timestamp mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="vault-chat-typing flex items-center space-x-2 rounded-xl px-3 py-2 w-fit" role="status" aria-label="Vault-X assistant is responding">
                  <div className="flex space-x-1">
                    <span className="vault-chat-typing-dot w-1.5 h-1.5 rounded-full"></span>
                    <span
                      className="vault-chat-typing-dot w-1.5 h-1.5 rounded-full"
                      style={{ animationDelay: '0.2s' }}
                    ></span>
                    <span
                      className="vault-chat-typing-dot w-1.5 h-1.5 rounded-full"
                      style={{ animationDelay: '0.4s' }}
                    ></span>
                  </div>
                  <span className="vault-chat-typing-label">
                    Generating response…
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            {messages.length <= 4 && (
              <div className="vault-chat-prompts px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar" aria-label="Suggested questions">
                {QUICK_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      disabled={isLoading}
                      onClick={() => handleSendMessage(prompt.query)}
                      className="vault-chat-prompt shrink-0 flex items-center space-x-1 rounded-full px-2.5 py-1.5 text-xs transition-all cursor-pointer"
                      aria-label={prompt.label}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Input Bar */}
            <div className="vault-chat-input-area p-3">
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Vault-X a question…"
                  disabled={isLoading}
                  className="vault-chat-input w-full rounded-xl pl-3.5 pr-11 py-3 text-sm transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`vault-chat-send absolute right-1.5 p-2 rounded-lg transition-all ${inputMessage.trim() && !isLoading ? 'is-ready' : ''}`}
                  title="Send inquiry"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="vault-chat-footer mt-1.5 flex items-center justify-between px-1">
                <span>Vault-X AI Support</span>
                {onOpenAddItem && (
                  <button
                    onClick={onOpenAddItem}
                    className="vault-chat-footer-link underline cursor-pointer"
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

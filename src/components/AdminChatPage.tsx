import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCheck, MessageCircle, MoreVertical, Plus, Search, Send, Users, X } from 'lucide-react';
import { AdminRecord } from '../types/vault';
import { addPeopleToAdminGroup, AdminChatDirectoryEntry, AdminChatMessage, AdminChatRecord, createAdminChat, fetchAdminChatMessages, fetchAdminChats, leaveAdminGroup, sendAdminChatMessage } from '../services/adminChatService';

interface AdminChatPageProps {
  admins: AdminRecord[];
  currentUser: { uid: string; email?: string | null; displayName?: string | null } | null;
  isSuperAdmin: boolean;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onBackToConsole: () => void;
}

const formatChatTime = (timestamp?: number | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'A';
const avatarColors = ['bg-cyan-700', 'bg-indigo-700', 'bg-emerald-700', 'bg-purple-700', 'bg-rose-700', 'bg-amber-700'];

export const AdminChatPage: React.FC<AdminChatPageProps> = ({ admins, currentUser, isSuperAdmin, onToast, onBackToConsole }) => {
  const [chats, setChats] = useState<AdminChatRecord[]>([]);
  const [chatDirectory, setChatDirectory] = useState<AdminChatDirectoryEntry[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [chatType, setChatType] = useState<'group' | 'dm'>('dm');
  const [groupName, setGroupName] = useState('');
  const [dmTargetId, setDmTargetId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);

  const adminDirectory = useMemo(() => {
    const unique = new Map<string, AdminRecord>();
    admins.forEach((admin) => unique.set(admin.userId, admin));
    chatDirectory.forEach((admin) => unique.set(admin.userId, { userId: admin.userId, email: admin.email, displayName: admin.displayName, role: admin.role === 'superadmin' ? 'superadmin' : 'admin', addedAt: null }));
    if (currentUser && !unique.has(currentUser.uid)) unique.set(currentUser.uid, { userId: currentUser.uid, email: currentUser.email || 'Current admin', displayName: currentUser.displayName || 'Current admin', role: isSuperAdmin ? 'superadmin' : 'admin', addedAt: null });
    return [...unique.values()];
  }, [admins, chatDirectory, currentUser, isSuperAdmin]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const loadChats = async () => {
      try {
        const loaded = await fetchAdminChats();
        if (!active) return;
        setChatDirectory(loaded.directory);
        setChats(loaded.chats);
        // Keep the inbox unselected until the admin explicitly opens a chat.
        // During refreshes, preserve a selection only while that conversation exists.
        setSelectedChatId((current) => current && loaded.chats.some((chat) => chat.id === current) ? current : null);
      } catch (error) {
        console.error('Admin chat listener failed:', error);
        if (active) onToast('Admin chat could not be loaded.', 'error');
      }
    };
    void loadChats();
    const timer = window.setInterval(loadChats, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [currentUser, onToast]);

  useEffect(() => {
    if (!selectedChatId) { setMessages([]); return; }
    let active = true;
    const loadMessages = async () => {
      try {
        const loadedMessages = await fetchAdminChatMessages(selectedChatId);
        if (active) setMessages(loadedMessages);
      } catch (error) {
        console.error('Admin chat messages listener failed:', error);
        if (active) onToast('Messages could not be loaded.', 'error');
      }
    };
    void loadMessages();
    const timer = window.setInterval(loadMessages, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedChatId, onToast]);

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) || null;
  const filteredChats = chats.filter((chat) => {
    const term = searchText.trim().toLowerCase();
    return !term || `${chat.name || ''} ${chat.lastMessagePreview || ''} ${chat.participantEmails?.join(' ') || ''}`.toLowerCase().includes(term);
  });

  const createChat = async () => {
    if (!currentUser || isCreating) return;
    setIsCreating(true);
    try {
      if (chatType === 'group' && !isSuperAdmin) throw new Error('Only the superadmin can create group chats.');
      if (chatType === 'dm' && (!dmTargetId || dmTargetId === currentUser.uid)) throw new Error('Choose another administrator for the DM.');
      const chat = await createAdminChat(chatType, chatType === 'group' ? { groupName: groupName.trim() } : { targetId: dmTargetId });
      setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
      setSelectedChatId(chat.id);
      setShowNewChat(false);
      setGroupName('');
      setDmTargetId('');
      onToast(chatType === 'group' ? 'Group chat created.' : 'Direct message opened.', 'success');
    } catch (error: any) {
      onToast(error?.message || 'Could not create the chat.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !selectedChat || !currentUser) return;
    try {
      const sent = await sendAdminChatMessage(selectedChat.id, text);
      setMessages((current) => [...current, sent]);
      setChats((current) => current.map((chat) => chat.id === selectedChat.id ? { ...chat, lastMessagePreview: text, updatedAt: Date.now() } : chat));
      setMessageText('');
    } catch (error) {
      console.error('Admin message send failed:', error);
      onToast('Message could not be sent.', 'error');
    }
  };

  const leaveGroup = async () => {
    if (!selectedChat || selectedChat.type !== 'group') return;
    try {
      await leaveAdminGroup(selectedChat.id);
      setChats((current) => current.filter((chat) => chat.id !== selectedChat.id));
      setSelectedChatId(null);
      setShowConversationMenu(false);
      onToast('You left the group chat.', 'success');
    } catch (error: any) {
      onToast(error?.message || 'Could not leave the group chat.', 'error');
    }
  };

  const addPeople = async () => {
    if (!selectedChat || selectedChat.type !== 'group' || !isSuperAdmin || selectedPeopleIds.length === 0) return;
    try {
      const updatedChat = await addPeopleToAdminGroup(selectedChat.id, selectedPeopleIds);
      setChats((current) => current.map((chat) => chat.id === updatedChat.id ? updatedChat : chat));
      setShowAddPeople(false);
      setShowConversationMenu(false);
      setSelectedPeopleIds([]);
      onToast('People added to the group.', 'success');
    } catch (error: any) {
      onToast(error?.message || 'Could not add people to the group.', 'error');
    }
  };

  const availablePeopleToAdd = selectedChat?.type === 'group'
    ? adminDirectory.filter((admin) => !selectedChat.participantIds.includes(admin.userId))
    : [];

  const selectedName = selectedChat?.name || (selectedChat?.type === 'group' ? 'Admin Operations Group' : 'Administrator');

  return (
    <section className="admin-chat-page flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#111b20] shadow-2xl shadow-black/30">
      <header className="flex items-center justify-between border-b border-slate-700/70 bg-[#202c33] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBackToConsole} className="rounded-full p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white" title="Back to Admin Console"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white shadow-lg shadow-cyan-950/40"><MessageCircle className="h-5 w-5" /></div>
          <div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">Admin Chat</h2><p className="truncate text-[11px] text-slate-400">Private conversations · Synced to your account</p></div>
        </div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setShowNewChat(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New chat</span></button><button type="button" className="rounded-full p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Admin chat options"><MoreVertical className="h-5 w-5" /></button></div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${selectedChatId ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-slate-700/70 bg-[#111b20]`}>
          <div className="border-b border-slate-700/70 p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search or start new chat" className="w-full rounded-lg bg-[#202c33] py-2.5 pl-10 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500" /></div></div>
          <div className="flex items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500"><span>Conversations</span><span>{chats.length}</span></div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? <div className="px-6 py-12 text-center text-xs text-slate-500">No admin conversations yet.</div> : filteredChats.map((chat, index) => {
              const name = chat.name || (chat.type === 'group' ? 'Admin Operations Group' : 'Administrator');
              return <button key={chat.id} type="button" onClick={() => setSelectedChatId(chat.id)} className={`flex w-full items-center gap-3 border-b border-slate-800/80 px-4 py-3 text-left transition ${selectedChat?.id === chat.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`}><div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${avatarColors[index % avatarColors.length]} text-sm font-bold text-white`}>{chat.type === 'group' ? <Users className="h-5 w-5" /> : initials(name)}<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#111b20] bg-emerald-400" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-100">{name}</span><span className="shrink-0 text-[10px] text-slate-500">{formatChatTime(chat.updatedAt)}</span></div><div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs text-slate-400">{chat.lastMessagePreview || 'No messages yet'}</span>{chat.unreadCount ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-slate-950">{chat.unreadCount}</span> : null}</div></div></button>;
            })}
          </div>
        </aside>

        <main className={`${selectedChatId ? 'flex' : 'hidden lg:flex'} min-h-0 flex-1 flex-col bg-[#0b141a]`}>
          {!selectedChat ? <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-slate-500"><MessageCircle className="mb-4 h-14 w-14 text-slate-700" /><p className="text-sm font-medium text-slate-400">Select an admin conversation</p><p className="mt-1 text-xs">Messages with admins and superadmins will appear here.</p></div> : <>
            <div className="relative flex items-center gap-3 border-b border-slate-700/70 bg-[#202c33] px-4 py-3"><button type="button" onClick={() => setSelectedChatId(null)} className="rounded-full p-1.5 text-slate-300 hover:bg-slate-700 lg:hidden" title="Back to conversations"><ArrowLeft className="h-5 w-5" /></button><div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">{selectedChat.type === 'group' ? <Users className="h-5 w-5" /> : initials(selectedName)}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-white">{selectedName}</h3><p className="truncate text-[10px] text-slate-400">{selectedChat.type === 'group' ? 'Superadmin monitored group' : 'Admin direct message'}</p></div><button type="button" onClick={() => setShowConversationMenu((current) => !current)} className="rounded-full p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Conversation options"><MoreVertical className="h-5 w-5" /></button>{showConversationMenu && selectedChat.type === 'group' && <div className="absolute right-3 top-14 z-20 min-w-44 rounded-xl border border-slate-700 bg-[#202c33] p-1.5 shadow-xl">{isSuperAdmin && <button type="button" onClick={() => { setShowAddPeople(true); setShowConversationMenu(false); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-cyan-200 transition hover:bg-cyan-950/50">Add people</button>}<button type="button" onClick={() => void leaveGroup()} className="w-full rounded-lg px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-950/50">Leave group</button></div>}</div>
            <div className="admin-chat-wallpaper min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:p-6"><div className="mx-auto mb-5 w-fit rounded-lg bg-amber-950/60 px-3 py-1.5 text-center text-[10px] text-amber-200 shadow-sm">Messages are securely stored for the authorized admin accounts in this conversation.</div>{messages.length === 0 && <p className="text-center text-xs text-slate-500">No messages yet. Start the conversation.</p>}{messages.map((message) => { const mine = message.senderId === currentUser?.uid; return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${mine ? 'rounded-tr-none bg-[#005c4b] text-white' : 'rounded-tl-none bg-[#202c33] text-slate-100'}`}><div className="mb-1 text-[10px] font-semibold text-cyan-200">{mine ? 'You' : message.senderName || message.senderEmail || 'Administrator'}</div><div className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.text}</div><div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-slate-300/70">{formatChatTime(message.createdAt)} {mine && <CheckCheck className="h-3 w-3 text-cyan-300" />}</div></div></div>; })}</div>
            <div className="flex items-end gap-2 border-t border-slate-700/70 bg-[#202c33] p-3"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Type a message" maxLength={2000} className="min-w-0 flex-1 rounded-lg bg-[#2a3942] px-4 py-3 text-xs text-white outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-cyan-500" /><button type="button" onClick={() => void sendMessage()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500" title="Send message"><Send className="h-4 w-4" /></button></div>
          </>}
        </main>
      </div>

      {showNewChat && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#202c33] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><strong className="text-sm text-white">Start an admin conversation</strong><button type="button" onClick={() => setShowNewChat(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X className="h-4 w-4" /></button></div><div className="mb-4 flex gap-2"><button type="button" onClick={() => setChatType('dm')} className={`rounded-lg px-3 py-2 text-xs ${chatType === 'dm' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Personal DM</button>{isSuperAdmin && <button type="button" onClick={() => setChatType('group')} className={`rounded-lg px-3 py-2 text-xs ${chatType === 'group' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Users className="mr-1 inline h-3.5 w-3.5" />Group chat</button>}</div>{chatType === 'group' ? <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name (optional)" className="mb-4 w-full rounded-lg bg-[#111b20] px-3 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500" /> : <select value={dmTargetId} onChange={(event) => setDmTargetId(event.target.value)} className="mb-4 w-full rounded-lg bg-[#111b20] px-3 py-3 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"><option value="">Choose an administrator</option>{adminDirectory.filter((admin) => admin.userId !== currentUser?.uid).map((admin) => <option key={admin.userId} value={admin.userId}>{admin.displayName || admin.email} - {admin.email}</option>)}</select>}<button type="button" disabled={isCreating} onClick={() => void createChat()} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">{isCreating ? 'Creating...' : 'Create conversation'}</button></div></div>}
      {showAddPeople && selectedChat?.type === 'group' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#202c33] p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><strong className="text-sm text-white">Add people to {selectedName}</strong><button type="button" onClick={() => { setShowAddPeople(false); setSelectedPeopleIds([]); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><X className="h-4 w-4" /></button></div><p className="mb-3 text-xs text-slate-400">Choose appointed administrators or superadmins to add to this group.</p><div className="max-h-64 space-y-1 overflow-y-auto">{availablePeopleToAdd.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">Everyone is already in this group.</p> : availablePeopleToAdd.map((admin) => <label key={admin.userId} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800"><input type="checkbox" checked={selectedPeopleIds.includes(admin.userId)} onChange={() => setSelectedPeopleIds((current) => current.includes(admin.userId) ? current.filter((id) => id !== admin.userId) : [...current, admin.userId])} className="h-4 w-4 accent-cyan-500" /><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{admin.displayName || admin.email}</span><span className="block truncate text-[10px] text-slate-400">{admin.email}</span></span></label>)}</div><button type="button" disabled={selectedPeopleIds.length === 0} onClick={() => void addPeople()} className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50">Add selected people</button></div></div>}
    </section>
  );
};

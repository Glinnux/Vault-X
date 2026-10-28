import { auth } from '../lib/firebase';

export interface AdminChatRecord {
  id: string;
  type: 'group' | 'dm';
  name?: string;
  participantIds: string[];
  participantEmails?: string[];
  createdBy: string;
  createdAt?: number | null;
  updatedAt?: number | null;
  lastMessagePreview?: string;
  unreadCount?: number;
}

export interface AdminChatMessage {
  id: string;
  senderId: string;
  senderEmail?: string;
  senderName?: string;
  text: string;
  createdAt?: number | null;
}

export interface AdminChatDirectoryEntry {
  userId: string;
  email: string;
  displayName?: string;
  role?: string;
}

async function request(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Admin chat request failed.');
  return data;
}

export async function fetchAdminChats(): Promise<{ chats: AdminChatRecord[]; directory: AdminChatDirectoryEntry[] }> {
  const data = await request('/api/admin/chats');
  return { chats: data.chats || [], directory: data.directory || [] };
}

export async function createAdminChat(type: 'group' | 'dm', options: { groupName?: string; targetId?: string }) {
  const data = await request('/api/admin/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...options }),
  });
  return data.chat as AdminChatRecord;
}

export async function fetchAdminChatMessages(chatId: string): Promise<AdminChatMessage[]> {
  const data = await request(`/api/admin/chats/${encodeURIComponent(chatId)}/messages`);
  return data.messages || [];
}

export async function sendAdminChatMessage(chatId: string, text: string): Promise<AdminChatMessage> {
  const data = await request(`/api/admin/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return data.message;
}

export async function leaveAdminGroup(chatId: string): Promise<void> {
  await request(`/api/admin/chats/${encodeURIComponent(chatId)}/leave`, { method: 'POST' });
}

export async function addPeopleToAdminGroup(chatId: string, participantIds: string[]): Promise<AdminChatRecord> {
  const data = await request(`/api/admin/chats/${encodeURIComponent(chatId)}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantIds }),
  });
  return data.chat as AdminChatRecord;
}

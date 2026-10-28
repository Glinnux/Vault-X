import { auth } from '../lib/firebase';

export interface RecoveryRequest {
  id: string;
  uid: string;
  currentEmail: string;
  proposedEmail: string;
  requestedAt: number | null;
  expiresAt: number | null;
}

async function authorizedFetch(input: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function fetchRecoveryRequests(): Promise<RecoveryRequest[]> {
  const response = await authorizedFetch('/api/admin/recovery-requests');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load recovery requests.');
  return data.requests || [];
}

export async function decideRecoveryRequest(id: string, approved: boolean): Promise<string> {
  const response = await authorizedFetch(`/api/admin/recovery-requests/${encodeURIComponent(id)}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not update the recovery request.');
  return data.message || 'Recovery request updated.';
}

import { SERVER_URL } from '../constants/game';

export type TicketType = 'question_report' | 'bug' | 'suggestion';
export type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'wont_fix';

export interface Ticket {
  id: number;
  type: TicketType;
  status: TicketStatus;
  message: string;
  context: string | null;
  pseudo: string | null;
  lobby_code: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: number;
  updated_at: number;
}

export interface SubmitTicketPayload {
  type: TicketType;
  message: string;
  context?: string;
  pseudo?: string;
  lobbyCode?: string;
}

const TOKEN_KEY = 'onskone_admin_token';

export const getAdminToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setAdminToken = (token: string): void => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
};
export const clearAdminToken = (): void => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

const apiUrl = (path: string): string => {
  const base = SERVER_URL.replace(/\/$/, '');
  return `${base}/api${path}`;
};

export async function submitTicket(payload: SubmitTicketPayload): Promise<void> {
  const res = await fetch(apiUrl('/tickets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Trop de signalements, réessaie plus tard.');
    throw new Error('Impossible d\'envoyer le signalement.');
  }
}

export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(apiUrl('/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error('Trop de tentatives, réessaie plus tard.');
    throw new Error('Mot de passe incorrect.');
  }
  const data = await res.json();
  return data.token as string;
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Session expirée. Reconnecte-toi.');
  }
  return res;
}

export async function fetchTickets(filters?: { status?: TicketStatus; type?: TicketType }): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  const res = await adminFetch(`/admin/tickets${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Erreur de chargement.');
  const data = await res.json();
  return data.tickets as Ticket[];
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<void> {
  const res = await adminFetch(`/admin/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Erreur de mise à jour.');
}

export async function deleteTicket(id: number): Promise<void> {
  const res = await adminFetch(`/admin/tickets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erreur de suppression.');
}

export async function checkAdminAuth(): Promise<boolean> {
  if (!getAdminToken()) return false;
  try {
    const res = await adminFetch('/admin/me');
    return res.ok;
  } catch {
    return false;
  }
}

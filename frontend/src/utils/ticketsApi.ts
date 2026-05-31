import { SERVER_URL } from '../constants/game';
import type { TicketType } from '../constants/ticketCategories';

export type { TicketType };
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

/**
 * Code d'erreur stable retourné par cette API. L'app publique traduit via
 * `t.apiErrors[code]`. Admin reste FR-only et peut lire le `.message` brut.
 */
export type TicketsApiErrorCode =
  | 'tooManyReports'
  | 'reportFailed'
  | 'tooManyAttempts'
  | 'wrongPassword'
  | 'sessionExpired'
  | 'loadError'
  | 'updateError'
  | 'deleteError';

// Messages FR par défaut : admin reste FR-only et continue à lire `.message`.
const DEFAULT_FR_MESSAGES: Record<TicketsApiErrorCode, string> = {
  tooManyReports: 'Trop de signalements, réessaie plus tard.',
  reportFailed: "Impossible d'envoyer le signalement.",
  tooManyAttempts: 'Trop de tentatives, réessaie plus tard.',
  wrongPassword: 'Mot de passe incorrect.',
  sessionExpired: 'Session expirée. Reconnecte-toi.',
  loadError: 'Erreur de chargement.',
  updateError: 'Erreur de mise à jour.',
  deleteError: 'Erreur de suppression.',
};

export class TicketsApiError extends Error {
  readonly code: TicketsApiErrorCode;
  constructor(code: TicketsApiErrorCode) {
    super(DEFAULT_FR_MESSAGES[code]);
    this.code = code;
  }
}

export async function submitTicket(payload: SubmitTicketPayload): Promise<void> {
  const res = await fetch(apiUrl('/tickets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 429) throw new TicketsApiError('tooManyReports');
    throw new TicketsApiError('reportFailed');
  }
}

export async function adminLogin(password: string): Promise<string> {
  const res = await fetch(apiUrl('/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new TicketsApiError('tooManyAttempts');
    throw new TicketsApiError('wrongPassword');
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
    throw new TicketsApiError('sessionExpired');
  }
  return res;
}

export async function fetchTickets(filters?: { status?: TicketStatus; type?: TicketType }): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  const qs = params.toString();
  const res = await adminFetch(`/admin/tickets${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new TicketsApiError('loadError');
  const data = await res.json();
  return data.tickets as Ticket[];
}

export async function updateTicketStatus(id: number, status: TicketStatus): Promise<void> {
  const res = await adminFetch(`/admin/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new TicketsApiError('updateError');
}

export async function deleteTicket(id: number): Promise<void> {
  const res = await adminFetch(`/admin/tickets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new TicketsApiError('deleteError');
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

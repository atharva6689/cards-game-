import type { AuthUser, LobbyConfig, PublicLobbySnapshot } from '../game/types';

const TOKEN_STORAGE_KEY = 'cf_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredSessionToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<{ user: AuthUser; sessionToken: string } | null> {
  try {
    const res = await apiFetch<{ authenticated?: boolean; user: AuthUser | null; sessionToken: string | null }>(
      '/api/auth/me'
    );
    if (!res.user || !res.sessionToken) return null;
    return { user: res.user, sessionToken: res.sessionToken };
  } catch {
    return null;
  }
}

export async function registerUser(
  displayName: string,
  email: string,
  password: string
): Promise<{ user: AuthUser; sessionToken: string }> {
  const res = await apiFetch<{ user: AuthUser; sessionToken: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName, email, password }),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: AuthUser; sessionToken: string }> {
  const res = await apiFetch<{ user: AuthUser; sessionToken: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function loginWithFirebaseToken(
  idToken: string
): Promise<{ user: AuthUser; sessionToken: string }> {
  const res = await apiFetch<{ user: AuthUser; sessionToken: string }>('/api/auth/firebase', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function loginAsGuest(
  displayName: string
): Promise<{ user: AuthUser; sessionToken: string }> {
  const res = await apiFetch<{ user: AuthUser; sessionToken: string }>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function logoutUser() {
  setStoredSessionToken(null);
  await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export async function createLobby(config: Partial<LobbyConfig>): Promise<PublicLobbySnapshot> {
  const res = await apiFetch<{ lobby: PublicLobbySnapshot }>('/api/lobbies', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  return res.lobby;
}

export async function joinLobbyById(lobbyId: string): Promise<PublicLobbySnapshot> {
  const res = await apiFetch<{ lobby: PublicLobbySnapshot }>(
    `/api/lobbies/${encodeURIComponent(lobbyId.trim().toUpperCase())}/join`,
    { method: 'POST' }
  );
  return res.lobby;
}

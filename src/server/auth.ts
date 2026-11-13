import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthUser } from '../game/types';

interface StoredPasswordUser {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  chips: number;
  gamesPlayed: number;
  wins: number;
  createdAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'session.secret');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret, 'utf8');
  return secret;
}

const SESSION_SECRET = getSessionSecret();

function readUsers(): StoredPasswordUser[] {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredPasswordUser[]) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface SessionPayload {
  uid: string;
  displayName: string;
  email: string;
  provider: 'google' | 'password' | 'guest';
  chips: number;
  gamesPlayed: number;
  wins: number;
  exp: number;
}

export function signSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    provider: user.provider,
    chips: user.chips,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.uid || payload.exp < Date.now()) return null;
    return {
      uid: payload.uid,
      displayName: payload.displayName,
      email: payload.email,
      provider: payload.provider,
      chips: payload.chips ?? 1000,
      gamesPlayed: payload.gamesPlayed ?? 0,
      wins: payload.wins ?? 0,
    };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export function extractAuthUser(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.cf_session) {
    return verifySessionToken(cookies.cf_session);
  }
  return null;
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('cf_session', token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: Boolean(isHttps),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('cf_session', {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: Boolean(isHttps),
    path: '/',
  });
}

export function registerPasswordUser(
  displayName: string,
  email: string,
  password: string
): AuthUser {
  const cleanName = displayName.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 32) {
    throw new Error('Display name must be between 2 and 32 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const users = readUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const { hash, salt } = hashPassword(password);
  const newUser: StoredPasswordUser = {
    uid: `usr_${crypto.randomBytes(8).toString('hex')}`,
    email: cleanEmail,
    displayName: cleanName,
    passwordHash: hash,
    salt,
    chips: 2000,
    gamesPlayed: 0,
    wins: 0,
    createdAt: Date.now(),
  };

  users.push(newUser);
  writeUsers(users);

  return {
    uid: newUser.uid,
    displayName: newUser.displayName,
    email: newUser.email,
    provider: 'password',
    chips: newUser.chips,
    gamesPlayed: newUser.gamesPlayed,
    wins: newUser.wins,
  };
}

export function loginPasswordUser(email: string, password: string): AuthUser {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Email and password are required.');
  }
  const users = readUsers();
  const found = users.find((u) => u.email === cleanEmail);
  if (!found || !verifyPassword(password, found.passwordHash, found.salt)) {
    throw new Error('Invalid email or password.');
  }
  return {
    uid: found.uid,
    displayName: found.displayName,
    email: found.email,
    provider: 'password',
    chips: found.chips,
    gamesPlayed: found.gamesPlayed,
    wins: found.wins,
  };
}

export function createGuestUser(displayName: string): AuthUser {
  const cleanName = displayName.trim();
  if (cleanName.length < 2 || cleanName.length > 32) {
    throw new Error('Nickname must be between 2 and 32 characters.');
  }
  return {
    uid: `gst_${crypto.randomBytes(8).toString('hex')}`,
    displayName: cleanName,
    email: '',
    provider: 'guest',
    chips: 1500,
    gamesPlayed: 0,
    wins: 0,
  };
}

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

let cachedFirebaseProjectId: string | null = null;
function getFirebaseProjectId(): string {
  if (cachedFirebaseProjectId) return cachedFirebaseProjectId;
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
    if (cfg.projectId) {
      cachedFirebaseProjectId = cfg.projectId;
      return cfg.projectId;
    }
  }
  return 'cards-50b44';
}

export async function verifyFirebaseIdToken(idToken: string): Promise<AuthUser> {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid) {
    throw new Error('Invalid Firebase token subject.');
  }

  const name =
    (typeof payload.name === 'string' && payload.name) ||
    (typeof payload.email === 'string' ? payload.email.split('@')[0] : 'Player');
  const email = typeof payload.email === 'string' ? payload.email : '';

  return {
    uid,
    displayName: name.slice(0, 32),
    email,
    provider: 'google',
    chips: 2500,
    gamesPlayed: 0,
    wins: 0,
  };
}

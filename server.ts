import http from 'node:http';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import type { TableGameAction } from './src/game/types';
import {
  clearSessionCookie,
  createGuestUser,
  extractAuthUser,
  loginPasswordUser,
  parseCookies,
  registerPasswordUser,
  setSessionCookie,
  signSessionToken,
  verifyFirebaseIdToken,
  verifySessionToken,
} from './src/server/auth';
import { LobbyManager } from './src/server/lobbyManager';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const lobbyManager = new LobbyManager();

  app.use(express.json({ limit: '1mb' }));

  // Auth routes
  app.get('/api/auth/me', (req, res) => {
    const user = extractAuthUser(req);
    if (!user) {
      return res.json({ authenticated: false, user: null, sessionToken: null });
    }
    const token = signSessionToken(user);
    return res.json({ authenticated: true, user, sessionToken: token });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const { displayName, email, password } = req.body ?? {};
      const user = registerPasswordUser(
        String(displayName ?? ''),
        String(email ?? ''),
        String(password ?? '')
      );
      const token = signSessionToken(user);
      setSessionCookie(req, res, token);
      return res.json({ user, sessionToken: token });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      const user = loginPasswordUser(String(email ?? ''), String(password ?? ''));
      const token = signSessionToken(user);
      setSessionCookie(req, res, token);
      return res.json({ user, sessionToken: token });
    } catch (err) {
      return res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
    }
  });

  app.post('/api/auth/firebase', async (req, res) => {
    try {
      const { idToken } = req.body ?? {};
      if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({ error: 'Missing Firebase ID token' });
      }
      const user = await verifyFirebaseIdToken(idToken);
      const token = signSessionToken(user);
      setSessionCookie(req, res, token);
      return res.json({ user, sessionToken: token });
    } catch (err) {
      return res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid Firebase token' });
    }
  });

  app.post('/api/auth/guest', (req, res) => {
    try {
      const { displayName } = req.body ?? {};
      const user = createGuestUser(String(displayName ?? ''));
      const token = signSessionToken(user);
      setSessionCookie(req, res, token);
      return res.json({ user, sessionToken: token });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid nickname' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    return res.json({ ok: true });
  });

  // Lobby REST routes
  app.post('/api/lobbies', (req, res) => {
    const user = extractAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    try {
      const lobby = lobbyManager.createLobby(user, req.body ?? {});
      return res.json({ lobby });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Could not create lobby' });
    }
  });

  app.post('/api/lobbies/:id/join', (req, res) => {
    const user = extractAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    try {
      const lobby = lobbyManager.joinLobby(req.params.id, user);
      return res.json({ lobby });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Could not join lobby' });
    }
  });

  app.get('/api/lobbies/:id', (req, res) => {
    const user = extractAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const lobby = lobbyManager.getSnapshotForViewer(req.params.id, user.uid);
    if (!lobby) return res.status(404).json({ error: 'Lobby not found' });
    return res.json({ lobby });
  });

  // WebSocket real-time server for multiplayer card tables and live chat
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url ?? '/ws', 'http://localhost');
    const tokenParam = reqUrl.searchParams.get('token');
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = tokenParam || cookies.cf_session || '';
    const user = verifySessionToken(rawToken);

    if (!user) {
      ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized WebSocket session.' }));
      ws.close();
      return;
    }

    let joinedLobbyId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString()) as {
          type: string;
          lobbyId?: string;
          config?: Record<string, unknown>;
          action?: TableGameAction;
          text?: string;
        };

        if (data.type === 'lobby:join' && data.lobbyId) {
          joinedLobbyId = data.lobbyId.toUpperCase();
          lobbyManager.attachSocket(joinedLobbyId, user, ws);
        } else if (data.type === 'lobby:update_config' && joinedLobbyId && data.config) {
          lobbyManager.updateConfig(joinedLobbyId, user.uid, data.config);
        } else if (data.type === 'lobby:start' && joinedLobbyId) {
          lobbyManager.startGame(joinedLobbyId, user.uid);
        } else if (data.type === 'game:action' && joinedLobbyId && data.action) {
          lobbyManager.handleGameAction(joinedLobbyId, user.uid, data.action);
        } else if (data.type === 'game:next_round' && joinedLobbyId) {
          lobbyManager.nextRound(joinedLobbyId, user.uid);
        } else if (data.type === 'lobby:return' && joinedLobbyId) {
          lobbyManager.returnToLobby(joinedLobbyId, user.uid);
        } else if (data.type === 'chat:send' && joinedLobbyId && typeof data.text === 'string') {
          lobbyManager.addChatMessage(joinedLobbyId, user, data.text);
        }
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Action rejected',
          })
        );
      }
    });

    ws.on('close', () => {
      lobbyManager.detachSocket(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Crown & Felt server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  applyBluffAction,
  buildBluffPlayers,
  createBluffRound,
  decideBluffBotAction,
  sanitizeBluffState,
} from '../game/bluffEngine';
import {
  applyPokerAction,
  buildPokerPlayers,
  createPokerHand,
  decidePokerBotAction,
  sanitizePokerState,
} from '../game/pokerEngine';
import {
  applyRummyAction,
  buildRummyPlayers,
  createRummyRound,
  decideRummyBotAction,
  sanitizeRummyState,
} from '../game/rummyEngine';
import {
  applySevensAction,
  buildSevensPlayers,
  createSevensRound,
  decideSevensBotAction,
  sanitizeSevensState,
} from '../game/sevensEngine';
import {
  applyUnoAction,
  buildUnoPlayers,
  createUnoRound,
  decideUnoBotAction,
  sanitizeUnoState,
} from '../game/unoEngine';
import type {
  AuthUser,
  BluffAction,
  ChatMessage,
  GameType,
  LobbyConfig,
  LobbyPlayer,
  PokerAction,
  PublicLobbySnapshot,
  RummyAction,
  SanitizedGameState,
  SevensAction,
  TableGameAction,
  TableGameState,
  UnoAction,
} from '../game/types';

interface LobbyRoom {
  id: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  config: LobbyConfig;
  players: LobbyPlayer[];
  gameState: TableGameState | null;
  messages: ChatMessage[];
  sockets: Map<WebSocket, string>; // ws -> userId
  botTimer: NodeJS.Timeout | null;
  createdAt: number;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VALID_GAMES: GameType[] = ['poker', 'rummy', 'sevens', 'bluff', 'uno'];

function normalizeGameType(val: unknown): GameType {
  return VALID_GAMES.includes(val as GameType) ? (val as GameType) : 'poker';
}

function gameLabel(gt: GameType): string {
  switch (gt) {
    case 'poker':
      return 'Poker';
    case 'rummy':
      return 'Rummy';
    case 'sevens':
      return 'Sevens / Badam Satti';
    case 'bluff':
      return 'Bluff Master';
    case 'uno':
      return 'UNO';
  }
}

function generateLobbyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export class LobbyManager {
  private lobbies = new Map<string, LobbyRoom>();

  private sanitizeGameForViewer(
    gameState: TableGameState | null,
    viewerId: string
  ): SanitizedGameState | null {
    if (!gameState) return null;
    switch (gameState.gameType) {
      case 'poker':
        return sanitizePokerState(gameState, viewerId);
      case 'rummy':
        return sanitizeRummyState(gameState, viewerId);
      case 'sevens':
        return sanitizeSevensState(gameState, viewerId);
      case 'bluff':
        return sanitizeBluffState(gameState, viewerId);
      case 'uno':
        return sanitizeUnoState(gameState, viewerId);
    }
  }

  public getSnapshotForViewer(lobbyId: string, viewerId: string): PublicLobbySnapshot | null {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room) return null;
    return {
      id: room.id,
      hostId: room.hostId,
      status: room.status,
      config: room.config,
      players: room.players,
      gameState: this.sanitizeGameForViewer(room.gameState, viewerId),
      messages: room.messages,
    };
  }

  public createLobby(host: AuthUser, configInput: Partial<LobbyConfig>): PublicLobbySnapshot {
    let id = generateLobbyCode();
    while (this.lobbies.has(id)) {
      id = generateLobbyCode();
    }

    const gameType = normalizeGameType(configInput.gameType);
    const deckCount = Math.max(1, Math.min(4, Math.floor(configInput.deckCount ?? 1)));
    const botCount = Math.max(0, Math.min(9, Math.floor(configInput.botCount ?? 3)));
    const config: LobbyConfig = {
      gameType,
      mode: configInput.mode === 'friends' ? 'friends' : 'solo',
      deckCount,
      botCount,
      startingChips: Math.max(200, Math.min(50000, Math.floor(configInput.startingChips ?? 1000))),
    };

    const room: LobbyRoom = {
      id,
      hostId: host.uid,
      status: 'waiting',
      config,
      players: [
        {
          id: host.uid,
          name: host.displayName,
          isBot: false,
          connected: true,
          isHost: true,
          chips: config.startingChips,
        },
      ],
      gameState: null,
      messages: [
        {
          id: `sys-${Date.now()}`,
          lobbyId: id,
          senderId: 'system',
          senderName: 'Dealer',
          text: `${host.displayName} opened a ${gameLabel(gameType)} room (${deckCount} deck${deckCount > 1 ? 's' : ''}, ${botCount} bot${botCount !== 1 ? 's' : ''}).`,
          timestamp: Date.now(),
        },
      ],
      sockets: new Map(),
      botTimer: null,
      createdAt: Date.now(),
    };

    this.lobbies.set(id, room);

    if (config.mode === 'solo' && config.botCount >= 1) {
      this.startGame(id, host.uid);
    }

    return this.getSnapshotForViewer(id, host.uid)!;
  }

  public joinLobby(lobbyId: string, user: AuthUser): PublicLobbySnapshot {
    const code = lobbyId.trim().toUpperCase();
    const room = this.lobbies.get(code);
    if (!room) {
      throw new Error(`Room "${code}" was not found or has closed.`);
    }

    const existing = room.players.find((p) => p.id === user.uid);
    if (existing) {
      existing.connected = true;
      existing.name = user.displayName;
    } else {
      if (room.status === 'playing') {
        throw new Error('This match is already underway. Wait for the host to return to setup.');
      }
      if (room.players.length >= 10) {
        throw new Error('This room is full (maximum 10 players).');
      }
      room.players.push({
        id: user.uid,
        name: user.displayName,
        isBot: false,
        connected: true,
        isHost: false,
        chips: room.config.startingChips,
      });
      this.appendSystemMessage(room, `${user.displayName} joined the room.`);
    }

    this.broadcastState(room);
    return this.getSnapshotForViewer(code, user.uid)!;
  }

  public attachSocket(lobbyId: string, user: AuthUser, ws: WebSocket) {
    const code = lobbyId.trim().toUpperCase();
    const room = this.lobbies.get(code);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', message: `Room "${code}" not found.` }));
      return;
    }

    const existing = room.players.find((p) => p.id === user.uid);
    if (!existing) {
      if (room.status === 'waiting' && room.players.length < 10) {
        room.players.push({
          id: user.uid,
          name: user.displayName,
          isBot: false,
          connected: true,
          isHost: false,
          chips: room.config.startingChips,
        });
        this.appendSystemMessage(room, `${user.displayName} joined the room.`);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Cannot join active match.' }));
        return;
      }
    } else {
      existing.connected = true;
    }

    room.sockets.set(ws, user.uid);
    this.broadcastState(room);
  }

  public detachSocket(ws: WebSocket) {
    for (const room of this.lobbies.values()) {
      const uid = room.sockets.get(ws);
      if (!uid) continue;
      room.sockets.delete(ws);

      const stillConnected = Array.from(room.sockets.values()).includes(uid);
      if (!stillConnected) {
        const player = room.players.find((p) => p.id === uid);
        if (player) {
          player.connected = false;
          this.broadcastState(room);
        }
      }
    }
  }

  public updateConfig(lobbyId: string, userId: string, partial: Partial<LobbyConfig>) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room) throw new Error('Room not found.');
    if (room.hostId !== userId) throw new Error('Only the host can change table settings.');
    if (room.status !== 'waiting') throw new Error('Cannot change settings while a game is in progress.');

    const maxBots = Math.max(0, 10 - room.players.length);
    room.config = {
      ...room.config,
      gameType: partial.gameType !== undefined ? normalizeGameType(partial.gameType) : room.config.gameType,
      deckCount:
        partial.deckCount !== undefined
          ? Math.max(1, Math.min(4, Math.floor(partial.deckCount)))
          : room.config.deckCount,
      botCount:
        partial.botCount !== undefined
          ? Math.max(0, Math.min(maxBots, Math.floor(partial.botCount)))
          : Math.min(room.config.botCount, maxBots),
      mode: partial.mode ?? room.config.mode,
    };

    this.broadcastState(room);
  }

  public startGame(lobbyId: string, userId: string) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room) throw new Error('Room not found.');
    if (room.hostId !== userId) throw new Error('Only the host can start the game.');

    const maxBots = Math.max(0, 10 - room.players.length);
    const activeBots = Math.min(room.config.botCount, maxBots);
    const totalSeats = room.players.length + activeBots;
    if (totalSeats < 2) {
      throw new Error('At least 2 players are needed. Add a bot or wait for a friend to join.');
    }

    if (room.botTimer) {
      clearTimeout(room.botTimer);
      room.botTimer = null;
    }

    room.status = 'playing';
    switch (room.config.gameType) {
      case 'poker': {
        const players = buildPokerPlayers(room.players, activeBots, room.config.startingChips);
        room.gameState = createPokerHand(players, {
          handNumber: 1,
          deckCount: room.config.deckCount,
          dealerIndex: 0,
        });
        break;
      }
      case 'rummy': {
        const players = buildRummyPlayers(room.players, activeBots);
        room.gameState = createRummyRound(players, {
          roundNumber: 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: 0,
        });
        break;
      }
      case 'sevens': {
        const players = buildSevensPlayers(room.players, activeBots);
        room.gameState = createSevensRound(players, {
          roundNumber: 1,
          deckCount: room.config.deckCount,
        });
        break;
      }
      case 'bluff': {
        const players = buildBluffPlayers(room.players, activeBots);
        room.gameState = createBluffRound(players, {
          roundNumber: 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: 0,
        });
        break;
      }
      case 'uno': {
        const players = buildUnoPlayers(room.players, activeBots);
        room.gameState = createUnoRound(players, {
          roundNumber: 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: 0,
        });
        break;
      }
    }

    this.appendSystemMessage(
      room,
      `${gameLabel(room.config.gameType)} started with ${room.config.deckCount} deck${room.config.deckCount > 1 ? 's' : ''} and ${activeBots} bot${activeBots !== 1 ? 's' : ''}.`
    );
    this.broadcastState(room);
    this.scheduleBotTurnIfNeeded(room);
  }

  public handleGameAction(lobbyId: string, userId: string, action: TableGameAction) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room || !room.gameState) throw new Error('Active game not found.');

    switch (room.gameState.gameType) {
      case 'poker':
        room.gameState = applyPokerAction(room.gameState, userId, action as PokerAction);
        break;
      case 'rummy':
        room.gameState = applyRummyAction(room.gameState, userId, action as RummyAction);
        break;
      case 'sevens':
        room.gameState = applySevensAction(room.gameState, userId, action as SevensAction);
        break;
      case 'bluff':
        room.gameState = applyBluffAction(room.gameState, userId, action as BluffAction);
        break;
      case 'uno':
        room.gameState = applyUnoAction(room.gameState, userId, action as UnoAction);
        break;
    }

    this.broadcastState(room);
    this.scheduleBotTurnIfNeeded(room);
  }

  public nextRound(lobbyId: string, userId: string) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room || !room.gameState) throw new Error('Game not found.');

    const isParticipant = room.players.some((p) => p.id === userId);
    if (!isParticipant) throw new Error('Only seated players can deal the next round.');

    if (room.botTimer) {
      clearTimeout(room.botTimer);
      room.botTimer = null;
    }

    switch (room.gameState.gameType) {
      case 'poker': {
        if (!room.gameState.finished) return;
        room.gameState = createPokerHand(room.gameState.players, {
          handNumber: room.gameState.handNumber + 1,
          deckCount: room.config.deckCount,
          dealerIndex: (room.gameState.dealerIndex + 1) % room.gameState.players.length,
        });
        break;
      }
      case 'rummy': {
        if (room.gameState.phase !== 'ROUND_OVER') return;
        room.gameState = createRummyRound(room.gameState.players, {
          roundNumber: room.gameState.roundNumber + 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: room.gameState.roundNumber % room.gameState.players.length,
        });
        break;
      }
      case 'sevens': {
        if (room.gameState.phase !== 'ROUND_OVER') return;
        room.gameState = createSevensRound(room.gameState.players, {
          roundNumber: room.gameState.roundNumber + 1,
          deckCount: room.config.deckCount,
        });
        break;
      }
      case 'bluff': {
        if (room.gameState.phase !== 'ROUND_OVER') return;
        room.gameState = createBluffRound(room.gameState.players, {
          roundNumber: room.gameState.roundNumber + 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: room.gameState.roundNumber % room.gameState.players.length,
        });
        break;
      }
      case 'uno': {
        if (room.gameState.phase !== 'ROUND_OVER') return;
        room.gameState = createUnoRound(room.gameState.players, {
          roundNumber: room.gameState.roundNumber + 1,
          deckCount: room.config.deckCount,
          startingPlayerIndex: room.gameState.roundNumber % room.gameState.players.length,
        });
        break;
      }
    }

    this.broadcastState(room);
    this.scheduleBotTurnIfNeeded(room);
  }

  public returnToLobby(lobbyId: string, userId: string) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room) throw new Error('Room not found.');
    if (room.hostId !== userId) throw new Error('Only the host can return the table to setup.');
    if (room.botTimer) {
      clearTimeout(room.botTimer);
      room.botTimer = null;
    }
    room.status = 'waiting';
    room.gameState = null;
    this.appendSystemMessage(room, 'Returned to room configuration.');
    this.broadcastState(room);
  }

  public addChatMessage(lobbyId: string, user: AuthUser, rawText: string) {
    const room = this.lobbies.get(lobbyId.toUpperCase());
    if (!room) throw new Error('Room not found.');
    const text = rawText.trim().slice(0, 300);
    if (!text) return;

    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
      lobbyId: room.id,
      senderId: user.uid,
      senderName: user.displayName,
      text,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 150) {
      room.messages = room.messages.slice(-150);
    }

    const payload = JSON.stringify({ type: 'chat:message', message: msg });
    for (const ws of room.sockets.keys()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(payload);
      }
    }
  }

  private appendSystemMessage(room: LobbyRoom, text: string) {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
      lobbyId: room.id,
      senderId: 'system',
      senderName: 'Dealer',
      text,
      timestamp: Date.now(),
    };
    room.messages.push(msg);
    if (room.messages.length > 150) {
      room.messages = room.messages.slice(-150);
    }
  }

  private scheduleBotTurnIfNeeded(room: LobbyRoom) {
    if (room.botTimer) {
      clearTimeout(room.botTimer);
      room.botTimer = null;
    }
    if (!room.gameState) return;

    const gs = room.gameState;
    if (gs.gameType === 'poker') {
      if (gs.finished || gs.activePlayerIndex < 0) return;
      const active = gs.players[gs.activePlayerIndex];
      if (!active || !active.isBot) return;
      room.botTimer = setTimeout(() => {
        if (!room.gameState || room.gameState.gameType !== 'poker' || room.gameState.finished) return;
        const curr = room.gameState.players[room.gameState.activePlayerIndex];
        if (!curr || !curr.isBot) return;
        room.gameState = applyPokerAction(
          room.gameState,
          curr.id,
          decidePokerBotAction(room.gameState, curr.id)
        );
        this.broadcastState(room);
        this.scheduleBotTurnIfNeeded(room);
      }, 650);
      return;
    }

    if (gs.phase === 'ROUND_OVER') return;
    const active = gs.players[gs.activePlayerIndex];
    if (!active || !active.isBot) return;

    room.botTimer = setTimeout(() => {
      if (!room.gameState || room.gameState.gameType === 'poker') return;
      if (room.gameState.phase === 'ROUND_OVER') return;
      const curr = room.gameState.players[room.gameState.activePlayerIndex];
      if (!curr || !curr.isBot) return;

      switch (room.gameState.gameType) {
        case 'rummy':
          room.gameState = applyRummyAction(
            room.gameState,
            curr.id,
            decideRummyBotAction(room.gameState, curr.id)
          );
          break;
        case 'sevens':
          room.gameState = applySevensAction(
            room.gameState,
            curr.id,
            decideSevensBotAction(room.gameState, curr.id)
          );
          break;
        case 'bluff':
          room.gameState = applyBluffAction(
            room.gameState,
            curr.id,
            decideBluffBotAction(room.gameState, curr.id)
          );
          break;
        case 'uno':
          room.gameState = applyUnoAction(
            room.gameState,
            curr.id,
            decideUnoBotAction(room.gameState, curr.id)
          );
          break;
      }

      this.broadcastState(room);
      this.scheduleBotTurnIfNeeded(room);
    }, 620);
  }

  private broadcastState(room: LobbyRoom) {
    for (const [ws, viewerId] of room.sockets.entries()) {
      if (ws.readyState === ws.OPEN) {
        const snapshot = this.getSnapshotForViewer(room.id, viewerId);
        ws.send(JSON.stringify({ type: 'lobby:state', lobby: snapshot }));
      }
    }
  }
}

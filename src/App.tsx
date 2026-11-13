import { useCallback, useEffect, useRef, useState } from 'react';
import { BluffTable } from './components/BluffTable';
import { ChatPanel } from './components/ChatPanel';
import { LobbySetup } from './components/LobbySetup';
import { PokerTable } from './components/PokerTable';
import { RummyTable } from './components/RummyTable';
import { SevensTable } from './components/SevensTable';
import { RulesModal, TablePauseModal, TableTopBar } from './components/TableChrome';
import { TitleScreen } from './components/TitleScreen';
import { UnoTable } from './components/UnoTable';
import { WaitingRoom } from './components/WaitingRoom';
import type {
  AuthUser,
  BluffAction,
  ChatMessage,
  LobbyConfig,
  PokerAction,
  PublicLobbySnapshot,
  RummyAction,
  SanitizedGameState,
  SevensAction,
  UnoAction,
} from './game/types';
import {
  createLobby,
  fetchCurrentUser,
  getStoredSessionToken,
  joinLobbyById,
  loginAsGuest,
} from './utils/api';
import { soundEngine } from './utils/sound';

type ScreenView = 'title' | 'setup' | 'lobby';

function isRoundFinished(gameState: SanitizedGameState | null | undefined): boolean {
  if (!gameState) return false;
  if (gameState.gameType === 'poker') return gameState.finished;
  return gameState.phase === 'ROUND_OVER';
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<ScreenView>('title');
  const [lobby, setLobby] = useState<PublicLobbySnapshot | null>(null);
  const [pendingLobbyCode, setPendingLobbyCode] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  // Sync document.body.dataset.state with Game State Machine
  useEffect(() => {
    if (screen === 'title') {
      document.body.dataset.state = 'title';
    } else if (pauseOpen) {
      document.body.dataset.state = 'paused';
    } else if (isRoundFinished(lobby?.gameState)) {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [screen, pauseOpen, lobby]);

  const handleJoinCode = useCallback(async (code: string) => {
    setWsError(null);
    const joined = await joinLobbyById(code);
    setLobby(joined);
    setPendingLobbyCode(null);
    setScreen('lobby');
    const url = new URL(window.location.href);
    url.searchParams.set('lobby', joined.id);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Boot session + ?lobby=CODE / ?autostart=1 handling
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const urlLobby = params.get('lobby')?.trim().toUpperCase() || null;
      const autostart = params.get('autostart') === '1';

      if (urlLobby) {
        setPendingLobbyCode(urlLobby);
      }

      const existing = await fetchCurrentUser();
      if (cancelled) return;

      if (existing?.user) {
        setUser(existing.user);
        if (urlLobby) {
          try {
            await handleJoinCode(urlLobby);
          } catch (err) {
            setWsError(err instanceof Error ? err.message : 'Unable to join lobby');
          }
        } else if (autostart) {
          try {
            const started = await createLobby({
              gameType: 'sevens',
              mode: 'solo',
              botCount: 3,
              deckCount: 1,
              startingChips: 1000,
            });
            if (!cancelled) {
              setLobby(started);
              setScreen('lobby');
            }
          } catch {
            setScreen('setup');
          }
        }
      } else if (autostart && !urlLobby) {
        try {
          const guestRes = await loginAsGuest('banana');
          if (cancelled) return;
          setUser(guestRes.user);
          const started = await createLobby({
            gameType: 'sevens',
            mode: 'solo',
            botCount: 3,
            deckCount: 1,
            startingChips: 1000,
          });
          if (!cancelled) {
            setLobby(started);
            setScreen('lobby');
          }
        } catch {
          // stay on title
        }
      }

      if (!cancelled) setBooting(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [handleJoinCode]);

  // WebSocket Connection Management for active lobby
  useEffect(() => {
    if (!lobby?.id || !user) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let closedIntentionally = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const token = getStoredSessionToken() ?? '';
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'lobby:join', lobbyId: lobby.id }));
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            lobby?: PublicLobbySnapshot;
            message?: ChatMessage | string;
          };

          if (payload.type === 'lobby:state' && payload.lobby) {
            setLobby((prev) => {
              const next = payload.lobby!;
              if (
                prev?.gameState &&
                next.gameState &&
                isRoundFinished(next.gameState) &&
                !isRoundFinished(prev.gameState)
              ) {
                soundEngine.playVictoryFanfare();
              }
              return next;
            });
          } else if (
            payload.type === 'chat:message' &&
            payload.message &&
            typeof payload.message === 'object'
          ) {
            const incomingMsg = payload.message as ChatMessage;
            setLobby((prev) => {
              if (!prev) return prev;
              if (prev.messages.some((m) => m.id === incomingMsg.id)) return prev;
              return {
                ...prev,
                messages: [...prev.messages, incomingMsg],
              };
            });
            if (incomingMsg.senderId !== user.uid && incomingMsg.senderId !== 'system') {
              soundEngine.playChatPing();
              if (!chatOpenRef.current) {
                setUnreadChat((c) => c + 1);
              }
            }
          } else if (payload.type === 'error' && typeof payload.message === 'string') {
            setWsError(payload.message);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!closedIntentionally) {
          reconnectTimer = setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      closedIntentionally = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [lobby?.id, user]);

  // Global keyboard shortcuts (M mute, Esc pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'm' || e.key === 'M') {
        setMuted(soundEngine.toggleMute());
      } else if (e.key === 'Escape' && screen === 'lobby' && lobby?.status === 'playing') {
        setPauseOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, lobby?.status]);

  const sendWs = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const handleAuthenticated = (authedUser: AuthUser) => {
    setUser(authedUser);
  };

  const handleCreateLobby = async (config: LobbyConfig) => {
    setWsError(null);
    const created = await createLobby(config);
    soundEngine.playCardFlick();
    setLobby(created);
    setUnreadChat(0);
    setPauseOpen(false);
    setScreen('lobby');
    if (config.mode === 'friends') {
      const url = new URL(window.location.href);
      url.searchParams.set('lobby', created.id);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleLeaveLobby = () => {
    setLobby(null);
    setPauseOpen(false);
    setRulesOpen(false);
    setChatOpen(false);
    setUnreadChat(0);
    const url = new URL(window.location.href);
    url.searchParams.delete('lobby');
    window.history.replaceState({}, '', url.toString());
    setScreen('setup');
  };

  const handlePokerAction = (action: PokerAction) => {
    if (action.type === 'raise' || action.type === 'call') {
      soundEngine.playChipClink();
    } else {
      soundEngine.playCardFlick();
    }
    sendWs({ type: 'game:action', action });
  };

  const handleRummyAction = (action: RummyAction) => {
    if (action.type === 'meld' || action.type === 'layoff' || action.type === 'declare') {
      soundEngine.playMeldChime();
    } else {
      soundEngine.playCardFlick();
    }
    sendWs({ type: 'game:action', action });
  };

  const handleSevensAction = (action: SevensAction) => {
    soundEngine.playCardFlick();
    sendWs({ type: 'game:action', action });
  };

  const handleBluffAction = (action: BluffAction) => {
    if (action.type === 'call_bluff') {
      soundEngine.playMeldChime();
    } else {
      soundEngine.playCardFlick();
    }
    sendWs({ type: 'game:action', action });
  };

  const handleUnoAction = (action: UnoAction) => {
    if (action.type === 'call_uno' || action.type === 'catch_uno') {
      soundEngine.playMeldChime();
    } else {
      soundEngine.playCardFlick();
    }
    sendWs({ type: 'game:action', action });
  };

  const handleNextRound = () => {
    soundEngine.playCardFlick();
    sendWs({ type: 'game:next_round' });
  };

  const handleReturnToSetup = () => {
    sendWs({ type: 'lobby:return' });
  };

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09110D] text-sm text-[#9FB0A5]">
        Preparing table...
      </div>
    );
  }

  if (screen === 'title' || !user) {
    return (
      <TitleScreen
        user={user}
        pendingLobbyCode={pendingLobbyCode}
        onAuthenticated={handleAuthenticated}
        onEnterClub={async () => {
          if (pendingLobbyCode) {
            try {
              await handleJoinCode(pendingLobbyCode);
              return;
            } catch {
              // fall through to setup
            }
          }
          setScreen('setup');
        }}
        onJoinLobbyCode={handleJoinCode}
      />
    );
  }

  if (screen === 'setup' || !lobby) {
    return (
      <LobbySetup
        user={user}
        onBack={() => setScreen('title')}
        onCreateLobby={handleCreateLobby}
        onJoinLobby={handleJoinCode}
      />
    );
  }

  if (lobby.status === 'waiting' || !lobby.gameState) {
    return (
      <WaitingRoom
        lobby={lobby}
        currentUser={user}
        error={wsError}
        onUpdateConfig={(partial) => sendWs({ type: 'lobby:update_config', config: partial })}
        onStartGame={() => {
          setWsError(null);
          soundEngine.playCardFlick();
          sendWs({ type: 'lobby:start' });
        }}
        onLeaveLobby={handleLeaveLobby}
        onSendChat={(text) => sendWs({ type: 'chat:send', text })}
      />
    );
  }

  const isHost = lobby.hostId === user.uid;
  const gs = lobby.gameState;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#09110D]">
      <TableTopBar
        lobbyId={lobby.id}
        gameType={lobby.config.gameType}
        deckCount={lobby.config.deckCount}
        unreadChatCount={unreadChat}
        chatOpen={chatOpen}
        muted={muted}
        onToggleChat={() => {
          setChatOpen((prev) => {
            const next = !prev;
            if (next) setUnreadChat(0);
            return next;
          });
        }}
        onToggleMute={() => setMuted(soundEngine.toggleMute())}
        onOpenRules={() => setRulesOpen(true)}
        onOpenMenu={() => setPauseOpen(true)}
      />

      {wsError && (
        <div
          role="alert"
          className="flex items-center justify-between bg-[#C82829] px-4 py-1.5 text-xs font-medium text-white"
        >
          <span>{wsError}</span>
          <button
            type="button"
            onClick={() => setWsError(null)}
            className="underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {gs.gameType === 'poker' && (
          <PokerTable
            state={gs}
            currentUserId={user.uid}
            isHost={isHost}
            onAction={handlePokerAction}
            onNextHand={handleNextRound}
            onReturnToSetup={handleReturnToSetup}
          />
        )}
        {gs.gameType === 'rummy' && (
          <RummyTable
            state={gs}
            currentUserId={user.uid}
            isHost={isHost}
            onAction={handleRummyAction}
            onNextRound={handleNextRound}
            onReturnToSetup={handleReturnToSetup}
          />
        )}
        {gs.gameType === 'sevens' && (
          <SevensTable
            state={gs}
            currentUserId={user.uid}
            isHost={isHost}
            onAction={handleSevensAction}
            onNextRound={handleNextRound}
            onReturnToSetup={handleReturnToSetup}
          />
        )}
        {gs.gameType === 'bluff' && (
          <BluffTable
            state={gs}
            currentUserId={user.uid}
            isHost={isHost}
            onAction={handleBluffAction}
            onNextRound={handleNextRound}
            onReturnToSetup={handleReturnToSetup}
          />
        )}
        {gs.gameType === 'uno' && (
          <UnoTable
            state={gs}
            currentUserId={user.uid}
            isHost={isHost}
            onAction={handleUnoAction}
            onNextRound={handleNextRound}
            onReturnToSetup={handleReturnToSetup}
          />
        )}

        {/* Real-time Chat Panel (Desktop side rail + Mobile overlay drawer) */}
        {chatOpen && (
          <div className="fixed inset-y-0 right-0 top-13 z-40 w-full max-w-xs shadow-2xl lg:static lg:top-0 lg:z-10 lg:w-80">
            <ChatPanel
              messages={lobby.messages}
              currentUserId={user.uid}
              onSendMessage={(text) => sendWs({ type: 'chat:send', text })}
              onClose={() => setChatOpen(false)}
              className="h-full w-full"
            />
          </div>
        )}
      </div>

      {rulesOpen && (
        <RulesModal
          gameType={lobby.config.gameType}
          deckCount={lobby.config.deckCount}
          onClose={() => setRulesOpen(false)}
        />
      )}

      {pauseOpen && (
        <TablePauseModal
          isHost={isHost}
          lobbyId={lobby.id}
          onResume={() => setPauseOpen(false)}
          onReturnToSetup={() => {
            setPauseOpen(false);
            handleReturnToSetup();
          }}
          onLeaveToTitle={handleLeaveLobby}
        />
      )}
    </div>
  );
}

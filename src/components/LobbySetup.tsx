import { ArrowLeft, Bot, Copy, Layers, Play, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { AuthUser, GameType, LobbyConfig, LobbyPlayMode } from '../game/types';

interface LobbySetupProps {
  user: AuthUser;
  onBack: () => void;
  onCreateLobby: (config: LobbyConfig) => Promise<void>;
  onJoinLobby: (code: string) => Promise<void>;
}

const GAME_OPTIONS: {
  id: GameType;
  title: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: 'poker',
    title: "Texas Hold'em",
    badge: '♠ ♥',
    desc: 'No-limit blinds, betting streets & showdown',
  },
  {
    id: 'rummy',
    title: 'Classic Rummy',
    badge: '♦ ♣',
    desc: 'Draw, form sets & runs, lay off & go out',
  },
  {
    id: 'sevens',
    title: 'Sevens / Badam Satti',
    badge: '7♥',
    desc: 'Build suits A–K outward from 7',
  },
  {
    id: 'bluff',
    title: 'Bluff Master',
    badge: '?!',
    desc: 'Play face-down, declare rank or call bluff',
  },
  {
    id: 'uno',
    title: 'UNO',
    badge: '+4',
    desc: 'Match colors, action cards & wilds',
  },
];

export function LobbySetup({
  user,
  onBack,
  onCreateLobby,
  onJoinLobby,
}: LobbySetupProps) {
  const [gameType, setGameType] = useState<GameType>('poker');
  const [mode, setMode] = useState<LobbyPlayMode>('solo');
  const [botCount, setBotCount] = useState<number>(3);
  const [deckCount, setDeckCount] = useState<number>(1);
  const [startingChips, setStartingChips] = useState<number>(1000);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleModeChange = (nextMode: LobbyPlayMode) => {
    setMode(nextMode);
    if (nextMode === 'solo' && botCount < 1) {
      setBotCount(1);
    }
  };

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      await onCreateLobby({
        gameType,
        mode,
        botCount: mode === 'solo' ? Math.max(1, botCount) : botCount,
        deckCount,
        startingChips,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start room.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await onJoinLobby(joinCode.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  const botOptions = mode === 'solo' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <main className="min-h-dvh w-full bg-[#09110D] px-4 py-6 text-[#F5F2EA] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header matching Screenshot 1 (Table Setup) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1D3225] pb-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1D3225] bg-[#0F1C15] text-[#D8E2DC] transition-colors hover:border-[#D4A853]/60"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[#F5F2EA] sm:text-3xl">
                Table Setup
              </h1>
              <p className="text-xs text-[#9AB0A2]">
                {user.displayName} · <span className="font-mono text-[#E5B857]">${user.chips.toLocaleString()}</span> bankroll
              </p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="flex w-full items-center gap-2 sm:w-auto">
            <label htmlFor="setup-join-code" className="sr-only">
              Lobby code
            </label>
            <input
              id="setup-join-code"
              type="text"
              value={joinCode}
              maxLength={12}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Lobby code..."
              className="h-11 flex-1 rounded-xl border border-[#1D3225] bg-[#0F1C15] px-3.5 text-sm text-[#F5F2EA] placeholder:text-[#556B5D] focus:border-[#D4A853] focus:outline-none sm:w-44"
            />
            <button
              type="submit"
              disabled={busy || !joinCode.trim()}
              className="h-11 shrink-0 rounded-xl border border-[#1D3225] bg-[#14241B] px-4 text-sm font-semibold text-[#F5F2EA] transition-colors hover:border-[#D4A853]/60 disabled:opacity-45 whitespace-nowrap"
            >
              Join Lobby
            </button>
          </form>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left column: 5 Games & Play Mode */}
          <section className="space-y-6 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-5 sm:p-6 lg:col-span-7">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#D6DDD8]">
                1. Select Card Game
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {GAME_OPTIONS.map((g) => {
                  const active = gameType === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGameType(g.id)}
                      aria-pressed={active}
                      className={`flex min-h-[82px] flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors ${
                        active
                          ? 'border-[#D4A853]/70 bg-[#15281D] text-[#F5F2EA]'
                          : 'border-[#1D3225] bg-[#0B140F] text-[#B8C6BD] hover:border-[#2E4D3B]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-display text-lg font-bold text-[#F5F2EA]">
                          {g.title}
                        </span>
                        <span
                          className={`font-mono text-xs font-semibold ${
                            active ? 'text-[#E5B857]' : 'text-[#6D8576]'
                          }`}
                          aria-hidden="true"
                        >
                          {g.badge}
                        </span>
                      </div>
                      <span className="mt-1 text-xs leading-snug text-[#8EA396]">{g.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#D6DDD8]">
                2. Play With
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('solo')}
                  aria-pressed={mode === 'solo'}
                  className={`flex min-h-[76px] items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    mode === 'solo'
                      ? 'border-[#D4A853]/70 bg-[#15281D] text-[#F5F2EA]'
                      : 'border-[#1D3225] bg-[#0B140F] text-[#B8C6BD] hover:border-[#2E4D3B]'
                  }`}
                >
                  <Bot className="mt-0.5 h-5 w-5 shrink-0 text-[#E5B857]" />
                  <div>
                    <div className="text-sm font-semibold text-[#F5F2EA]">Instant Solo vs Bots</div>
                    <div className="mt-0.5 text-xs text-[#8EA396]">
                      Deal immediately against AI opponents
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('friends')}
                  aria-pressed={mode === 'friends'}
                  className={`flex min-h-[76px] items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    mode === 'friends'
                      ? 'border-[#D4A853]/70 bg-[#15281D] text-[#F5F2EA]'
                      : 'border-[#1D3225] bg-[#0B140F] text-[#B8C6BD] hover:border-[#2E4D3B]'
                  }`}
                >
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-[#E5B857]" />
                  <div>
                    <div className="text-sm font-semibold text-[#F5F2EA]">Friends Custom Lobby</div>
                    <div className="mt-0.5 text-xs text-[#8EA396]">
                      Get a shareable lobby link + optional bots
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {gameType === 'poker' && (
              <div className="space-y-2.5">
                <h2 className="text-sm font-semibold text-[#D6DDD8]">
                  Starting Stack
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {[500, 1000, 2500].map((chips) => (
                    <button
                      key={chips}
                      type="button"
                      onClick={() => setStartingChips(chips)}
                      aria-pressed={startingChips === chips}
                      className={`min-h-[44px] rounded-xl border font-mono text-sm font-bold tabular-nums transition-colors ${
                        startingChips === chips
                          ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                          : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8] hover:border-[#2E4D3B]'
                      }`}
                    >
                      ${chips.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right column: Bot Count & Deck Count matching Screenshot 1 */}
          <section className="flex flex-col justify-between space-y-6 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-5 sm:p-6 lg:col-span-5">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-[#D6DDD8]">
                    <Bot className="h-4 w-4 text-[#E5B857]" />
                    <span>3. Number of Bots</span>
                  </h2>
                  <span className="font-mono text-xs font-semibold text-[#E5B857] tabular-nums">
                    {botCount} {botCount === 1 ? 'bot' : 'bots'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {botOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setBotCount(n)}
                      aria-label={`${n} bots`}
                      aria-pressed={botCount === n}
                      className={`min-h-[44px] rounded-xl border font-mono text-sm font-bold tabular-nums transition-colors ${
                        botCount === n
                          ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                          : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8] hover:border-[#2E4D3B]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#8EA396]">
                  Choose up to 9 AI opponents (10 players max at your table).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-[#D6DDD8]">
                    <Layers className="h-4 w-4 text-[#E5B857]" />
                    <span>4. Number of Decks</span>
                  </h2>
                  <span className="font-mono text-xs font-semibold text-[#E5B857] tabular-nums">
                    {deckCount * (gameType === 'uno' ? 108 : 52)} cards
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDeckCount(d)}
                      aria-label={`${d} ${d === 1 ? 'deck' : 'decks'}`}
                      aria-pressed={deckCount === d}
                      className={`min-h-[46px] rounded-xl border font-mono text-xs font-bold tabular-nums transition-colors ${
                        deckCount === d
                          ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                          : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8] hover:border-[#2E4D3B]'
                      }`}
                    >
                      {d} {d === 1 ? 'Deck' : 'Decks'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#8EA396]">
                  Multi-deck shoes shuffle {deckCount} complete {gameType === 'uno' ? '108-card' : '52-card'} pack{deckCount > 1 ? 's' : ''} together.
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-[#1D3225] pt-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-[#C82829]/50 bg-[#C82829]/15 px-3.5 py-2 text-xs text-[#FCA5A5]"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={handleCreate}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E5B857] px-5 py-3 text-sm font-bold text-[#111714] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {mode === 'friends' ? (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>{busy ? 'Creating Lobby...' : 'Create Friends Lobby'}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>{busy ? 'Dealing...' : 'Deal & Start Table'}</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

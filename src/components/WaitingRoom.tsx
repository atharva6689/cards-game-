import { ArrowLeft, Bot, Check, Copy, Link2, Play, User } from 'lucide-react';
import { useState } from 'react';
import type { AuthUser, GameType, LobbyConfig, PublicLobbySnapshot } from '../game/types';
import { ChatPanel } from './ChatPanel';

interface WaitingRoomProps {
  lobby: PublicLobbySnapshot;
  currentUser: AuthUser;
  onUpdateConfig: (partial: Partial<LobbyConfig>) => void;
  onStartGame: () => void;
  onLeaveLobby: () => void;
  onSendChat: (text: string) => void;
  error: string | null;
}

const GAMES: { id: GameType; label: string }[] = [
  { id: 'poker', label: 'Poker' },
  { id: 'rummy', label: 'Rummy' },
  { id: 'sevens', label: 'Sevens' },
  { id: 'bluff', label: 'Bluff' },
  { id: 'uno', label: 'UNO' },
];

export function WaitingRoom({
  lobby,
  currentUser,
  onUpdateConfig,
  onStartGame,
  onLeaveLobby,
  onSendChat,
  error,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const isHost = lobby.hostId === currentUser.uid;
  const inviteUrl = `${window.location.origin}/?lobby=${lobby.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // ignore clipboard errors
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxBots = Math.max(0, 10 - lobby.players.length);
  const effectiveBots = Math.min(lobby.config.botCount, maxBots);
  const totalSeats = lobby.players.length + effectiveBots;

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[#09110D] text-[#F5F2EA] lg:flex-row">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1D3225] pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onLeaveLobby}
                aria-label="Leave room"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#1D3225] bg-[#0F1C15] text-[#D8E2DC] hover:border-[#D4A853]/60"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#F5F2EA]">
                  Lobby <span className="font-mono text-[#E5B857]">{lobby.id}</span>
                </h1>
                <p className="text-xs capitalize text-[#9AB0A2]">
                  {lobby.config.gameType} · {lobby.config.deckCount} Deck{lobby.config.deckCount > 1 ? 's' : ''} · {totalSeats} / 10 Seats
                </p>
              </div>
            </div>

            {isHost && (
              <button
                type="button"
                onClick={onStartGame}
                disabled={totalSeats < 2}
                className="flex min-h-[46px] items-center gap-2 rounded-xl bg-[#E5B857] px-5 py-2.5 text-sm font-bold text-[#111714] transition-opacity hover:opacity-95 disabled:opacity-45 whitespace-nowrap"
              >
                <Play className="h-4 w-4" />
                <span>Deal &amp; Start Table</span>
              </button>
            )}
          </div>

          <section className="rounded-2xl border border-[#D4A853]/40 bg-[#0F1C15] p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#F5F2EA]">
              <Link2 className="h-4 w-4 text-[#E5B857]" />
              <span>Custom Lobby Invite Link</span>
            </div>
            <p className="mb-3 text-xs text-[#9AB0A2]">
              Share this link or lobby code <span className="font-mono text-[#E5B857]">{lobby.id}</span> so friends join your table directly.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                aria-label="Custom lobby invite link"
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-[44px] flex-1 rounded-xl border border-[#1D3225] bg-[#09110D] px-3.5 font-mono text-xs text-[#D6DDD8] focus:border-[#D4A853] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#E5B857] px-4 text-xs font-bold text-[#111714] whitespace-nowrap"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
              </button>
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#C82829]/50 bg-[#C82829]/15 px-3.5 py-2.5 text-sm text-[#FCA5A5]"
            >
              {error}
            </p>
          )}

          <section className="space-y-4 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#D6DDD8]">
                Room Configuration
              </h2>
              {!isHost && (
                <span className="text-xs text-[#8EA396]">Host controls rules</span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1.5 text-xs text-[#9AB0A2]">Game</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {GAMES.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => onUpdateConfig({ gameType: g.id })}
                      className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                        lobby.config.gameType === g.id
                          ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                          : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8]'
                      } disabled:opacity-70`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs text-[#9AB0A2]">Decks</div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={!isHost}
                        onClick={() => onUpdateConfig({ deckCount: d })}
                        className={`min-h-[42px] rounded-xl border font-mono text-xs font-bold tabular-nums transition-colors ${
                          lobby.config.deckCount === d
                            ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                            : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8]'
                        } disabled:opacity-70`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-xs text-[#9AB0A2]">Bots ({effectiveBots})</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
                      <button
                        key={b}
                        type="button"
                        disabled={!isHost || b > maxBots}
                        onClick={() => onUpdateConfig({ botCount: b })}
                        className={`min-h-[38px] rounded-lg border font-mono text-xs font-bold tabular-nums transition-colors ${
                          effectiveBots === b
                            ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                            : 'border-[#1D3225] bg-[#0B140F] text-[#D6DDD8]'
                        } disabled:opacity-35`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-[#D6DDD8]">
              Seated Players ({totalSeats} / 10)
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {lobby.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-[#1D3225] bg-[#0B140F] px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-[#E5B857]" />
                    <div>
                      <div className="text-sm font-semibold text-[#F5F2EA]">
                        {p.name} {p.id === currentUser.uid ? '(You)' : ''}
                      </div>
                      <div className="text-xs text-[#8EA396]">
                        {p.isHost ? 'Host' : 'Friend'} · {p.connected ? 'Connected' : 'Reconnecting'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: effectiveBots }).map((_, idx) => (
                <div
                  key={`bot-slot-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#1D3225] bg-[#0B140F]/60 px-3.5 py-2.5"
                >
                  <Bot className="h-4 w-4 text-[#10B981]" />
                  <div>
                    <div className="text-sm font-medium text-[#C5D1CA]">AI Bot #{idx + 1}</div>
                    <div className="text-xs text-[#6E8477]">Automated seat</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ChatPanel
        messages={lobby.messages}
        currentUserId={currentUser.uid}
        onSendMessage={onSendChat}
        className="h-72 w-full border-t border-[#1D3225] lg:h-dvh lg:w-80 lg:border-t-0"
      />
    </main>
  );
}

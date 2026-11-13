import { AlertTriangle, Layers, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import feltBg from '../assets/images/table_felt_surface_1794599266491.jpg';
import { formatRank, RANKS, sortCardsByRank } from '../game/deck';
import type { BluffAction, Rank, SanitizedBluffState } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface BluffTableProps {
  state: SanitizedBluffState;
  currentUserId: string;
  isHost: boolean;
  onAction: (action: BluffAction) => void;
  onNextRound: () => void;
  onReturnToSetup: () => void;
}

export function BluffTable({
  state,
  currentUserId,
  isHost,
  onAction,
  onNextRound,
  onReturnToSetup,
}: BluffTableProps) {
  const [feltError, setFeltError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [declaredRank, setDeclaredRank] = useState<Rank>(14);

  const me = state.players.find((p) => p.id === currentUserId);
  const opponents = state.players.filter((p) => p.id !== currentUserId);
  const activePlayer = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(activePlayer && activePlayer.id === currentUserId && state.phase === 'PLAYING');

  const sortedHand = sortCardsByRank(me?.hand ?? []);

  useEffect(() => {
    const valid = new Set(sortedHand.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [me?.hand]);

  useEffect(() => {
    if (state.claimedRank) {
      setDeclaredRank(state.claimedRank);
    }
  }, [state.claimedRank]);

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const activeClaimRank = state.claimedRank ?? declaredRank;

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[#082215]">
      <div className="pointer-events-none absolute inset-0">
        {!feltError ? (
          <img
            src={feltBg}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFeltError(true)}
            className="h-full w-full object-cover opacity-75"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,#125937_0%,#072315_75%)]" />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(5,12,8,0.82)_100%)]" />
      </div>

      {/* Opponents Strip */}
      <section
        aria-label="Bluff Opponents"
        className="relative z-10 flex flex-wrap items-start justify-center gap-2 px-2.5 pt-2.5 sm:gap-3 sm:px-6 sm:pt-3"
      >
        {opponents.map((opp) => {
          const seatIdx = state.players.findIndex((p) => p.id === opp.id);
          const isTurn = seatIdx === state.activePlayerIndex && state.phase === 'PLAYING';
          return (
            <div
              key={opp.id}
              className={`flex min-w-[122px] max-w-[175px] flex-1 flex-col items-center rounded-xl border px-3 py-2 text-center ${
                isTurn
                  ? 'border-[#D4A853] bg-[#142B1F]/95'
                  : 'border-white/10 bg-[#0B1711]/90'
              } ${opp.passedInCycle ? 'opacity-55' : ''}`}
            >
              <div className="w-full truncate text-xs font-semibold text-[#F5F2EA]">{opp.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
                <span className="text-[#D4A853]">{opp.cardCount} cards</span>
                <span className="text-[#9AA89F]">· {opp.score} W</span>
              </div>
              <div className="mt-1 text-[11px] text-[#B8C6BD]">
                {isTurn ? (
                  <span className="text-[#D4A853]">Thinking...</span>
                ) : (
                  opp.lastAction ?? (opp.isBot ? 'Bot' : 'Player')
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Center Pile & Bluff Challenge Arena */}
      <section
        aria-label="Bluff Center Pile"
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-3 py-2"
      >
        <div className="flex flex-wrap items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-1.5">
            {state.pileCount > 0 ? (
              <PlayingCard faceDown size="md" />
            ) : (
              <div className="flex h-[78px] w-[54px] items-center justify-center rounded-lg border border-dashed border-white/25 bg-black/15 text-xs text-[#90A096] sm:h-[96px] sm:w-[68px]">
                Empty
              </div>
            )}
            <span className="font-mono text-xs font-semibold text-[#EAE4D4] tabular-nums">
              Pile ({state.pileCount})
            </span>
          </div>

          <div className="max-w-xs space-y-1.5 rounded-2xl border border-white/10 bg-[#0B1711]/90 p-4 text-left shadow-lg">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[#9AB0A2]">
              Active Rank Claim
            </div>
            <div className="font-display text-2xl font-bold text-[#E5B857]">
              {state.claimedRank ? `${formatRank(state.claimedRank)}s` : 'Open Lead'}
            </div>
            {state.lastPlay ? (
              <p className="text-xs text-[#C6D4CB]">
                <strong className="text-[#F5F2EA]">{state.lastPlay.playerName}</strong> placed{' '}
                <span className="font-mono font-bold text-[#E5B857]">
                  {state.lastPlay.count} card{state.lastPlay.count > 1 ? 's' : ''}
                </span>{' '}
                claiming {formatRank(state.lastPlay.claimedRank)}s.
              </p>
            ) : (
              <p className="text-xs text-[#9AB0A2]">
                Play 1–4 face-down cards and declare any rank.
              </p>
            )}
          </div>
        </div>

        {/* Last Bluff Call Reveal Banner */}
        {state.lastReveal && (
          <div
            className={`w-full max-w-md rounded-2xl border p-3.5 text-center shadow-lg ${
              state.lastReveal.wasBluff
                ? 'border-[#C82829]/60 bg-[#241010]/95'
                : 'border-[#10B981]/60 bg-[#0F2418]/95'
            }`}
          >
            <div className="font-display text-sm font-bold text-[#F5F2EA]">
              {state.lastReveal.wasBluff
                ? `Bluff Caught! ${state.lastReveal.accusedName} lied!`
                : `Honest Play! ${state.lastReveal.callerName} picked up ${state.lastReveal.cardsPickedUp} cards.`}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              {state.lastReveal.revealedCards.map((c) => (
                <PlayingCard key={c.id} card={c} size="xs" />
              ))}
            </div>
          </div>
        )}

        <p className="max-w-lg truncate text-center text-xs text-[#C6D4CB]">
          {state.actionLog[state.actionLog.length - 1] ?? ''}
        </p>

        {/* Round Over Modal */}
        {state.phase === 'ROUND_OVER' && (
          <div className="w-full max-w-md rounded-2xl border border-[#D4A853]/60 bg-[#0D1912]/95 p-4 text-center shadow-2xl">
            <h3 className="font-display text-xl font-bold text-[#F5F2EA]">
              {state.winnerName} Wins Round #{state.roundNumber}!
            </h3>
            <p className="mt-1 text-xs text-[#9AB0A2]">
              Emptied hand cleanly to claim Bluff Master victory.
            </p>
            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onNextRound}
                className="min-h-[44px] flex-1 rounded-xl bg-[#E5B857] px-4 text-sm font-bold text-[#111714]"
              >
                Deal Next Round
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={onReturnToSetup}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-[#15241B] px-3.5 text-xs font-semibold text-[#F5F2EA]"
                >
                  Setup
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Player Hand & Bluff Actions */}
      <section
        aria-label="Your Bluff Hand and Actions"
        className="relative z-10 border-t border-white/10 bg-[#0A130E]/95 px-2.5 py-2.5 sm:px-5 sm:py-3"
      >
        <div className="mx-auto max-w-5xl space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              {state.phase === 'ROUND_OVER' ? (
                <span className="font-semibold text-[#9BA9A0]">Round complete</span>
              ) : isMyTurn ? (
                <span className="font-semibold text-[#D4A853]">
                  {state.lastPlay
                    ? `Your turn: Play as ${formatRank(activeClaimRank)}s, Pass, or Call Bluff!`
                    : 'Your turn: Pick 1–4 cards & declare a rank'}
                </span>
              ) : (
                <span className="text-[#9BA9A0]">
                  Waiting for {activePlayer?.name ?? 'opponent'}...
                </span>
              )}
            </div>

            {isMyTurn && (
              <div className="flex flex-wrap items-center gap-2">
                {state.lastPlay && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onAction({ type: 'call_bluff' });
                        setSelectedIds([]);
                      }}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#C82829]/60 bg-[#C82829]/25 px-4 text-xs font-bold text-[#FCA5A5] hover:bg-[#C82829]/35"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Call Bluff!</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onAction({ type: 'pass' });
                        setSelectedIds([]);
                      }}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/20 bg-[#182920] px-3.5 text-xs font-semibold text-[#F5F2EA] hover:border-[#D4A853]/60"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      <span>Pass</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => {
                    onAction({
                      type: 'play',
                      cardIds: selectedIds,
                      claimedRank: activeClaimRank,
                    });
                    setSelectedIds([]);
                  }}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#E5B857] px-4 text-xs font-bold text-[#111714] disabled:opacity-35"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>
                    Play {selectedIds.length || ''} as {formatRank(activeClaimRank)}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Rank selector when leading a fresh cycle */}
          {isMyTurn && !state.claimedRank && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#9AB0A2]">
                Declare:
              </span>
              {RANKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDeclaredRank(r)}
                  className={`h-8 min-w-[32px] shrink-0 rounded-lg border font-mono text-xs font-bold ${
                    declaredRank === r
                      ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
                      : 'border-[#1D3225] bg-[#101D16] text-[#D6DDD8]'
                  }`}
                >
                  {formatRank(r)}
                </button>
              ))}
            </div>
          )}

          <div className="felt-scroll flex items-end gap-1.5 overflow-x-auto pb-1 pt-3 sm:flex-wrap sm:justify-center sm:gap-2">
            {sortedHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="sm"
                selected={selectedIds.includes(card.id)}
                onClick={isMyTurn ? () => toggleCard(card.id) : undefined}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

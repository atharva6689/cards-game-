import { useEffect, useState } from 'react';
import feltBg from '../assets/images/table_felt_surface_1794599266491.jpg';
import { evaluatePokerHand } from '../game/pokerEngine';
import type { PokerAction, SanitizedPokerState } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface PokerTableProps {
  state: SanitizedPokerState;
  currentUserId: string;
  isHost: boolean;
  onAction: (action: PokerAction) => void;
  onNextHand: () => void;
  onReturnToSetup: () => void;
}

export function PokerTable({
  state,
  currentUserId,
  isHost,
  onAction,
  onNextHand,
  onReturnToSetup,
}: PokerTableProps) {
  const [feltError, setFeltError] = useState(false);
  const me = state.players.find((p) => p.id === currentUserId);
  const opponents = state.players.filter((p) => p.id !== currentUserId);
  const activePlayer =
    state.activePlayerIndex >= 0 ? state.players[state.activePlayerIndex] : null;
  const isMyTurn = Boolean(activePlayer && activePlayer.id === currentUserId && !state.finished);

  const toCall = me ? Math.max(0, state.currentBet - me.currentBet) : 0;
  const maxTotalBet = me ? me.currentBet + me.chips : 0;
  const minRaiseTotal = me
    ? Math.min(maxTotalBet, state.currentBet + state.minRaise)
    : 0;

  const [raiseAmount, setRaiseAmount] = useState<number>(minRaiseTotal);

  useEffect(() => {
    setRaiseAmount(minRaiseTotal);
  }, [minRaiseTotal, state.handNumber, state.street]);

  const myHandEval =
    me && me.holeCards.length === 2
      ? evaluatePokerHand([...me.holeCards, ...state.communityCards])
      : null;

  const streetLabel: Record<SanitizedPokerState['street'], string> = {
    PREFLOP: 'Pre-Flop',
    FLOP: 'Flop',
    TURN: 'Turn',
    RIVER: 'River',
    SHOWDOWN: 'Showdown',
  };

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[#082215]">
      {/* Table Felt Surface */}
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

      {/* Opponents Row */}
      <section
        aria-label="Opponents"
        className="relative z-10 flex flex-wrap items-start justify-center gap-2 px-2.5 pt-2.5 sm:gap-3 sm:px-6 sm:pt-4"
      >
        {opponents.map((opp) => {
          const seatIdx = state.players.findIndex((p) => p.id === opp.id);
          const isTurn = seatIdx === state.activePlayerIndex && !state.finished;
          const isDealer = seatIdx === state.dealerIndex;
          const isWinner = state.winners.some((w) => w.playerId === opp.id);
          return (
            <div
              key={opp.id}
              className={`flex min-w-[112px] max-w-[168px] flex-1 flex-col items-center rounded-xl border px-2.5 py-2 text-center transition-colors ${
                isWinner
                  ? 'border-[#D4A853] bg-[#213318]/95'
                  : isTurn
                    ? 'border-[#D4A853] bg-[#13291E]/95'
                    : 'border-white/10 bg-[#0B1711]/90'
              } ${opp.folded ? 'opacity-55' : ''}`}
            >
              <div className="flex w-full items-center justify-between gap-1 text-xs">
                <span className="truncate font-semibold text-[#F5F2EA]">
                  {opp.name}
                </span>
                {isDealer && (
                  <span className="shrink-0 rounded bg-[#D4A853] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#111714]">
                    D
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-xs tabular-nums">
                <span className="text-[#D4A853]">${opp.chips.toLocaleString()}</span>
                {opp.currentBet > 0 && (
                  <span className="text-[#A8D5BA]">Bet ${opp.currentBet}</span>
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-center gap-1">
                {opp.holeCards.length > 0
                  ? opp.holeCards.map((c) => (
                      <PlayingCard key={c.id} card={c} size="xs" />
                    ))
                  : Array.from({ length: opp.cardCount }).map((_, idx) => (
                      <PlayingCard key={`back-${opp.id}-${idx}`} faceDown size="xs" />
                    ))}
              </div>

              <div className="mt-1 min-h-[16px] text-[11px] font-medium text-[#B8C6BD]">
                {opp.bestHandName ? (
                  <span className="text-[#E9D195]">{opp.bestHandName}</span>
                ) : isTurn ? (
                  <span className="text-[#D4A853]">Acting...</span>
                ) : (
                  opp.lastAction ?? (opp.isBot ? 'Bot' : 'Player')
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Center Community Cards & Pot */}
      <section
        aria-label="Community Board"
        className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-3 py-2"
      >
        <div className="mb-2.5 flex flex-wrap items-center justify-center gap-3 text-sm">
          <span className="font-mono text-xs uppercase tracking-wider text-[#B6C5BC]">
            {streetLabel[state.street]}
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="font-display text-xl font-bold text-[#D4A853] tabular-nums sm:text-2xl">
            Pot ${state.pot.toLocaleString()}
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="font-mono text-xs text-[#9AB0A2] tabular-nums">
            Hand #{state.handNumber}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
          {Array.from({ length: 5 }).map((_, idx) => {
            const card = state.communityCards[idx];
            if (card) {
              return <PlayingCard key={card.id} card={card} size="md" />;
            }
            return (
              <div
                key={`empty-slot-${idx}`}
                className="h-[78px] w-[54px] rounded-lg border border-dashed border-white/15 bg-black/15 sm:h-[96px] sm:w-[68px]"
              />
            );
          })}
        </div>

        <p className="mt-2.5 max-w-md truncate text-center text-xs text-[#C6D4CB]">
          {state.actionLog[state.actionLog.length - 1] ?? ''}
        </p>

        {/* Showdown Summary Card */}
        {state.finished && state.winners.length > 0 && (
          <div className="mt-3 w-full max-w-md rounded-2xl border border-[#D4A853]/60 bg-[#0D1912]/95 p-4 text-center shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#F5F2EA]">
              {state.winners.map((w) => `${w.playerName} wins $${w.amount}`).join(' · ')}
            </h3>
            <p className="mt-0.5 text-xs text-[#D4A853]">
              {state.winners[0].handName}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onNextHand}
                className="min-h-[44px] flex-1 rounded-lg bg-[#D4A853] px-4 text-sm font-bold text-[#111714] hover:opacity-95"
              >
                Deal Next Hand
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={onReturnToSetup}
                  className="min-h-[44px] rounded-lg border border-white/15 bg-[#15241B] px-3.5 text-xs font-semibold text-[#F5F2EA]"
                >
                  Setup
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Bottom Player Hand & Betting Dock */}
      <section
        aria-label="Your Hand and Actions"
        className="relative z-10 border-t border-white/10 bg-[#0A130E]/95 px-3 py-2.5 sm:px-6 sm:py-3"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Player Cards + Info */}
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <div className="flex items-center gap-1.5">
              {me?.holeCards.map((card) => (
                <PlayingCard key={card.id} card={card} size="sm" />
              ))}
            </div>
            <div className="space-y-0.5 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#F5F2EA]">
                  {me?.name ?? 'You'}
                </span>
                {state.players[state.dealerIndex]?.id === currentUserId && (
                  <span className="rounded bg-[#D4A853] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#111714]">
                    D
                  </span>
                )}
              </div>
              <div className="font-mono text-sm font-semibold text-[#D4A853] tabular-nums">
                ${(me?.chips ?? 0).toLocaleString()}
                {me && me.currentBet > 0 && (
                  <span className="ml-2 text-xs text-[#9CC7AC]">
                    (In: ${me.currentBet})
                  </span>
                )}
              </div>
              <div className="text-xs text-[#A5B4AB]">
                {me?.folded
                  ? 'Folded this hand'
                  : myHandEval && state.communityCards.length >= 3
                    ? myHandEval.name
                    : myHandEval
                      ? 'Private hole cards'
                      : ''}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!state.finished && (
            <div className="flex flex-col gap-2 sm:items-end">
              {isMyTurn ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'fold' })}
                      className="min-h-[44px] rounded-lg border border-[#C82829]/50 bg-[#C82829]/20 px-4 text-sm font-semibold text-[#FCA5A5] hover:bg-[#C82829]/30"
                    >
                      Fold
                    </button>

                    {toCall === 0 ? (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'check' })}
                        className="min-h-[44px] rounded-lg border border-white/20 bg-[#182920] px-5 text-sm font-semibold text-[#F5F2EA] hover:border-[#D4A853]/60"
                      >
                        Check
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'call' })}
                        className="min-h-[44px] rounded-lg border border-[#10B981]/50 bg-[#10B981]/20 px-5 text-sm font-semibold text-[#A7F3D0] tabular-nums hover:bg-[#10B981]/30"
                      >
                        Call ${Math.min(toCall, me?.chips ?? 0)}
                      </button>
                    )}

                    {me && me.chips > toCall && (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'raise', amount: raiseAmount })}
                        className="min-h-[44px] rounded-lg bg-[#D4A853] px-5 text-sm font-bold text-[#111714] tabular-nums hover:opacity-95"
                      >
                        {state.currentBet === 0 ? `Bet $${raiseAmount}` : `Raise to $${raiseAmount}`}
                      </button>
                    )}
                  </div>

                  {me && me.chips > toCall && maxTotalBet > minRaiseTotal && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="range"
                        aria-label="Raise amount"
                        min={minRaiseTotal}
                        max={maxTotalBet}
                        step={10}
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                        className="h-2 w-28 accent-[#D4A853] sm:w-36"
                      />
                      {[
                        { label: 'Min', val: minRaiseTotal },
                        {
                          label: '½ Pot',
                          val: Math.min(
                            maxTotalBet,
                            Math.max(minRaiseTotal, state.currentBet + Math.round((state.pot * 0.5) / 10) * 10)
                          ),
                        },
                        {
                          label: 'Pot',
                          val: Math.min(
                            maxTotalBet,
                            Math.max(minRaiseTotal, state.currentBet + state.pot)
                          ),
                        },
                        { label: 'All-In', val: maxTotalBet },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setRaiseAmount(preset.val)}
                          className="min-h-[34px] rounded border border-white/15 bg-[#122019] px-2.5 text-xs font-medium text-[#D6D0C2] hover:border-[#D4A853]/60 whitespace-nowrap"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-[44px] items-center text-sm font-medium text-[#A4B3AA]">
                  {activePlayer
                    ? `Waiting for ${activePlayer.name}...`
                    : 'Resolving hand...'}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

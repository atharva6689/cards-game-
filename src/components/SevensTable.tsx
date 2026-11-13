import { useState } from 'react';
import feltBg from '../assets/images/table_felt_surface_1794599266491.jpg';
import { formatRank, isRedSuit, sortCardsBySuit, suitSymbol } from '../game/deck';
import {
  getPlayableSevensCards,
  isCardPlayableInSevens,
  sevensRankValue,
} from '../game/sevensEngine';
import type { Rank, SanitizedSevensState, SevensAction, Suit } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface SevensTableProps {
  state: SanitizedSevensState;
  currentUserId: string;
  isHost: boolean;
  onAction: (action: SevensAction) => void;
  onNextRound: () => void;
  onReturnToSetup: () => void;
}

const SUIT_ORDER: Suit[] = ['hearts', 'spades', 'diamonds', 'clubs'];

export function SevensTable({
  state,
  currentUserId,
  isHost,
  onAction,
  onNextRound,
  onReturnToSetup,
}: SevensTableProps) {
  const [feltError, setFeltError] = useState(false);

  const me = state.players.find((p) => p.id === currentUserId);
  const opponents = state.players.filter((p) => p.id !== currentUserId);
  const activePlayer = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(activePlayer && activePlayer.id === currentUserId && state.phase === 'PLAYING');

  const sortedHand = sortCardsBySuit(me?.hand ?? []);
  const playableCards = isMyTurn
    ? getPlayableSevensCards(sortedHand, state.lanes, state.mustPlaySevenHearts, state.deckCount)
    : [];
  const playableIds = new Set(playableCards.map((c) => c.id));

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

      {/* Opponents Strip matching RummyTable & PokerTable */}
      <section
        aria-label="Sevens Opponents"
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
              }`}
            >
              <div className="w-full truncate text-xs font-semibold text-[#F5F2EA]">{opp.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap">
                <span className="text-[#D4A853]">{opp.cardCount} cards</span>
                <span className="text-[#9AA89F]">· {opp.score} pts</span>
              </div>
              <div className="mt-1 text-[11px] text-[#B8C6BD]">
                {isTurn ? (
                  <span className="text-[#D4A853]">Playing...</span>
                ) : (
                  opp.lastAction ?? (opp.isBot ? 'Bot' : 'Player')
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Center 4 Suit Lanes */}
      <section
        aria-label="Suit Lanes Board"
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-2.5 overflow-y-auto px-3 py-2"
      >
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {SUIT_ORDER.map((suit) => {
            const lane = state.lanes[suit];
            const red = isRedSuit(suit);
            const sym = suitSymbol(suit);
            const lowLabel =
              lane.low !== null ? formatRank((lane.low === 1 ? 14 : lane.low) as Rank) : '—';
            const highLabel =
              lane.high !== null ? formatRank((lane.high === 1 ? 14 : lane.high) as Rank) : '—';

            return (
              <div
                key={suit}
                className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-[#0B1711]/85 p-3.5 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg leading-none ${red ? 'text-[#FCA5A5]' : 'text-[#F5F2EA]'}`}>
                      {sym}
                    </span>
                    <span className="font-display text-sm font-bold capitalize text-[#F5F2EA]">
                      {suit}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#9AB0A2] tabular-nums">
                    {lane.low !== null ? `${lowLabel} → 7 → ${highLabel}` : 'Needs 7' + sym}
                  </span>
                </div>

                <div className="felt-scroll flex min-h-[44px] items-center gap-1 overflow-x-auto py-0.5">
                  {lane.cards.length === 0 ? (
                    <span className="text-xs text-[#6E8477]">Empty lane</span>
                  ) : (
                    lane.cards.map((c) => {
                      const val = sevensRankValue(c.rank);
                      return (
                        <span
                          key={c.id}
                          className={`inline-flex h-9 min-w-[32px] shrink-0 items-center justify-center rounded-md border px-1.5 font-mono text-xs font-bold shadow ${
                            val === 7
                              ? 'border-[#D4A853] bg-[#E5B857] text-[#111714]'
                              : red
                                ? 'border-[#E6DEC8] bg-[#FAF7F0] text-[#C82829]'
                                : 'border-[#E6DEC8] bg-[#FAF7F0] text-[#141816]'
                          }`}
                        >
                          {formatRank(c.rank)}
                          {sym}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="max-w-lg truncate text-center text-xs text-[#C6D4CB]">
          {state.actionLog[state.actionLog.length - 1] ?? ''}
        </p>

        {state.phase === 'ROUND_OVER' && state.summary && (
          <div className="w-full max-w-md rounded-2xl border border-[#D4A853]/60 bg-[#0D1912]/95 p-4 shadow-2xl">
            <h3 className="text-center font-display text-xl font-bold text-[#F5F2EA]">
              {state.summary.winnerName} Wins Round #{state.roundNumber}
            </h3>
            <div className="mt-3 space-y-1.5">
              {state.summary.standings.map((row) => (
                <div
                  key={row.playerId}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-[#122119] px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-[#F5F2EA]">{row.playerName}</span>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-[#D4A853]">+{row.roundPoints} pts</span>
                    <span className="text-[#A8B8AE]">Total: {row.totalScore}</span>
                  </div>
                </div>
              ))}
            </div>
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

      {/* Player Hand & Pass Control */}
      <section
        aria-label="Your Sevens Hand"
        className="relative z-10 border-t border-white/10 bg-[#0A130E]/95 px-2.5 py-2.5 sm:px-5 sm:py-3"
      >
        <div className="mx-auto max-w-5xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              {state.phase === 'ROUND_OVER' ? (
                <span className="font-semibold text-[#9BA9A0]">Round complete</span>
              ) : isMyTurn ? (
                <span className="font-semibold text-[#D4A853]">
                  {state.mustPlaySevenHearts
                    ? 'Your turn: Tap 7♥ to open the table'
                    : playableCards.length > 0
                      ? `Your turn: Tap a highlighted card (${playableCards.length} playable)`
                      : 'No legal moves — Pass your turn'}
                </span>
              ) : (
                <span className="text-[#9BA9A0]">
                  Waiting for {activePlayer?.name ?? 'opponent'}...
                </span>
              )}
            </div>

            {isMyTurn && playableCards.length === 0 && (
              <button
                type="button"
                onClick={() => onAction({ type: 'pass' })}
                className="min-h-[40px] rounded-lg bg-[#E5B857] px-4 text-xs font-bold text-[#111714]"
              >
                Pass Turn
              </button>
            )}
          </div>

          <div className="felt-scroll flex items-end gap-1.5 overflow-x-auto pb-1 pt-2 sm:flex-wrap sm:justify-center sm:gap-2">
            {sortedHand.map((card) => {
              const canPlay =
                isMyTurn &&
                playableIds.has(card.id) &&
                isCardPlayableInSevens(
                  card,
                  state.lanes,
                  state.mustPlaySevenHearts,
                  state.deckCount
                );
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="sm"
                  highlighted={canPlay}
                  disabled={!canPlay}
                  onClick={canPlay ? () => onAction({ type: 'play', cardId: card.id }) : undefined}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

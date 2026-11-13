import { ArrowDownToLine, Layers, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import feltBg from '../assets/images/table_felt_surface_1794599266491.jpg';
import { formatRank, sortCardsByRank, sortCardsBySuit, suitSymbol } from '../game/deck';
import {
  canLayOffCard,
  classifyMeld,
  findOptimalMelds,
} from '../game/rummyEngine';
import type { Card, RummyAction, SanitizedRummyState } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface RummyTableProps {
  state: SanitizedRummyState;
  currentUserId: string;
  isHost: boolean;
  onAction: (action: RummyAction) => void;
  onNextRound: () => void;
  onReturnToSetup: () => void;
}

export function RummyTable({
  state,
  currentUserId,
  isHost,
  onAction,
  onNextRound,
  onReturnToSetup,
}: RummyTableProps) {
  const [feltError, setFeltError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'none' | 'rank' | 'suit'>('rank');

  const me = state.players.find((p) => p.id === currentUserId);
  const opponents = state.players.filter((p) => p.id !== currentUserId);
  const activePlayer =
    state.activePlayerIndex >= 0 ? state.players[state.activePlayerIndex] : null;
  const isMyTurn = Boolean(activePlayer && activePlayer.id === currentUserId && state.phase !== 'ROUND_OVER');

  // Keep selectedIds synced to cards still in hand
  useEffect(() => {
    if (!me) return;
    const validSet = new Set(me.hand.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => validSet.has(id)));
  }, [me?.hand]);

  const rawHand = me?.hand ?? [];
  const displayedHand: Card[] =
    sortMode === 'rank'
      ? sortCardsByRank(rawHand)
      : sortMode === 'suit'
        ? sortCardsBySuit(rawHand)
        : rawHand;

  const selectedCards = displayedHand.filter((c) => selectedIds.includes(c.id));
  const selectedMeldType =
    selectedCards.length >= 3 ? classifyMeld(selectedCards, state.deckCount) : null;

  const myOptimal = findOptimalMelds(rawHand, state.deckCount);
  const canDeclare =
    isMyTurn &&
    state.phase === 'MELD_OR_DISCARD' &&
    myOptimal.deadwood.length <= 1;

  const singleSelectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const canDiscardSingle =
    isMyTurn &&
    state.phase === 'MELD_OR_DISCARD' &&
    singleSelectedCard !== null &&
    !(singleSelectedCard.id === state.drawnFromDiscardId && rawHand.length > 1);

  const toggleSelectCard = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const topDiscard = state.discardPile[state.discardPile.length - 1];

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

      {/* Opponents Row */}
      <section
        aria-label="Rummy Opponents"
        className="relative z-10 flex flex-wrap items-start justify-center gap-2 px-2.5 pt-2.5 sm:gap-3 sm:px-6 sm:pt-3"
      >
        {opponents.map((opp) => {
          const seatIdx = state.players.findIndex((p) => p.id === opp.id);
          const isTurn = seatIdx === state.activePlayerIndex && state.phase !== 'ROUND_OVER';
          return (
            <div
              key={opp.id}
              className={`flex min-w-[116px] max-w-[175px] flex-1 flex-col items-center rounded-xl border px-3 py-2 text-center ${
                isTurn
                  ? 'border-[#D4A853] bg-[#142B1F]/95'
                  : 'border-white/10 bg-[#0B1711]/90'
              }`}
            >
              <div className="w-full truncate text-xs font-semibold text-[#F5F2EA]">
                {opp.name}
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] tabular-nums">
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

      {/* Center Draw Deck, Discard Pile & Table Melds */}
      <section
        aria-label="Center Table Piles and Melds"
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-3 py-2"
      >
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {/* Draw Stock Deck */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={!isMyTurn || state.phase !== 'DRAW'}
              onClick={() => onAction({ type: 'draw_stock' })}
              aria-label={`Draw from stock deck (${state.stockCount} cards left)`}
              className={`group relative rounded-xl p-1 transition-transform ${
                isMyTurn && state.phase === 'DRAW'
                  ? 'ring-2 ring-[#D4A853] hover:-translate-y-1 cursor-pointer'
                  : 'opacity-90 cursor-default'
              }`}
            >
              <PlayingCard faceDown size="md" />
              <span className="mt-1 block font-mono text-[11px] font-semibold text-[#EAE4D4] tabular-nums">
                Deck ({state.stockCount})
              </span>
            </button>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={
                !isMyTurn ||
                (state.phase === 'DRAW' && !topDiscard) ||
                (state.phase === 'MELD_OR_DISCARD' && !canDiscardSingle)
              }
              onClick={() => {
                if (state.phase === 'DRAW' && topDiscard) {
                  onAction({ type: 'draw_discard' });
                } else if (state.phase === 'MELD_OR_DISCARD' && singleSelectedCard && canDiscardSingle) {
                  onAction({ type: 'discard', cardId: singleSelectedCard.id });
                  setSelectedIds([]);
                }
              }}
              aria-label={
                state.phase === 'DRAW' && topDiscard
                  ? `Draw top discard ${formatRank(topDiscard.rank)} of ${topDiscard.suit}`
                  : canDiscardSingle && singleSelectedCard
                    ? `Discard ${formatRank(singleSelectedCard.rank)} of ${singleSelectedCard.suit}`
                    : 'Discard pile'
              }
              className={`rounded-xl p-1 transition-transform ${
                (isMyTurn && state.phase === 'DRAW' && topDiscard) || canDiscardSingle
                  ? 'ring-2 ring-[#10B981] hover:-translate-y-1 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              {topDiscard ? (
                <PlayingCard card={topDiscard} size="md" />
              ) : (
                <div className="flex h-[78px] w-[54px] items-center justify-center rounded-lg border border-dashed border-white/25 text-xs text-[#90A096] sm:h-[96px] sm:w-[68px]">
                  Empty
                </div>
              )}
              <span className="mt-1 block font-mono text-[11px] font-semibold text-[#EAE4D4]">
                {canDiscardSingle ? 'Tap to Discard' : `Discard (${state.discardPile.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Table Melds */}
        <div className="w-full max-w-3xl">
          {state.tableMelds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {state.tableMelds.map((meld) => {
                const canLayOff =
                  isMyTurn &&
                  state.phase === 'MELD_OR_DISCARD' &&
                  singleSelectedCard !== null &&
                  canLayOffCard(singleSelectedCard, meld, state.deckCount);

                return (
                  <div
                    key={meld.id}
                    className={`flex items-center gap-1 rounded-xl border p-1.5 ${
                      canLayOff
                        ? 'border-[#10B981] bg-[#10B981]/15'
                        : 'border-white/10 bg-[#0B1711]/75'
                    }`}
                  >
                    {meld.cards.map((c) => (
                      <PlayingCard key={c.id} card={c} size="xs" />
                    ))}
                    {canLayOff && singleSelectedCard && (
                      <button
                        type="button"
                        onClick={() => {
                          onAction({
                            type: 'layoff',
                            cardId: singleSelectedCard.id,
                            meldId: meld.id,
                          });
                          setSelectedIds([]);
                        }}
                        className="ml-1 min-h-[40px] rounded-md bg-[#10B981] px-2.5 text-xs font-bold text-[#09150F]"
                      >
                        + Lay Off
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs text-[#9DB0A4]">
              Melded Sets &amp; Runs appear here. Round #{state.roundNumber} · {state.deckCount} Deck{state.deckCount > 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Round Over Summary */}
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
                    <span className="text-[#D4A853]">+{row.deadwood} dw</span>
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
                className="min-h-[44px] flex-1 rounded-lg bg-[#D4A853] px-4 text-sm font-bold text-[#111714]"
              >
                Deal Next Round
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

      {/* Bottom Player Hand & Controls */}
      <section
        aria-label="Your Rummy Hand and Actions"
        className="relative z-10 border-t border-white/10 bg-[#0A130E]/95 px-2.5 py-2.5 sm:px-5 sm:py-3"
      >
        <div className="mx-auto max-w-5xl space-y-2.5">
          {/* Status + Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`font-semibold ${
                  isMyTurn ? 'text-[#D4A853]' : 'text-[#9BA9A0]'
                }`}
              >
                {state.phase === 'ROUND_OVER'
                  ? 'Round complete'
                  : isMyTurn
                    ? state.phase === 'DRAW'
                      ? 'Your turn: Tap Deck or Discard pile to draw'
                      : 'Your turn: Meld cards or Discard 1 card'
                    : `Waiting for ${activePlayer?.name ?? 'opponent'}...`}
              </span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span className="font-mono text-[#B7C4BC] tabular-nums">
                Deadwood: {myOptimal.deadwoodPoints} pts
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSortMode('rank')}
                className={`min-h-[38px] rounded-md border px-2.5 text-xs font-medium whitespace-nowrap ${
                  sortMode === 'rank'
                    ? 'border-[#D4A853] bg-[#192A20] text-[#D4A853]'
                    : 'border-white/15 bg-[#121D17] text-[#C6CFC9]'
                }`}
              >
                Sort Rank
              </button>
              <button
                type="button"
                onClick={() => setSortMode('suit')}
                className={`min-h-[38px] rounded-md border px-2.5 text-xs font-medium whitespace-nowrap ${
                  sortMode === 'suit'
                    ? 'border-[#D4A853] bg-[#192A20] text-[#D4A853]'
                    : 'border-white/15 bg-[#121D17] text-[#C6CFC9]'
                }`}
              >
                Sort Suit
              </button>

              {isMyTurn && state.phase === 'MELD_OR_DISCARD' && (
                <>
                  <button
                    type="button"
                    disabled={!selectedMeldType}
                    onClick={() => {
                      if (!selectedMeldType) return;
                      onAction({ type: 'meld', cardIds: selectedIds });
                      setSelectedIds([]);
                    }}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#10B981] px-3 text-xs font-bold text-[#09150F] disabled:opacity-35 whitespace-nowrap"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {selectedMeldType ? `Meld ${selectedMeldType.toUpperCase()}` : 'Meld Selected'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!canDiscardSingle}
                    onClick={() => {
                      if (!singleSelectedCard) return;
                      onAction({ type: 'discard', cardId: singleSelectedCard.id });
                      setSelectedIds([]);
                    }}
                    className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 text-xs font-bold text-[#111714] disabled:opacity-35 whitespace-nowrap"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    <span>
                      {singleSelectedCard
                        ? `Discard ${formatRank(singleSelectedCard.rank)}${suitSymbol(singleSelectedCard.suit)}`
                        : 'Discard'}
                    </span>
                  </button>

                  {canDeclare && (
                    <button
                      type="button"
                      onClick={() => onAction({ type: 'declare' })}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D4A853] bg-[#D4A853] px-3 text-xs font-bold text-[#111714] whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Declare Rummy!</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Player Card Hand */}
          <div className="felt-scroll flex items-end gap-1.5 overflow-x-auto pb-1 pt-3 sm:flex-wrap sm:justify-center sm:gap-2">
            {displayedHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="sm"
                selected={selectedIds.includes(card.id)}
                onClick={() => toggleSelectCard(card.id)}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

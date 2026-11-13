import { ArrowLeftRight, Bell, SkipForward } from 'lucide-react';
import { useState } from 'react';
import cardBackImg from '../assets/images/card_back_pattern_1794599267225.jpg';
import feltBg from '../assets/images/table_felt_surface_1794599266491.jpg';
import type { SanitizedUnoState, UnoAction, UnoCard, UnoColor } from '../game/types';
import { isUnoCardPlayable } from '../game/unoEngine';

interface UnoTableProps {
  state: SanitizedUnoState;
  currentUserId: string;
  isHost: boolean;
  onAction: (action: UnoAction) => void;
  onNextRound: () => void;
  onReturnToSetup: () => void;
}

const COLOR_STYLES: Record<UnoColor | 'wild', { bg: string; text: string; border: string; label: string }> = {
  red: { bg: 'bg-[#C82829]', text: 'text-white', border: 'border-[#FCA5A5]', label: 'Red' },
  yellow: { bg: 'bg-[#E5B857]', text: 'text-[#111714]', border: 'border-[#FDE68A]', label: 'Yellow' },
  green: { bg: 'bg-[#10B981]', text: 'text-[#071A10]', border: 'border-[#A7F3D0]', label: 'Green' },
  blue: { bg: 'bg-[#2563EB]', text: 'text-white', border: 'border-[#93C5FD]', label: 'Blue' },
  wild: { bg: 'bg-[#111915]', text: 'text-[#F5F2EA]', border: 'border-[#D4A853]', label: 'Wild' },
};

function formatUnoSymbol(value: UnoCard['value']): string {
  switch (value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild':
      return 'W';
    case 'wild4':
      return '+4';
    default:
      return value;
  }
}

function UnoCardView({
  card,
  playable = false,
  disabled = false,
  size = 'sm',
  onClick,
}: {
  card: UnoCard;
  playable?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  onClick?: () => void;
}) {
  const style = COLOR_STYLES[card.color];
  const glyph = formatUnoSymbol(card.value);
  const sizeCls =
    size === 'md'
      ? 'w-[66px] h-[98px] sm:w-[78px] sm:h-[114px] text-base rounded-xl'
      : 'w-[52px] h-[76px] sm:w-[62px] sm:h-[90px] text-sm rounded-lg';

  const cls = `relative shrink-0 flex items-center justify-center border-2 select-none transition-transform duration-150 shadow-[0_6px_16px_rgba(0,0,0,0.45)] ${sizeCls} ${style.bg} ${style.text} ${style.border} ${
    playable ? 'ring-2 ring-[#E5B857] -translate-y-1.5 cursor-pointer hover:-translate-y-2.5' : ''
  } ${disabled ? 'opacity-55 cursor-not-allowed' : ''}`;

  const inner = (
    <>
      <span className="absolute left-1.5 top-1 font-mono text-[11px] font-extrabold leading-none">
        {glyph}
      </span>
      {card.color === 'wild' ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#E5B857] bg-gradient-to-br from-[#C82829] via-[#E5B857] to-[#2563EB] font-sans text-xs font-black text-white shadow">
          {glyph}
        </span>
      ) : (
        <span className="font-sans text-2xl font-extrabold tracking-tight sm:text-3xl">
          {glyph}
        </span>
      )}
      <span className="absolute bottom-1 right-1.5 rotate-180 font-mono text-[11px] font-extrabold leading-none">
        {glyph}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={`${card.color} ${card.value}`}
        className={cls}
      >
        {inner}
      </button>
    );
  }
  return (
    <div aria-label={`${card.color} ${card.value}`} className={cls}>
      {inner}
    </div>
  );
}

export function UnoTable({
  state,
  currentUserId,
  isHost,
  onAction,
  onNextRound,
  onReturnToSetup,
}: UnoTableProps) {
  const [feltError, setFeltError] = useState(false);
  const [backError, setBackError] = useState(false);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);

  const me = state.players.find((p) => p.id === currentUserId);
  const opponents = state.players.filter((p) => p.id !== currentUserId);
  const activePlayer = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(activePlayer && activePlayer.id === currentUserId && state.phase === 'PLAYING');
  const topDiscard = state.discardPile[state.discardPile.length - 1];

  const handleCardClick = (card: UnoCard) => {
    if (!isMyTurn) return;
    if (card.color === 'wild') {
      setPendingWildCardId(card.id);
    } else {
      onAction({ type: 'play', cardId: card.id });
    }
  };

  const activeColorStyle = COLOR_STYLES[state.activeColor];

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
        aria-label="UNO Opponents"
        className="relative z-10 flex flex-wrap items-start justify-center gap-2 px-2.5 pt-2.5 sm:gap-3 sm:px-6 sm:pt-3"
      >
        {opponents.map((opp) => {
          const seatIdx = state.players.findIndex((p) => p.id === opp.id);
          const isTurn = seatIdx === state.activePlayerIndex && state.phase === 'PLAYING';
          const catchable = opp.cardCount === 1 && !opp.calledUno && state.phase === 'PLAYING';
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
              {catchable ? (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'catch_uno', targetPlayerId: opp.id })}
                  className="mt-1 rounded bg-[#C82829] px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                >
                  Catch UNO!
                </button>
              ) : (
                <div className="mt-1 text-[11px] text-[#B8C6BD]">
                  {opp.calledUno && opp.cardCount === 1 ? (
                    <span className="font-bold text-[#E5B857]">UNO!</span>
                  ) : isTurn ? (
                    <span className="text-[#D4A853]">Playing...</span>
                  ) : (
                    opp.lastAction ?? (opp.isBot ? 'Bot' : 'Player')
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Center Draw Pile, Discard & Active Color */}
      <section
        aria-label="UNO Center Board"
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-3 py-2"
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B1711]/90 px-4 py-2 text-xs shadow-lg">
          <span className="flex items-center gap-2 font-semibold text-[#F5F2EA]">
            <span className="text-[#9AB0A2]">Active Color:</span>
            <span className={`inline-block h-3.5 w-3.5 rounded-full border border-white/70 ${activeColorStyle.bg}`} />
            <span>{activeColorStyle.label}</span>
          </span>
          <span aria-hidden="true" className="text-white/25">·</span>
          <span className="flex items-center gap-1.5 font-mono text-[#C6D4CB]">
            <ArrowLeftRight className="h-3.5 w-3.5 text-[#E5B857]" />
            <span>{state.direction === 1 ? 'Clockwise' : 'Counter-CW'}</span>
          </span>
        </div>

        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* Draw Deck */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={!isMyTurn || Boolean(state.drawnPlayableCardId)}
              onClick={() => onAction({ type: 'draw' })}
              aria-label={`Draw UNO card (${state.drawPileCount} left)`}
              className={`relative overflow-hidden rounded-xl border border-[#F3EAD8]/70 bg-[#FAF6EC] p-[2px] shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-transform ${
                isMyTurn && !state.drawnPlayableCardId
                  ? 'ring-2 ring-[#D4A853] hover:-translate-y-1 cursor-pointer'
                  : 'opacity-85 cursor-default'
              }`}
            >
              <div className="relative flex h-[94px] w-[62px] flex-col items-center justify-center overflow-hidden rounded-[8px] bg-[#6B1317] sm:h-[110px] sm:w-[74px]">
                {!backError && (
                  <img
                    src={cardBackImg}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setBackError(true)}
                    className="absolute inset-0 h-full w-full scale-[1.24] object-cover opacity-55"
                  />
                )}
                <span className="relative z-10 rounded-md bg-[#09110D]/80 px-2 py-0.5 font-display text-sm font-bold text-[#E5B857] shadow">
                  UNO
                </span>
              </div>
            </button>
            <span className="font-mono text-[11px] font-semibold text-[#EAE4D4] tabular-nums">
              Deck ({state.drawPileCount})
            </span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1.5">
            {topDiscard && <UnoCardView card={topDiscard} size="md" />}
            <span className="font-mono text-[11px] font-semibold text-[#EAE4D4] tabular-nums">
              Top Card
            </span>
          </div>
        </div>

        {/* Wild Color Picker */}
        {pendingWildCardId && (
          <div className="w-full max-w-sm rounded-2xl border border-[#D4A853]/60 bg-[#0D1912]/95 p-4 text-center shadow-2xl">
            <p className="mb-3 font-display text-base font-bold text-[#F5F2EA]">
              Choose Active Color
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(['red', 'yellow', 'green', 'blue'] as UnoColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onAction({ type: 'play', cardId: pendingWildCardId, chosenColor: c });
                    setPendingWildCardId(null);
                  }}
                  className={`min-h-[44px] rounded-xl border border-white/25 text-xs font-bold capitalize ${COLOR_STYLES[c].bg} ${COLOR_STYLES[c].text}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPendingWildCardId(null)}
              className="mt-2.5 text-xs text-[#9AB0A2] underline"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="max-w-lg truncate text-center text-xs text-[#C6D4CB]">
          {state.actionLog[state.actionLog.length - 1] ?? ''}
        </p>

        {/* Round Over Summary */}
        {state.phase === 'ROUND_OVER' && state.summary && (
          <div className="w-full max-w-md rounded-2xl border border-[#D4A853]/60 bg-[#0D1912]/95 p-4 shadow-2xl">
            <h3 className="text-center font-display text-xl font-bold text-[#F5F2EA]">
              {state.summary.winnerName} Wins UNO! (+{state.summary.pointsWon} pts)
            </h3>
            <div className="mt-3 space-y-1.5">
              {state.summary.standings.map((row) => (
                <div
                  key={row.playerId}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-[#122119] px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-[#F5F2EA]">{row.playerName}</span>
                  <div className="flex items-center gap-3 font-mono tabular-nums">
                    <span className="text-[#9AA89F]">{row.cardsLeft} left</span>
                    <span className="text-[#D4A853]">Score: {row.totalScore}</span>
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

      {/* Player Hand & UNO Controls */}
      <section
        aria-label="Your UNO Hand"
        className="relative z-10 border-t border-white/10 bg-[#0A130E]/95 px-2.5 py-2.5 sm:px-5 sm:py-3"
      >
        <div className="mx-auto max-w-5xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs">
              {state.phase === 'ROUND_OVER' ? (
                <span className="font-semibold text-[#9BA9A0]">Round complete</span>
              ) : isMyTurn ? (
                <span className="font-semibold text-[#D4A853]">
                  {state.drawnPlayableCardId
                    ? 'You drew a playable card — Play it or Pass!'
                    : 'Your turn: Play a matching card or Draw'}
                </span>
              ) : (
                <span className="text-[#9BA9A0]">
                  Waiting for {activePlayer?.name ?? 'opponent'}...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {me && me.hand.length <= 2 && !me.calledUno && state.phase === 'PLAYING' && (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'call_uno' })}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#E5B857] px-3.5 text-xs font-bold text-[#111714]"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>UNO!</span>
                </button>
              )}

              {isMyTurn && state.drawnPlayableCardId && (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'pass_after_draw' })}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/20 bg-[#182920] px-3.5 text-xs font-semibold text-[#F5F2EA]"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  <span>Pass Turn</span>
                </button>
              )}
            </div>
          </div>

          <div className="felt-scroll flex items-end gap-1.5 overflow-x-auto pb-1 pt-2 sm:flex-wrap sm:justify-center sm:gap-2">
            {(me?.hand ?? []).map((card) => {
              const playable =
                isMyTurn &&
                topDiscard !== undefined &&
                isUnoCardPlayable(card, topDiscard, state.activeColor) &&
                (!state.drawnPlayableCardId || card.id === state.drawnPlayableCardId);

              return (
                <UnoCardView
                  key={card.id}
                  card={card}
                  playable={playable}
                  disabled={!playable}
                  onClick={playable ? () => handleCardClick(card) : undefined}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

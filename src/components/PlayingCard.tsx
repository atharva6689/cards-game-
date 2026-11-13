import { useState } from 'react';
import cardBackImg from '../assets/images/card_back_pattern_1794599267225.jpg';
import { formatRank, isRedSuit, suitSymbol } from '../game/deck';
import type { Card } from '../game/types';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  ariaLabel?: string;
}

const SIZE_CLASSES = {
  xs: 'w-9 h-13 text-[11px] rounded',
  sm: 'w-12 h-[68px] sm:w-14 sm:h-20 text-xs rounded-md',
  md: 'w-[54px] h-[78px] sm:w-[68px] sm:h-[96px] text-sm rounded-lg',
  lg: 'w-[62px] h-[90px] sm:w-[78px] sm:h-[112px] text-base rounded-lg',
};

export function PlayingCard({
  card,
  faceDown = false,
  selected = false,
  highlighted = false,
  disabled = false,
  size = 'md',
  onClick,
  ariaLabel,
}: PlayingCardProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        aria-label={ariaLabel ?? 'Face-down card'}
        className={`relative shrink-0 overflow-hidden border border-[#F3EAD8]/70 bg-[#FAF6EC] p-[2px] shadow-[0_6px_14px_rgba(0,0,0,0.45)] select-none ${sizeClass}`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[4px] bg-[#6B1317]">
          {!imgError ? (
            <img
              src={cardBackImg}
              alt="Playing card back"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full scale-[1.24] object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-[#D4A853]/60 bg-[#6B1317]">
              <span className="font-display text-xs text-[#D4A853]">♦</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const rankStr = formatRank(card.rank);
  const sym = suitSymbol(card.suit);
  const colorClass = red ? 'text-[#C82829]' : 'text-[#141816]';
  const interactive = Boolean(onClick) && !disabled;

  const baseClasses = `relative shrink-0 flex flex-col justify-between bg-[#FAF7F0] border select-none transition-transform duration-150 ease-out shadow-[0_6px_16px_rgba(0,0,0,0.45)] ${sizeClass} ${colorClass} ${
    selected
      ? '-translate-y-3 border-[#D4A853] ring-2 ring-[#D4A853]'
      : highlighted
        ? 'border-[#10B981] ring-2 ring-[#10B981]/80'
        : 'border-[#E6DEC8]'
  } ${
    interactive
      ? 'cursor-pointer hover:-translate-y-1.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A853]'
      : ''
  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  const content = (
    <>
      <div className="absolute left-1 top-1 flex flex-col items-center leading-[0.95]">
        <span className="font-bold tracking-tight tabular-nums">{rankStr}</span>
        <span className="text-[0.8em] leading-none">{sym}</span>
      </div>
      <div className="flex flex-1 items-center justify-center leading-none">
        <span
          className={
            size === 'xs'
              ? 'text-sm'
              : size === 'sm'
                ? 'text-lg sm:text-xl'
                : 'text-2xl sm:text-3xl'
          }
          aria-hidden="true"
        >
          {sym}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 flex rotate-180 flex-col items-center leading-[0.95]">
        <span className="font-bold tracking-tight tabular-nums">{rankStr}</span>
        <span className="text-[0.8em] leading-none">{sym}</span>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={ariaLabel ?? `${rankStr} of ${card.suit}`}
        className={baseClasses}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      aria-label={ariaLabel ?? `${rankStr} of ${card.suit}`}
      className={baseClasses}
    >
      {content}
    </div>
  );
}

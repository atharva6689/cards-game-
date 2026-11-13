import type { Card, Rank, Suit } from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const BOT_NAMES = [
  'Evelyn Vance',
  'Julian Mercer',
  'Sora Takahashi',
  'Mateo Navarro',
  'Clara Beaumont',
  'Arthur Pendelton',
  'Nadia Volkov',
  'Lucas Sterling',
  'Priya Nair',
];

export function createMultiDeck(deckCount: number): Card[] {
  const safeCount = Math.max(1, Math.min(4, Math.floor(deckCount)));
  const cards: Card[] = [];
  for (let d = 1; d <= safeCount; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `d${d}-${suit}-${rank}`,
          suit,
          rank,
          deckIndex: d,
        });
      }
    }
  }
  return cards;
}

export function shuffleCards(cards: Card[], rng: () => number = Math.random): Card[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function formatRank(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
  }
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function sortCardsByRank(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
  return [...cards].sort((a, b) => {
    const ar = a.rank === 14 ? 1 : a.rank;
    const br = b.rank === 14 ? 1 : b.rank;
    if (ar !== br) return ar - br;
    return suitOrder[a.suit] - suitOrder[b.suit];
  });
}

export function sortCardsBySuit(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    const ar = a.rank === 14 ? 1 : a.rank;
    const br = b.rank === 14 ? 1 : b.rank;
    return ar - br;
  });
}

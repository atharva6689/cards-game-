import { BOT_NAMES, createMultiDeck, formatRank, shuffleCards, suitSymbol } from './deck';
import type {
  Card,
  LobbyPlayer,
  RummyAction,
  RummyGameState,
  RummyMeld,
  RummyPlayerState,
  RummyRoundSummary,
  SanitizedRummyState,
} from './types';

export function cardDeadwoodPoints(card: Card): number {
  if (card.rank === 14) return 1; // Ace = 1 pt in Classic Rummy
  if (card.rank >= 10) return 10;
  return card.rank;
}

export function calculateDeadwood(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardDeadwoodPoints(c), 0);
}

export function isValidSet(cards: Card[], deckCount: number = 1): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const uniqueIds = new Set(cards.map((c) => c.id));
  if (uniqueIds.size !== cards.length) return false;

  const targetRank = cards[0].rank;
  if (!cards.every((c) => c.rank === targetRank)) return false;

  if (deckCount === 1) {
    const suits = new Set(cards.map((c) => c.suit));
    return suits.size === cards.length;
  }
  return true;
}

export function sortRunCards(cards: Card[]): Card[] {
  const hasAce = cards.some((c) => c.rank === 14);
  const hasKing = cards.some((c) => c.rank === 13);
  const aceLow = hasAce && !hasKing;
  return [...cards].sort((a, b) => {
    const ar = aceLow && a.rank === 14 ? 1 : a.rank;
    const br = aceLow && b.rank === 14 ? 1 : b.rank;
    return ar - br;
  });
}

export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const uniqueIds = new Set(cards.map((c) => c.id));
  if (uniqueIds.size !== cards.length) return false;

  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;

  // Try Ace as 1 (low) and Ace as 14 (high)
  const checkSequential = (aceVal: number): boolean => {
    const vals = cards
      .map((c) => (c.rank === 14 ? aceVal : c.rank))
      .sort((a, b) => a - b);
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] !== vals[i - 1] + 1) return false;
    }
    return true;
  };

  return checkSequential(1) || checkSequential(14);
}

export function classifyMeld(cards: Card[], deckCount: number = 1): 'set' | 'run' | null {
  if (isValidSet(cards, deckCount)) return 'set';
  if (isValidRun(cards)) return 'run';
  return null;
}

export function canLayOffCard(card: Card, meld: RummyMeld, deckCount: number): boolean {
  const combined = [...meld.cards, card];
  if (meld.type === 'set') {
    return isValidSet(combined, deckCount);
  }
  return isValidRun(combined);
}

export interface OptimalMeldResult {
  melds: { type: 'set' | 'run'; cards: Card[] }[];
  deadwood: Card[];
  deadwoodPoints: number;
}

export function findOptimalMelds(hand: Card[], deckCount: number = 1): OptimalMeldResult {
  // Generate all candidate valid sets (size 3..4) and runs (size 3..hand.length)
  const candidates: { type: 'set' | 'run'; cards: Card[]; mask: number; points: number }[] = [];
  const n = hand.length;

  // Group by rank for Sets
  const byRank = new Map<number, number[]>();
  const bySuit = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const c = hand[i];
    const rList = byRank.get(c.rank) ?? [];
    rList.push(i);
    byRank.set(c.rank, rList);

    const sList = bySuit.get(c.suit) ?? [];
    sList.push(i);
    bySuit.set(c.suit, sList);
  }

  for (const idxs of byRank.values()) {
    if (idxs.length >= 3) {
      // 3-combinations
      for (let a = 0; a < idxs.length - 2; a++) {
        for (let b = a + 1; b < idxs.length - 1; b++) {
          for (let c = b + 1; c < idxs.length; c++) {
            const sub = [hand[idxs[a]], hand[idxs[b]], hand[idxs[c]]];
            if (isValidSet(sub, deckCount)) {
              const mask = (1 << idxs[a]) | (1 << idxs[b]) | (1 << idxs[c]);
              candidates.push({ type: 'set', cards: sub, mask, points: calculateDeadwood(sub) });
            }
          }
        }
      }
      if (idxs.length >= 4) {
        for (let a = 0; a < idxs.length - 3; a++) {
          for (let b = a + 1; b < idxs.length - 2; b++) {
            for (let c = b + 1; c < idxs.length - 1; c++) {
              for (let d = c + 1; d < idxs.length; d++) {
                const sub = [hand[idxs[a]], hand[idxs[b]], hand[idxs[c]], hand[idxs[d]]];
                if (isValidSet(sub, deckCount)) {
                  const mask = (1 << idxs[a]) | (1 << idxs[b]) | (1 << idxs[c]) | (1 << idxs[d]);
                  candidates.push({ type: 'set', cards: sub, mask, points: calculateDeadwood(sub) });
                }
              }
            }
          }
        }
      }
    }
  }

  // Runs per suit
  for (const idxs of bySuit.values()) {
    if (idxs.length < 3) continue;
    // Check both Ace=1 and Ace=14 orderings
    for (const aceVal of [1, 14]) {
      const sortedIdxs = [...idxs].sort((ia, ib) => {
        const ra = hand[ia].rank === 14 ? aceVal : hand[ia].rank;
        const rb = hand[ib].rank === 14 ? aceVal : hand[ib].rank;
        return ra - rb;
      });
      // Build deduplicated rank-bucket chains for multi-deck runs
      for (let start = 0; start < sortedIdxs.length; start++) {
        const chain: number[] = [sortedIdxs[start]];
        let prevRank = hand[sortedIdxs[start]].rank === 14 ? aceVal : hand[sortedIdxs[start]].rank;
        for (let next = start + 1; next < sortedIdxs.length; next++) {
          const r = hand[sortedIdxs[next]].rank === 14 ? aceVal : hand[sortedIdxs[next]].rank;
          if (r === prevRank + 1) {
            chain.push(sortedIdxs[next]);
            prevRank = r;
            if (chain.length >= 3) {
              const sub = chain.map((idx) => hand[idx]);
              const mask = chain.reduce((m, idx) => m | (1 << idx), 0);
              if (!candidates.some((cand) => cand.mask === mask && cand.type === 'run')) {
                candidates.push({
                  type: 'run',
                  cards: sortRunCards(sub),
                  mask,
                  points: calculateDeadwood(sub),
                });
              }
            }
          } else if (r > prevRank + 1) {
            break;
          }
        }
      }
    }
  }

  let bestPointsSaved = 0;
  let bestCombo: typeof candidates = [];

  function dfs(idx: number, usedMask: number, saved: number, chosen: typeof candidates) {
    if (saved > bestPointsSaved) {
      bestPointsSaved = saved;
      bestCombo = [...chosen];
    }
    for (let i = idx; i < candidates.length; i++) {
      const cand = candidates[i];
      if ((usedMask & cand.mask) === 0) {
        chosen.push(cand);
        dfs(i + 1, usedMask | cand.mask, saved + cand.points, chosen);
        chosen.pop();
      }
    }
  }

  dfs(0, 0, 0, []);

  const usedFinal = bestCombo.reduce((m, c) => m | c.mask, 0);
  const deadwood = hand.filter((_, idx) => (usedFinal & (1 << idx)) === 0);
  return {
    melds: bestCombo.map((c) => ({ type: c.type, cards: c.cards })),
    deadwood,
    deadwoodPoints: calculateDeadwood(deadwood),
  };
}

export function buildRummyPlayers(humans: LobbyPlayer[], botCount: number): RummyPlayerState[] {
  const players: RummyPlayerState[] = humans.map((h) => ({
    id: h.id,
    name: h.name,
    isBot: false,
    hand: [],
    score: 0,
    roundDeadwood: 0,
  }));

  const safeBots = Math.max(0, Math.min(9, botCount));
  for (let i = 0; i < safeBots; i++) {
    players.push({
      id: `bot-${i + 1}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      hand: [],
      score: 0,
      roundDeadwood: 0,
    });
  }

  return players;
}

export function createRummyRound(
  existingPlayers: RummyPlayerState[],
  options: {
    roundNumber: number;
    deckCount: number;
    startingPlayerIndex?: number;
    rng?: () => number;
  }
): RummyGameState {
  const deckCount = Math.max(1, Math.min(4, options.deckCount));
  const totalCards = deckCount * 52;
  const maxTenCardPlayers = Math.floor((totalCards - 10) / 10);
  const cardsPerPlayer = existingPlayers.length <= maxTenCardPlayers ? 10 : 7;

  const stock = shuffleCards(createMultiDeck(deckCount), options.rng);
  const players: RummyPlayerState[] = existingPlayers.map((p) => ({
    ...p,
    hand: [],
    roundDeadwood: 0,
    lastAction: undefined,
  }));

  for (let c = 0; c < cardsPerPlayer; c++) {
    for (const p of players) {
      p.hand.push(stock.pop()!);
    }
  }

  const firstDiscard = stock.pop()!;
  const startIdx = (options.startingPlayerIndex ?? 0) % players.length;

  return {
    gameType: 'rummy',
    roundNumber: options.roundNumber,
    deckCount,
    cardsPerPlayer,
    phase: 'DRAW',
    activePlayerIndex: startIdx,
    stock,
    discardPile: [firstDiscard],
    tableMelds: [],
    players,
    drawnFromDiscardId: null,
    reshuffleCount: 0,
    summary: null,
    actionLog: [
      `Round #${options.roundNumber} dealt (${deckCount} deck${deckCount > 1 ? 's' : ''}, ${cardsPerPlayer} cards each).`,
    ],
  };
}

function finalizeRummyRound(state: RummyGameState, winnerId: string, reason: string): RummyGameState {
  const next: RummyGameState = {
    ...state,
    phase: 'ROUND_OVER',
    players: state.players.map((p) => {
      const optimal = p.id === winnerId ? { deadwoodPoints: 0 } : findOptimalMelds(p.hand, state.deckCount);
      const dw = p.id === winnerId ? 0 : optimal.deadwoodPoints;
      return {
        ...p,
        roundDeadwood: dw,
        score: p.score + dw,
      };
    }),
    actionLog: [...state.actionLog, reason],
  };

  const winner = next.players.find((p) => p.id === winnerId)!;
  const summary: RummyRoundSummary = {
    winnerId: winner.id,
    winnerName: winner.name,
    deckReshuffles: next.reshuffleCount,
    standings: next.players
      .map((p) => ({
        playerId: p.id,
        playerName: p.name,
        deadwood: p.roundDeadwood,
        totalScore: p.score,
        remainingCards: p.hand,
      }))
      .sort((a, b) => a.deadwood - b.deadwood || a.totalScore - b.totalScore),
  };

  next.summary = summary;
  return next;
}

export function applyRummyAction(
  state: RummyGameState,
  playerId: string,
  action: RummyAction,
  rng: () => number = Math.random
): RummyGameState {
  if (state.phase === 'ROUND_OVER') return state;
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer || activePlayer.id !== playerId) {
    throw new Error('Not your turn to act.');
  }

  const next: RummyGameState = {
    ...state,
    stock: [...state.stock],
    discardPile: [...state.discardPile],
    tableMelds: state.tableMelds.map((m) => ({ ...m, cards: [...m.cards] })),
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    actionLog: [...state.actionLog],
  };

  const p = next.players[next.activePlayerIndex];

  if (action.type === 'draw_stock') {
    if (next.phase !== 'DRAW') throw new Error('Already drew a card this turn.');
    if (next.stock.length === 0) {
      if (next.discardPile.length <= 1) {
        // Rare stalemate: score lowest deadwood
        const sorted = [...next.players].sort(
          (a, b) => findOptimalMelds(a.hand, next.deckCount).deadwoodPoints - findOptimalMelds(b.hand, next.deckCount).deadwoodPoints
        );
        return finalizeRummyRound(next, sorted[0].id, `${sorted[0].name} wins on lowest deadwood (deck exhausted).`);
      }
      const topDiscard = next.discardPile.pop()!;
      next.stock = shuffleCards(next.discardPile, rng);
      next.discardPile = [topDiscard];
      next.reshuffleCount += 1;
      next.actionLog.push('Discard pile reshuffled into draw deck.');
    }
    const drawn = next.stock.pop()!;
    p.hand.push(drawn);
    p.lastAction = 'Drew from deck';
    next.phase = 'MELD_OR_DISCARD';
    next.drawnFromDiscardId = null;
    next.actionLog.push(`${p.name} drew from the deck.`);
    return next;
  }

  if (action.type === 'draw_discard') {
    if (next.phase !== 'DRAW') throw new Error('Already drew a card this turn.');
    if (next.discardPile.length === 0) throw new Error('Discard pile is empty.');
    const drawn = next.discardPile.pop()!;
    p.hand.push(drawn);
    p.lastAction = `Took ${formatRank(drawn.rank)}${suitSymbol(drawn.suit)}`;
    next.phase = 'MELD_OR_DISCARD';
    next.drawnFromDiscardId = drawn.id;
    next.actionLog.push(`${p.name} took ${formatRank(drawn.rank)}${suitSymbol(drawn.suit)} from discard.`);
    return next;
  }

  if (action.type === 'meld') {
    if (next.phase !== 'MELD_OR_DISCARD') throw new Error('Draw a card first.');
    const selected = action.cardIds
      .map((id) => p.hand.find((c) => c.id === id))
      .filter((c): c is Card => Boolean(c));
    if (selected.length !== action.cardIds.length) {
      throw new Error('Selected cards not in hand.');
    }
    const kind = classifyMeld(selected, next.deckCount);
    if (!kind) {
      throw new Error('Selected cards do not form a valid Set or Run.');
    }

    const orderedCards = kind === 'run' ? sortRunCards(selected) : selected;
    const idSet = new Set(action.cardIds);
    p.hand = p.hand.filter((c) => !idSet.has(c.id));
    next.tableMelds.push({
      id: `meld-${Date.now()}-${Math.floor(rng() * 10000)}`,
      type: kind,
      cards: orderedCards,
      ownerId: p.id,
    });
    p.lastAction = `Melded ${kind}`;
    next.actionLog.push(`${p.name} melded a ${kind} (${orderedCards.map((c) => `${formatRank(c.rank)}${suitSymbol(c.suit)}`).join(' ')}).`);

    if (p.hand.length === 0) {
      return finalizeRummyRound(next, p.id, `${p.name} melded all cards and went out!`);
    }
    return next;
  }

  if (action.type === 'layoff') {
    if (next.phase !== 'MELD_OR_DISCARD') throw new Error('Draw a card first.');
    const cardIdx = p.hand.findIndex((c) => c.id === action.cardId);
    if (cardIdx === -1) throw new Error('Card not in hand.');
    const meld = next.tableMelds.find((m) => m.id === action.meldId);
    if (!meld) throw new Error('Target meld not found.');
    const card = p.hand[cardIdx];
    if (!canLayOffCard(card, meld, next.deckCount)) {
      throw new Error('That card cannot be laid off on the selected meld.');
    }

    p.hand.splice(cardIdx, 1);
    meld.cards = meld.type === 'run' ? sortRunCards([...meld.cards, card]) : [...meld.cards, card];
    p.lastAction = `Laid off ${formatRank(card.rank)}${suitSymbol(card.suit)}`;
    next.actionLog.push(`${p.name} laid off ${formatRank(card.rank)}${suitSymbol(card.suit)}.`);

    if (p.hand.length === 0) {
      return finalizeRummyRound(next, p.id, `${p.name} laid off their final card and went out!`);
    }
    return next;
  }

  if (action.type === 'declare') {
    if (next.phase !== 'MELD_OR_DISCARD') throw new Error('Draw a card first.');
    const optimal = findOptimalMelds(p.hand, next.deckCount);
    if (optimal.deadwood.length > 1) {
      throw new Error('You can only declare when all cards (or all except 1 discard) form valid melds.');
    }
    for (const m of optimal.melds) {
      next.tableMelds.push({
        id: `meld-${Date.now()}-${Math.floor(rng() * 10000)}`,
        type: m.type,
        cards: m.cards,
        ownerId: p.id,
      });
    }
    if (optimal.deadwood.length === 1) {
      next.discardPile.push(optimal.deadwood[0]);
    }
    p.hand = [];
    return finalizeRummyRound(next, p.id, `${p.name} declared Rummy and won the round!`);
  }

  if (action.type === 'discard') {
    if (next.phase !== 'MELD_OR_DISCARD') throw new Error('Draw a card first.');
    const cardIdx = p.hand.findIndex((c) => c.id === action.cardId);
    if (cardIdx === -1) throw new Error('Card not in hand.');
    if (action.cardId === next.drawnFromDiscardId && p.hand.length > 1) {
      throw new Error('Cannot discard the exact card you just drew from the discard pile.');
    }

    const [discarded] = p.hand.splice(cardIdx, 1);
    next.discardPile.push(discarded);
    p.lastAction = `Discarded ${formatRank(discarded.rank)}${suitSymbol(discarded.suit)}`;
    next.actionLog.push(`${p.name} discarded ${formatRank(discarded.rank)}${suitSymbol(discarded.suit)}.`);
    next.drawnFromDiscardId = null;

    if (p.hand.length === 0) {
      return finalizeRummyRound(next, p.id, `${p.name} discarded their last card and won!`);
    }

    next.phase = 'DRAW';
    next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
    return next;
  }

  return next;
}

export function decideRummyBotAction(
  state: RummyGameState,
  botId: string
): RummyAction {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'draw_stock' };

  if (state.phase === 'DRAW') {
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    if (topDiscard) {
      const currentOpt = findOptimalMelds(bot.hand, state.deckCount);
      const withDiscardOpt = findOptimalMelds([...bot.hand, topDiscard], state.deckCount);
      if (withDiscardOpt.melds.length > currentOpt.melds.length) {
        return { type: 'draw_discard' };
      }
      // Or if it can be laid off on an existing meld
      if (state.tableMelds.some((m) => canLayOffCard(topDiscard, m, state.deckCount))) {
        return { type: 'draw_discard' };
      }
    }
    return { type: 'draw_stock' };
  }

  // MELD_OR_DISCARD
  const opt = findOptimalMelds(bot.hand, state.deckCount);
  if (opt.melds.length > 0) {
    return { type: 'meld', cardIds: opt.melds[0].cards.map((c) => c.id) };
  }

  // Try laying off a card onto table melds
  for (const card of bot.hand) {
    for (const meld of state.tableMelds) {
      if (canLayOffCard(card, meld, state.deckCount)) {
        return { type: 'layoff', cardId: card.id, meldId: meld.id };
      }
    }
  }

  // Discard highest-point deadwood card that wasn't just drawn from discard
  const candidates = bot.hand.filter(
    (c) => c.id !== state.drawnFromDiscardId || bot.hand.length === 1
  );
  const sorted = [...candidates].sort((a, b) => cardDeadwoodPoints(b) - cardDeadwoodPoints(a));
  return { type: 'discard', cardId: (sorted[0] ?? bot.hand[0]).id };
}

export function sanitizeRummyState(
  state: RummyGameState,
  viewerId: string
): SanitizedRummyState {
  const revealAll = state.phase === 'ROUND_OVER';
  return {
    gameType: 'rummy',
    roundNumber: state.roundNumber,
    deckCount: state.deckCount,
    cardsPerPlayer: state.cardsPerPlayer,
    phase: state.phase,
    activePlayerIndex: state.activePlayerIndex,
    stockCount: state.stock.length,
    discardPile: state.discardPile,
    tableMelds: state.tableMelds,
    players: state.players.map((p) => {
      const show = revealAll || p.id === viewerId;
      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        hand: show ? p.hand : [],
        cardCount: p.hand.length,
        score: p.score,
        roundDeadwood: p.roundDeadwood,
        lastAction: p.lastAction,
      };
    }),
    drawnFromDiscardId: state.drawnFromDiscardId,
    reshuffleCount: state.reshuffleCount,
    summary: state.summary,
    actionLog: state.actionLog.slice(-12),
  };
}

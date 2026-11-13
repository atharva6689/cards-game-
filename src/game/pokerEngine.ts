import { BOT_NAMES, createMultiDeck, formatRank, shuffleCards } from './deck';
import type {
  Card,
  LobbyPlayer,
  PokerAction,
  PokerGameState,
  PokerPlayerState,
  PokerStreet,
  PokerWinnerSummary,
  SanitizedPokerState,
} from './types';

export interface EvaluatedHand {
  category: number; // 0=High Card .. 8=Straight Flush, 9=Five of a Kind
  tiebreakers: number[];
  name: string;
}

const CATEGORY_NAMES: Record<number, string> = {
  9: 'Five of a Kind',
  8: 'Straight Flush',
  7: 'Four of a Kind',
  6: 'Full House',
  5: 'Flush',
  4: 'Straight',
  3: 'Three of a Kind',
  2: 'Two Pair',
  1: 'One Pair',
  0: 'High Card',
};

function compareScoreTuple(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  return compareScoreTuple(a.tiebreakers, b.tiebreakers);
}

function evaluateFiveCards(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const groups = Array.from(rankCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  // Straight check (must have 5 distinct ranks)
  let straightHigh = 0;
  if (groups.length === 5) {
    if (ranks[0] - ranks[4] === 4) {
      straightHigh = ranks[0];
    } else if (
      ranks[0] === 14 &&
      ranks[1] === 5 &&
      ranks[2] === 4 &&
      ranks[3] === 3 &&
      ranks[4] === 2
    ) {
      straightHigh = 5; // A-2-3-4-5 wheel
    }
  }

  if (groups[0][1] === 5) {
    return {
      category: 9,
      tiebreakers: [groups[0][0]],
      name: `Five of a Kind, ${formatRank(groups[0][0] as Card['rank'])}s`,
    };
  }

  if (isFlush && straightHigh > 0) {
    return {
      category: 8,
      tiebreakers: [straightHigh],
      name: straightHigh === 14 ? 'Royal Flush' : `Straight Flush, ${formatRank(straightHigh as Card['rank'])} High`,
    };
  }

  if (groups[0][1] === 4) {
    return {
      category: 7,
      tiebreakers: [groups[0][0], groups[1][0]],
      name: `Four of a Kind, ${formatRank(groups[0][0] as Card['rank'])}s`,
    };
  }

  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: 6,
      tiebreakers: [groups[0][0], groups[1][0]],
      name: `Full House, ${formatRank(groups[0][0] as Card['rank'])}s full of ${formatRank(groups[1][0] as Card['rank'])}s`,
    };
  }

  if (isFlush) {
    return {
      category: 5,
      tiebreakers: ranks,
      name: `Flush, ${formatRank(ranks[0] as Card['rank'])} High`,
    };
  }

  if (straightHigh > 0) {
    return {
      category: 4,
      tiebreakers: [straightHigh],
      name: `Straight, ${formatRank(straightHigh as Card['rank'])} High`,
    };
  }

  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      category: 3,
      tiebreakers: [groups[0][0], ...kickers],
      name: `Three of a Kind, ${formatRank(groups[0][0] as Card['rank'])}s`,
    };
  }

  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      category: 2,
      tiebreakers: [groups[0][0], groups[1][0], groups[2][0]],
      name: `Two Pair, ${formatRank(groups[0][0] as Card['rank'])}s & ${formatRank(groups[1][0] as Card['rank'])}s`,
    };
  }

  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      category: 1,
      tiebreakers: [groups[0][0], ...kickers],
      name: `Pair of ${formatRank(groups[0][0] as Card['rank'])}s`,
    };
  }

  return {
    category: 0,
    tiebreakers: ranks,
    name: `${CATEGORY_NAMES[0]}, ${formatRank(ranks[0] as Card['rank'])}`,
  };
}

export function evaluatePokerHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) {
    const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
    return {
      category: 0,
      tiebreakers: ranks,
      name: ranks.length > 0 ? `High Card, ${formatRank(ranks[0] as Card['rank'])}` : 'Empty Hand',
    };
  }
  if (cards.length === 5) return evaluateFiveCards(cards);

  let best: EvaluatedHand | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const eval5 = evaluateFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareEvaluatedHands(eval5, best) > 0) {
              best = eval5;
            }
          }
        }
      }
    }
  }
  return best!;
}

export function buildPokerPlayers(
  humans: LobbyPlayer[],
  botCount: number,
  startingChips: number
): PokerPlayerState[] {
  const seats: PokerPlayerState[] = humans.map((h) => ({
    id: h.id,
    name: h.name,
    isBot: false,
    chips: h.chips > 0 ? h.chips : startingChips,
    holeCards: [],
    currentBet: 0,
    totalCommitted: 0,
    folded: false,
    allIn: false,
    hasActedThisStreet: false,
  }));

  const safeBots = Math.max(0, Math.min(9, botCount));
  for (let i = 0; i < safeBots; i++) {
    seats.push({
      id: `bot-${i + 1}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      chips: startingChips,
      holeCards: [],
      currentBet: 0,
      totalCommitted: 0,
      folded: false,
      allIn: false,
      hasActedThisStreet: false,
    });
  }

  return seats;
}

function nextActiveSeat(players: PokerPlayerState[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (!players[idx].folded && !players[idx].allIn && players[idx].chips > 0) {
      return idx;
    }
  }
  return -1;
}

function nextNonFoldedSeat(players: PokerPlayerState[], fromIndex: number): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (!players[idx].folded) {
      return idx;
    }
  }
  return 0;
}

function postBlind(player: PokerPlayerState, amount: number): number {
  const actual = Math.min(player.chips, amount);
  player.chips -= actual;
  player.currentBet += actual;
  player.totalCommitted += actual;
  if (player.chips === 0) {
    player.allIn = true;
  }
  return actual;
}

export function createPokerHand(
  existingPlayers: PokerPlayerState[],
  options: {
    handNumber: number;
    deckCount: number;
    dealerIndex: number;
    smallBlind?: number;
    bigBlind?: number;
    rng?: () => number;
  }
): PokerGameState {
  const smallBlind = options.smallBlind ?? 10;
  const bigBlind = options.bigBlind ?? 20;
  const deckCount = Math.max(1, Math.min(4, options.deckCount));

  // Rebuy busted players in casual club mode if fewer than 2 players have chips
  const activeWithChips = existingPlayers.filter((p) => p.chips > 0);
  const players: PokerPlayerState[] = existingPlayers.map((p) => {
    const rebuyChips = activeWithChips.length < 2 && p.chips <= 0 ? 1000 : p.chips;
    return {
      ...p,
      chips: rebuyChips,
      holeCards: [],
      currentBet: 0,
      totalCommitted: 0,
      folded: rebuyChips <= 0,
      allIn: false,
      hasActedThisStreet: false,
      lastAction: rebuyChips <= 0 ? 'Busted' : undefined,
      bestHandName: undefined,
    };
  });

  const deck = shuffleCards(createMultiDeck(deckCount), options.rng);
  const dealerIndex = options.dealerIndex % players.length;

  // Deal 2 hole cards to each non-folded player
  for (let c = 0; c < 2; c++) {
    for (let i = 0; i < players.length; i++) {
      const seat = (dealerIndex + 1 + i) % players.length;
      if (!players[seat].folded) {
        players[seat].holeCards.push(deck.pop()!);
      }
    }
  }

  const eligibleCount = players.filter((p) => !p.folded).length;
  const isHeadsUp = eligibleCount === 2;
  const sbIndex = isHeadsUp ? dealerIndex : nextNonFoldedSeat(players, dealerIndex);
  const bbIndex = nextNonFoldedSeat(players, sbIndex);

  const sbPosted = postBlind(players[sbIndex], smallBlind);
  players[sbIndex].lastAction = `SB $${sbPosted}`;

  const bbPosted = postBlind(players[bbIndex], bigBlind);
  players[bbIndex].lastAction = `BB $${bbPosted}`;

  const pot = sbPosted + bbPosted;
  const currentBet = Math.max(players[sbIndex].currentBet, players[bbIndex].currentBet);
  const firstToAct = nextActiveSeat(players, bbIndex);

  const state: PokerGameState = {
    gameType: 'poker',
    handNumber: options.handNumber,
    deckCount,
    smallBlind,
    bigBlind,
    dealerIndex,
    street: 'PREFLOP',
    pot,
    currentBet,
    minRaise: bigBlind,
    activePlayerIndex: firstToAct,
    deck,
    communityCards: [],
    players,
    winners: [],
    actionLog: [`Hand #${options.handNumber} dealt (${deckCount} deck${deckCount > 1 ? 's' : ''}).`],
    finished: false,
  };

  if (firstToAct === -1) {
    return runoutToShowdown(state);
  }
  return state;
}

function resolveShowdown(state: PokerGameState): PokerGameState {
  const next: PokerGameState = {
    ...state,
    street: 'SHOWDOWN',
    finished: true,
    activePlayerIndex: -1,
    players: state.players.map((p) => ({ ...p })),
    winners: [],
    actionLog: [...state.actionLog],
  };

  const contenders = next.players.filter((p) => !p.folded);
  if (contenders.length === 1) {
    const sole = contenders[0];
    sole.chips += next.pot;
    next.winners = [
      {
        playerId: sole.id,
        playerName: sole.name,
        amount: next.pot,
        handName: 'Opponents Folded',
      },
    ];
    next.actionLog.push(`${sole.name} wins $${next.pot} (all others folded).`);
    return next;
  }

  const evalMap = new Map<string, EvaluatedHand>();
  for (const p of contenders) {
    const ev = evaluatePokerHand([...p.holeCards, ...next.communityCards]);
    evalMap.set(p.id, ev);
    p.bestHandName = ev.name;
  }

  // Side-pot distribution by totalCommitted levels
  const levels = Array.from(
    new Set(next.players.filter((p) => p.totalCommitted > 0).map((p) => p.totalCommitted))
  ).sort((a, b) => a - b);

  const payouts = new Map<string, number>();
  let prevLevel = 0;

  for (const level of levels) {
    const slicePerContributor = level - prevLevel;
    let slicePot = 0;
    for (const p of next.players) {
      if (p.totalCommitted > prevLevel) {
        slicePot += Math.min(slicePerContributor, p.totalCommitted - prevLevel);
      }
    }
    prevLevel = level;
    if (slicePot <= 0) continue;

    const eligible = contenders.filter((p) => p.totalCommitted >= level);
    if (eligible.length === 0) continue;

    let bestEval = evalMap.get(eligible[0].id)!;
    let sliceWinners = [eligible[0]];
    for (let i = 1; i < eligible.length; i++) {
      const ev = evalMap.get(eligible[i].id)!;
      const cmp = compareEvaluatedHands(ev, bestEval);
      if (cmp > 0) {
        bestEval = ev;
        sliceWinners = [eligible[i]];
      } else if (cmp === 0) {
        sliceWinners.push(eligible[i]);
      }
    }

    const share = Math.floor(slicePot / sliceWinners.length);
    let remainder = slicePot - share * sliceWinners.length;
    for (const w of sliceWinners) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      payouts.set(w.id, (payouts.get(w.id) ?? 0) + share + extra);
    }
  }

  const summaries: PokerWinnerSummary[] = [];
  for (const [playerId, amount] of payouts.entries()) {
    const player = next.players.find((p) => p.id === playerId)!;
    player.chips += amount;
    const handName = evalMap.get(playerId)?.name ?? 'Best Hand';
    summaries.push({
      playerId,
      playerName: player.name,
      amount,
      handName,
    });
    next.actionLog.push(`${player.name} wins $${amount} with ${handName}.`);
  }

  next.winners = summaries;
  return next;
}

function advanceStreet(state: PokerGameState): PokerGameState {
  const streetOrder: PokerStreet[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
  const currentIdx = streetOrder.indexOf(state.street);
  const nextStreet = streetOrder[currentIdx + 1] ?? 'SHOWDOWN';

  const next: PokerGameState = {
    ...state,
    street: nextStreet,
    currentBet: 0,
    minRaise: state.bigBlind,
    deck: [...state.deck],
    communityCards: [...state.communityCards],
    players: state.players.map((p) => ({
      ...p,
      currentBet: 0,
      hasActedThisStreet: false,
      lastAction: p.folded ? 'Folded' : p.allIn ? 'All-In' : undefined,
    })),
    actionLog: [...state.actionLog],
  };

  if (nextStreet === 'FLOP') {
    next.communityCards.push(next.deck.pop()!, next.deck.pop()!, next.deck.pop()!);
    next.actionLog.push('Flop dealt.');
  } else if (nextStreet === 'TURN') {
    next.communityCards.push(next.deck.pop()!);
    next.actionLog.push('Turn dealt.');
  } else if (nextStreet === 'RIVER') {
    next.communityCards.push(next.deck.pop()!);
    next.actionLog.push('River dealt.');
  } else {
    return resolveShowdown(next);
  }

  const playersAbleToAct = next.players.filter((p) => !p.folded && !p.allIn && p.chips > 0);
  if (playersAbleToAct.length < 2) {
    return runoutToShowdown(next);
  }

  next.activePlayerIndex = nextActiveSeat(next.players, next.dealerIndex);
  return next;
}

function runoutToShowdown(state: PokerGameState): PokerGameState {
  let curr = state;
  while (curr.street !== 'SHOWDOWN') {
    if (curr.street === 'PREFLOP') {
      curr = {
        ...curr,
        street: 'FLOP',
        deck: curr.deck.slice(0, -3),
        communityCards: [...curr.communityCards, ...curr.deck.slice(-3).reverse()],
      };
    } else if (curr.street === 'FLOP') {
      curr = {
        ...curr,
        street: 'TURN',
        deck: curr.deck.slice(0, -1),
        communityCards: [...curr.communityCards, curr.deck[curr.deck.length - 1]],
      };
    } else if (curr.street === 'TURN') {
      curr = {
        ...curr,
        street: 'RIVER',
        deck: curr.deck.slice(0, -1),
        communityCards: [...curr.communityCards, curr.deck[curr.deck.length - 1]],
      };
    } else {
      return resolveShowdown(curr);
    }
  }
  return resolveShowdown(curr);
}

function isBettingRoundComplete(players: PokerPlayerState[], currentBet: number): boolean {
  const nonFolded = players.filter((p) => !p.folded);
  if (nonFolded.length <= 1) return true;
  const active = nonFolded.filter((p) => !p.allIn && p.chips > 0);
  if (active.length === 0) return true;
  return active.every((p) => p.hasActedThisStreet && p.currentBet === currentBet);
}

export function applyPokerAction(
  state: PokerGameState,
  playerId: string,
  action: PokerAction
): PokerGameState {
  if (state.finished || state.activePlayerIndex < 0) return state;
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer || activePlayer.id !== playerId) {
    throw new Error('Not your turn to act.');
  }

  const next: PokerGameState = {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    actionLog: [...state.actionLog],
  };

  const p = next.players[next.activePlayerIndex];
  const toCall = Math.max(0, next.currentBet - p.currentBet);

  if (action.type === 'fold') {
    p.folded = true;
    p.hasActedThisStreet = true;
    p.lastAction = 'Fold';
    next.actionLog.push(`${p.name} folded.`);
  } else if (action.type === 'check') {
    if (toCall > 0) {
      throw new Error('Cannot check when facing a bet.');
    }
    p.hasActedThisStreet = true;
    p.lastAction = 'Check';
    next.actionLog.push(`${p.name} checked.`);
  } else if (action.type === 'call') {
    const paid = Math.min(p.chips, toCall);
    p.chips -= paid;
    p.currentBet += paid;
    p.totalCommitted += paid;
    next.pot += paid;
    if (p.chips === 0) p.allIn = true;
    p.hasActedThisStreet = true;
    p.lastAction = p.allIn ? 'All-In' : paid === 0 ? 'Check' : `Call $${paid}`;
    next.actionLog.push(`${p.name} ${paid === 0 ? 'checked' : `called $${paid}`}.`);
  } else if (action.type === 'raise') {
    const maxPossibleTotal = p.currentBet + p.chips;
    const minValidTotal = Math.min(maxPossibleTotal, next.currentBet + next.minRaise);
    const targetTotal = Math.max(minValidTotal, Math.min(maxPossibleTotal, Math.floor(action.amount)));
    const added = targetTotal - p.currentBet;
    if (added <= 0) {
      throw new Error('Invalid raise amount.');
    }
    const raiseDelta = targetTotal - next.currentBet;
    if (raiseDelta >= next.minRaise) {
      next.minRaise = raiseDelta;
    }
    p.chips -= added;
    p.currentBet = targetTotal;
    p.totalCommitted += added;
    next.pot += added;
    if (p.chips === 0) p.allIn = true;
    p.hasActedThisStreet = true;

    if (targetTotal > next.currentBet) {
      next.currentBet = targetTotal;
      for (let i = 0; i < next.players.length; i++) {
        if (i !== next.activePlayerIndex && !next.players[i].folded && !next.players[i].allIn) {
          next.players[i].hasActedThisStreet = false;
        }
      }
    }
    p.lastAction = p.allIn ? `All-In $${targetTotal}` : `Raise $${targetTotal}`;
    next.actionLog.push(`${p.name} raised to $${targetTotal}.`);
  }

  const remaining = next.players.filter((pl) => !pl.folded);
  if (remaining.length === 1) {
    return resolveShowdown(next);
  }

  if (isBettingRoundComplete(next.players, next.currentBet)) {
    return advanceStreet(next);
  }

  const nextIdx = nextActiveSeat(next.players, next.activePlayerIndex);
  if (nextIdx === -1) {
    return runoutToShowdown(next);
  }
  next.activePlayerIndex = nextIdx;
  return next;
}

export function decidePokerBotAction(
  state: PokerGameState,
  botId: string,
  rng: () => number = Math.random
): PokerAction {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'fold' };

  const toCall = Math.max(0, state.currentBet - bot.currentBet);
  const roll = rng();

  // Hand strength estimate 0..1
  let strength = 0.35;
  if (state.street === 'PREFLOP' && bot.holeCards.length === 2) {
    const [c1, c2] = bot.holeCards;
    const high = Math.max(c1.rank, c2.rank);
    const low = Math.min(c1.rank, c2.rank);
    const isPair = c1.rank === c2.rank;
    const isSuited = c1.suit === c2.suit;
    strength = 0.2 + (high / 14) * 0.25 + (low / 14) * 0.12;
    if (isPair) strength += 0.25 + (high / 14) * 0.15;
    if (isSuited) strength += 0.06;
    if (Math.abs(c1.rank - c2.rank) <= 2) strength += 0.04;
  } else {
    const ev = evaluatePokerHand([...bot.holeCards, ...state.communityCards]);
    strength = Math.min(0.98, 0.22 + ev.category * 0.12 + (ev.tiebreakers[0] ?? 7) / 140);
  }

  if (toCall === 0) {
    if ((strength > 0.62 || roll < 0.12) && bot.chips > state.bigBlind) {
      const raiseTarget = Math.min(
        bot.currentBet + bot.chips,
        state.currentBet + Math.max(state.minRaise, Math.round(state.pot * 0.5 / 10) * 10 || state.bigBlind)
      );
      return { type: 'raise', amount: raiseTarget };
    }
    return { type: 'check' };
  }

  const potOdds = toCall / Math.max(1, state.pot + toCall);
  if (strength < potOdds * 0.9 && toCall > state.bigBlind * 2 && roll > 0.14) {
    return { type: 'fold' };
  }

  if (strength > 0.76 && bot.chips > toCall + state.minRaise && roll < 0.45) {
    const raiseTarget = Math.min(
      bot.currentBet + bot.chips,
      state.currentBet + Math.max(state.minRaise, state.bigBlind * 2)
    );
    return { type: 'raise', amount: raiseTarget };
  }

  return { type: 'call' };
}

export function sanitizePokerState(
  state: PokerGameState,
  viewerId: string
): SanitizedPokerState {
  const revealAll = state.street === 'SHOWDOWN' || state.finished;
  return {
    gameType: 'poker',
    handNumber: state.handNumber,
    deckCount: state.deckCount,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    dealerIndex: state.dealerIndex,
    street: state.street,
    pot: state.pot,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    activePlayerIndex: state.activePlayerIndex,
    deckRemaining: state.deck.length,
    communityCards: state.communityCards,
    players: state.players.map((p) => {
      const showCards = revealAll || p.id === viewerId;
      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        chips: p.chips,
        holeCards: showCards ? p.holeCards : [],
        cardCount: p.holeCards.length,
        currentBet: p.currentBet,
        totalCommitted: p.totalCommitted,
        folded: p.folded,
        allIn: p.allIn,
        hasActedThisStreet: p.hasActedThisStreet,
        lastAction: p.lastAction,
        bestHandName: p.bestHandName,
      };
    }),
    winners: state.winners,
    actionLog: state.actionLog.slice(-12),
    finished: state.finished,
  };
}

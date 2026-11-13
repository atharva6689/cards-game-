import { BOT_NAMES, createMultiDeck, formatRank, shuffleCards, suitSymbol } from './deck';
import type {
  Card,
  LobbyPlayer,
  SanitizedSevensState,
  SevensAction,
  SevensGameState,
  SevensPlayerState,
  SevensRoundSummary,
  SevensSuitLane,
  Suit,
} from './types';

export function sevensRankValue(rank: Card['rank']): number {
  return rank === 14 ? 1 : rank; // Ace is 1 (low), King is 13 (high)
}

export function cardSevensPoints(card: Card): number {
  return sevensRankValue(card.rank);
}

export function isCardPlayableInSevens(
  card: Card,
  lanes: Record<Suit, SevensSuitLane>,
  mustPlaySevenHearts: boolean,
  deckCount: number
): boolean {
  if (mustPlaySevenHearts) {
    return card.suit === 'hearts' && card.rank === 7;
  }

  const lane = lanes[card.suit];
  const val = sevensRankValue(card.rank);

  if (lane.low === null || lane.high === null) {
    return val === 7;
  }

  if (val === lane.low - 1 || val === lane.high + 1) {
    return true;
  }

  // In multi-deck Sevens, duplicate ranks already inside [low..high] can also be laid down
  if (deckCount > 1 && val >= lane.low && val <= lane.high) {
    return true;
  }

  return false;
}

export function getPlayableSevensCards(
  hand: Card[],
  lanes: Record<Suit, SevensSuitLane>,
  mustPlaySevenHearts: boolean,
  deckCount: number
): Card[] {
  return hand.filter((c) => isCardPlayableInSevens(c, lanes, mustPlaySevenHearts, deckCount));
}

export function buildSevensPlayers(humans: LobbyPlayer[], botCount: number): SevensPlayerState[] {
  const players: SevensPlayerState[] = humans.map((h) => ({
    id: h.id,
    name: h.name,
    isBot: false,
    hand: [],
    score: 0,
  }));

  const safeBots = Math.max(0, Math.min(9, botCount));
  for (let i = 0; i < safeBots; i++) {
    players.push({
      id: `bot-${i + 1}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      hand: [],
      score: 0,
    });
  }
  return players;
}

export function createSevensRound(
  existingPlayers: SevensPlayerState[],
  options: {
    roundNumber: number;
    deckCount: number;
    rng?: () => number;
  }
): SevensGameState {
  const deckCount = Math.max(1, Math.min(4, options.deckCount));
  const deck = shuffleCards(createMultiDeck(deckCount), options.rng);

  const players: SevensPlayerState[] = existingPlayers.map((p) => ({
    ...p,
    hand: [],
    lastAction: undefined,
  }));

  let idx = 0;
  while (deck.length > 0) {
    players[idx % players.length].hand.push(deck.pop()!);
    idx++;
  }

  // Player holding 7 of Hearts starts
  const starterIdx = players.findIndex((p) =>
    p.hand.some((c) => c.suit === 'hearts' && c.rank === 7)
  );
  const activePlayerIndex = starterIdx >= 0 ? starterIdx : 0;

  return {
    gameType: 'sevens',
    roundNumber: options.roundNumber,
    deckCount,
    phase: 'PLAYING',
    activePlayerIndex,
    mustPlaySevenHearts: starterIdx >= 0,
    lanes: {
      spades: { low: null, high: null, cards: [] },
      hearts: { low: null, high: null, cards: [] },
      diamonds: { low: null, high: null, cards: [] },
      clubs: { low: null, high: null, cards: [] },
    },
    players,
    summary: null,
    actionLog: [
      `Round #${options.roundNumber} dealt (${deckCount} deck${deckCount > 1 ? 's' : ''}). ${players[activePlayerIndex].name} opens with 7♥.`,
    ],
  };
}

export function applySevensAction(
  state: SevensGameState,
  playerId: string,
  action: SevensAction
): SevensGameState {
  if (state.phase === 'ROUND_OVER') return state;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) {
    throw new Error('Not your turn to act.');
  }

  const next: SevensGameState = {
    ...state,
    lanes: {
      spades: { ...state.lanes.spades, cards: [...state.lanes.spades.cards] },
      hearts: { ...state.lanes.hearts, cards: [...state.lanes.hearts.cards] },
      diamonds: { ...state.lanes.diamonds, cards: [...state.lanes.diamonds.cards] },
      clubs: { ...state.lanes.clubs, cards: [...state.lanes.clubs.cards] },
    },
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    actionLog: [...state.actionLog],
  };

  const player = next.players[next.activePlayerIndex];
  const playable = getPlayableSevensCards(
    player.hand,
    next.lanes,
    next.mustPlaySevenHearts,
    next.deckCount
  );

  if (action.type === 'pass') {
    if (playable.length > 0) {
      throw new Error('You have a playable card and cannot pass.');
    }
    player.lastAction = 'Passed';
    next.actionLog.push(`${player.name} passed.`);
    next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
    return next;
  }

  const cardIdx = player.hand.findIndex((c) => c.id === action.cardId);
  if (cardIdx === -1) throw new Error('Card not found in your hand.');
  const card = player.hand[cardIdx];

  if (!isCardPlayableInSevens(card, next.lanes, next.mustPlaySevenHearts, next.deckCount)) {
    throw new Error('That card cannot be played on the board right now.');
  }

  player.hand.splice(cardIdx, 1);
  const lane = next.lanes[card.suit];
  const val = sevensRankValue(card.rank);

  if (lane.low === null || lane.high === null) {
    lane.low = 7;
    lane.high = 7;
  } else {
    if (val < lane.low) lane.low = val;
    if (val > lane.high) lane.high = val;
  }
  lane.cards.push(card);
  lane.cards.sort((a, b) => sevensRankValue(a.rank) - sevensRankValue(b.rank));

  next.mustPlaySevenHearts = false;
  player.lastAction = `Played ${formatRank(card.rank)}${suitSymbol(card.suit)}`;
  next.actionLog.push(`${player.name} played ${formatRank(card.rank)}${suitSymbol(card.suit)}.`);

  if (player.hand.length === 0) {
    next.phase = 'ROUND_OVER';
    const standings = next.players.map((p) => {
      const roundPts = p.hand.reduce((sum, c) => sum + cardSevensPoints(c), 0);
      p.score += roundPts;
      return {
        playerId: p.id,
        playerName: p.name,
        roundPoints: roundPts,
        totalScore: p.score,
        cardsLeft: p.hand.length,
      };
    });
    standings.sort((a, b) => a.roundPoints - b.roundPoints || a.totalScore - b.totalScore);
    const summary: SevensRoundSummary = {
      winnerId: player.id,
      winnerName: player.name,
      standings,
    };
    next.summary = summary;
    next.actionLog.push(`${player.name} emptied their hand and won Round #${next.roundNumber}!`);
    return next;
  }

  next.activePlayerIndex = (next.activePlayerIndex + 1) % next.players.length;
  return next;
}

export function decideSevensBotAction(state: SevensGameState, botId: string): SevensAction {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'pass' };
  const playable = getPlayableSevensCards(
    bot.hand,
    state.lanes,
    state.mustPlaySevenHearts,
    state.deckCount
  );
  if (playable.length === 0) return { type: 'pass' };

  // Prefer playing extreme cards (closest to A or K) to unload high points and avoid unblocking middle cards for opponents
  const ranked = [...playable].sort((a, b) => {
    const distA = Math.abs(sevensRankValue(a.rank) - 7);
    const distB = Math.abs(sevensRankValue(b.rank) - 7);
    return distB - distA;
  });
  return { type: 'play', cardId: ranked[0].id };
}

export function sanitizeSevensState(
  state: SevensGameState,
  viewerId: string
): SanitizedSevensState {
  const revealAll = state.phase === 'ROUND_OVER';
  return {
    gameType: 'sevens',
    roundNumber: state.roundNumber,
    deckCount: state.deckCount,
    phase: state.phase,
    activePlayerIndex: state.activePlayerIndex,
    mustPlaySevenHearts: state.mustPlaySevenHearts,
    lanes: state.lanes,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: revealAll || p.id === viewerId ? p.hand : [],
      cardCount: p.hand.length,
      score: p.score,
      lastAction: p.lastAction,
    })),
    summary: state.summary,
    actionLog: state.actionLog.slice(-12),
  };
}

import { BOT_NAMES } from './deck';
import type {
  LobbyPlayer,
  SanitizedUnoState,
  UnoAction,
  UnoCard,
  UnoColor,
  UnoGameState,
  UnoPlayerState,
  UnoRoundSummary,
  UnoValue,
} from './types';

const UNO_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
const NUMBER_VALUES: UnoValue[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ACTION_VALUES: UnoValue[] = ['skip', 'reverse', 'draw2'];

export function createUnoDeck(deckCount: number): UnoCard[] {
  const safeCount = Math.max(1, Math.min(4, Math.floor(deckCount)));
  const cards: UnoCard[] = [];
  for (let d = 1; d <= safeCount; d++) {
    for (const color of UNO_COLORS) {
      cards.push({ id: `u${d}-${color}-0-a`, color, value: '0', deckIndex: d });
      for (const val of NUMBER_VALUES) {
        cards.push({ id: `u${d}-${color}-${val}-a`, color, value: val, deckIndex: d });
        cards.push({ id: `u${d}-${color}-${val}-b`, color, value: val, deckIndex: d });
      }
      for (const val of ACTION_VALUES) {
        cards.push({ id: `u${d}-${color}-${val}-a`, color, value: val, deckIndex: d });
        cards.push({ id: `u${d}-${color}-${val}-b`, color, value: val, deckIndex: d });
      }
    }
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `u${d}-wild-${i}`, color: 'wild', value: 'wild', deckIndex: d });
      cards.push({ id: `u${d}-wild4-${i}`, color: 'wild', value: 'wild4', deckIndex: d });
    }
  }
  return cards;
}

function shuffleUno(cards: UnoCard[], rng: () => number = Math.random): UnoCard[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function cardUnoPoints(card: UnoCard): number {
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20;
  return Number(card.value) || 0;
}

export function isUnoCardPlayable(
  card: UnoCard,
  topDiscard: UnoCard,
  activeColor: UnoColor
): boolean {
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.value === topDiscard.value) return true;
  return false;
}

export function buildUnoPlayers(humans: LobbyPlayer[], botCount: number): UnoPlayerState[] {
  const players: UnoPlayerState[] = humans.map((h) => ({
    id: h.id,
    name: h.name,
    isBot: false,
    hand: [],
    calledUno: false,
    score: 0,
  }));

  const safeBots = Math.max(0, Math.min(9, botCount));
  for (let i = 0; i < safeBots; i++) {
    players.push({
      id: `bot-${i + 1}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      hand: [],
      calledUno: false,
      score: 0,
    });
  }
  return players;
}

export function createUnoRound(
  existingPlayers: UnoPlayerState[],
  options: {
    roundNumber: number;
    deckCount: number;
    startingPlayerIndex?: number;
    rng?: () => number;
  }
): UnoGameState {
  const deckCount = Math.max(1, Math.min(4, options.deckCount));
  const drawPile = shuffleUno(createUnoDeck(deckCount), options.rng);

  const players: UnoPlayerState[] = existingPlayers.map((p) => ({
    ...p,
    hand: [],
    calledUno: false,
    lastAction: undefined,
  }));

  for (let c = 0; c < 7; c++) {
    for (const p of players) {
      p.hand.push(drawPile.pop()!);
    }
  }

  // Flip first non-wild card to start
  let starterCard = drawPile.pop()!;
  while (starterCard.color === 'wild' && drawPile.length > 0) {
    drawPile.unshift(starterCard);
    starterCard = drawPile.pop()!;
  }
  const activeColor: UnoColor =
    starterCard.color === 'wild' ? 'red' : starterCard.color;

  return {
    gameType: 'uno',
    roundNumber: options.roundNumber,
    deckCount,
    phase: 'PLAYING',
    direction: 1,
    activePlayerIndex: (options.startingPlayerIndex ?? 0) % players.length,
    activeColor,
    drawPile,
    discardPile: [starterCard],
    drawnPlayableCardId: null,
    players,
    summary: null,
    actionLog: [
      `UNO Round #${options.roundNumber} dealt (${deckCount} deck${deckCount > 1 ? 's' : ''}). Opening card: ${activeColor.toUpperCase()} ${starterCard.value.toUpperCase()}.`,
    ],
  };
}

function drawCardsIntoHand(
  state: UnoGameState,
  targetPlayer: UnoPlayerState,
  count: number,
  rng: () => number
): UnoCard[] {
  const drawn: UnoCard[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length <= 1) break;
      const top = state.discardPile.pop()!;
      state.drawPile = shuffleUno(state.discardPile, rng);
      state.discardPile = [top];
      state.actionLog.push('UNO discard pile reshuffled into draw deck.');
    }
    const card = state.drawPile.pop();
    if (!card) break;
    targetPlayer.hand.push(card);
    targetPlayer.calledUno = false;
    drawn.push(card);
  }
  return drawn;
}

function stepSeat(current: number, direction: 1 | -1, total: number, steps = 1): number {
  return (((current + direction * steps) % total) + total) % total;
}

export function applyUnoAction(
  state: UnoGameState,
  playerId: string,
  action: UnoAction,
  rng: () => number = Math.random
): UnoGameState {
  if (state.phase === 'ROUND_OVER') return state;

  const next: UnoGameState = {
    ...state,
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    actionLog: [...state.actionLog],
  };

  if (action.type === 'call_uno') {
    const caller = next.players.find((p) => p.id === playerId);
    if (!caller) throw new Error('Player not found.');
    if (caller.hand.length > 2) {
      throw new Error('You can call UNO when you have 1 or 2 cards left.');
    }
    caller.calledUno = true;
    caller.lastAction = 'UNO!';
    next.actionLog.push(`${caller.name} shouted UNO!`);
    return next;
  }

  if (action.type === 'catch_uno') {
    const target = next.players.find((p) => p.id === action.targetPlayerId);
    const catcher = next.players.find((p) => p.id === playerId);
    if (!target || !catcher) throw new Error('Target not found.');
    if (target.hand.length === 1 && !target.calledUno) {
      drawCardsIntoHand(next, target, 2, rng);
      target.lastAction = 'Caught! +2';
      next.actionLog.push(`${catcher.name} caught ${target.name} without UNO (+2 cards)!`);
    }
    return next;
  }

  const player = next.players[next.activePlayerIndex];
  if (!player || player.id !== playerId) {
    throw new Error('Not your turn to act.');
  }

  const topDiscard = next.discardPile[next.discardPile.length - 1];

  if (action.type === 'pass_after_draw') {
    if (!next.drawnPlayableCardId) {
      throw new Error('Draw a card first.');
    }
    next.drawnPlayableCardId = null;
    player.lastAction = 'Drew & kept';
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, next.players.length, 1);
    return next;
  }

  if (action.type === 'draw') {
    if (next.drawnPlayableCardId) {
      throw new Error('You already drew a playable card this turn.');
    }
    const [drawn] = drawCardsIntoHand(next, player, 1, rng);
    if (!drawn) {
      next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, next.players.length, 1);
      return next;
    }

    if (isUnoCardPlayable(drawn, topDiscard, next.activeColor)) {
      next.drawnPlayableCardId = drawn.id;
      player.lastAction = 'Drew playable';
      next.actionLog.push(`${player.name} drew a playable card.`);
      return next;
    }

    player.lastAction = 'Drew 1';
    next.actionLog.push(`${player.name} drew 1 card.`);
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, next.players.length, 1);
    return next;
  }

  // PLAY
  const cardIdx = player.hand.findIndex((c) => c.id === action.cardId);
  if (cardIdx === -1) throw new Error('Card not in your hand.');
  const card = player.hand[cardIdx];

  if (next.drawnPlayableCardId && card.id !== next.drawnPlayableCardId) {
    throw new Error('After drawing, you may only play the drawn card or Pass.');
  }

  if (!isUnoCardPlayable(card, topDiscard, next.activeColor)) {
    throw new Error('That card does not match the active color or value.');
  }

  player.hand.splice(cardIdx, 1);
  next.discardPile.push(card);
  next.drawnPlayableCardId = null;

  if (card.color === 'wild') {
    next.activeColor = action.chosenColor && UNO_COLORS.includes(action.chosenColor) ? action.chosenColor : 'red';
  } else {
    next.activeColor = card.color;
  }

  if (player.hand.length !== 1) {
    player.calledUno = false;
  }

  const n = next.players.length;
  player.lastAction = `${card.color === 'wild' ? next.activeColor.toUpperCase() : card.color.toUpperCase()} ${card.value.toUpperCase()}`;
  next.actionLog.push(`${player.name} played ${player.lastAction}.`);

  // Check round win
  if (player.hand.length === 0) {
    next.phase = 'ROUND_OVER';
    let pointsWon = 0;
    const standings = next.players.map((p) => {
      const handPts = p.hand.reduce((sum, c) => sum + cardUnoPoints(c), 0);
      if (p.id !== player.id) pointsWon += handPts;
      return {
        playerId: p.id,
        playerName: p.name,
        handPoints: handPts,
        totalScore: p.score,
        cardsLeft: p.hand.length,
      };
    });
    player.score += pointsWon;
    const winnerRow = standings.find((s) => s.playerId === player.id)!;
    winnerRow.totalScore = player.score;
    standings.sort((a, b) => a.cardsLeft - b.cardsLeft || b.totalScore - a.totalScore);

    const summary: UnoRoundSummary = {
      winnerId: player.id,
      winnerName: player.name,
      pointsWon,
      standings,
    };
    next.summary = summary;
    next.actionLog.push(`${player.name} won UNO Round #${next.roundNumber} (+${pointsWon} pts)!`);
    return next;
  }

  // Apply special card effects
  if (card.value === 'reverse') {
    if (n === 2) {
      // Official 2-player UNO: Reverse acts as Skip
      next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 2);
    } else {
      next.direction = next.direction === 1 ? -1 : 1;
      next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 1);
    }
  } else if (card.value === 'skip') {
    const skipped = next.players[stepSeat(next.activePlayerIndex, next.direction, n, 1)];
    skipped.lastAction = 'Skipped';
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 2);
  } else if (card.value === 'draw2') {
    const victim = next.players[stepSeat(next.activePlayerIndex, next.direction, n, 1)];
    drawCardsIntoHand(next, victim, 2, rng);
    victim.lastAction = '+2 Skipped';
    next.actionLog.push(`${victim.name} drew 2 cards and was skipped.`);
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 2);
  } else if (card.value === 'wild4') {
    const victim = next.players[stepSeat(next.activePlayerIndex, next.direction, n, 1)];
    drawCardsIntoHand(next, victim, 4, rng);
    victim.lastAction = '+4 Skipped';
    next.actionLog.push(`${victim.name} drew 4 cards and was skipped.`);
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 2);
  } else {
    next.activePlayerIndex = stepSeat(next.activePlayerIndex, next.direction, n, 1);
  }

  return next;
}

export function decideUnoBotAction(state: UnoGameState, botId: string): UnoAction {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'draw' };

  const top = state.discardPile[state.discardPile.length - 1];

  if (state.drawnPlayableCardId) {
    const drawn = bot.hand.find((c) => c.id === state.drawnPlayableCardId);
    if (drawn && isUnoCardPlayable(drawn, top, state.activeColor)) {
      const bestColor = pickBestColorForHand(bot.hand);
      return { type: 'play', cardId: drawn.id, chosenColor: bestColor };
    }
    return { type: 'pass_after_draw' };
  }

  const playable = bot.hand.filter((c) => isUnoCardPlayable(c, top, state.activeColor));
  if (playable.length === 0) {
    return { type: 'draw' };
  }

  // Prefer colored cards before wilds, and highest point value first
  const sorted = [...playable].sort((a, b) => {
    const wildA = a.color === 'wild' ? 1 : 0;
    const wildB = b.color === 'wild' ? 1 : 0;
    if (wildA !== wildB) return wildA - wildB;
    return cardUnoPoints(b) - cardUnoPoints(a);
  });

  // Auto-mark UNO when bot drops to 1 card
  if (bot.hand.length === 2) {
    bot.calledUno = true;
  }

  return {
    type: 'play',
    cardId: sorted[0].id,
    chosenColor: pickBestColorForHand(bot.hand),
  };
}

function pickBestColorForHand(hand: UnoCard[]): UnoColor {
  const counts: Record<UnoColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) {
    if (c.color !== 'wild') counts[c.color]++;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as UnoColor) || 'red';
}

export function sanitizeUnoState(
  state: UnoGameState,
  viewerId: string
): SanitizedUnoState {
  const revealAll = state.phase === 'ROUND_OVER';
  return {
    gameType: 'uno',
    roundNumber: state.roundNumber,
    deckCount: state.deckCount,
    phase: state.phase,
    direction: state.direction,
    activePlayerIndex: state.activePlayerIndex,
    activeColor: state.activeColor,
    drawPileCount: state.drawPile.length,
    discardPile: state.discardPile,
    drawnPlayableCardId: state.drawnPlayableCardId,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: revealAll || p.id === viewerId ? p.hand : [],
      cardCount: p.hand.length,
      calledUno: p.calledUno,
      score: p.score,
      lastAction: p.lastAction,
    })),
    summary: state.summary,
    actionLog: state.actionLog.slice(-12),
  };
}

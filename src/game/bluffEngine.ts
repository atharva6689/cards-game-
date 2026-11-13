import { BOT_NAMES, createMultiDeck, formatRank, shuffleCards } from './deck';
import type {
  BluffAction,
  BluffGameState,
  BluffPlayerState,
  LobbyPlayer,
  Rank,
  SanitizedBluffState,
} from './types';

export function buildBluffPlayers(humans: LobbyPlayer[], botCount: number): BluffPlayerState[] {
  const players: BluffPlayerState[] = humans.map((h) => ({
    id: h.id,
    name: h.name,
    isBot: false,
    hand: [],
    passedInCycle: false,
    score: 0,
  }));

  const safeBots = Math.max(0, Math.min(9, botCount));
  for (let i = 0; i < safeBots; i++) {
    players.push({
      id: `bot-${i + 1}`,
      name: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      hand: [],
      passedInCycle: false,
      score: 0,
    });
  }
  return players;
}

export function createBluffRound(
  existingPlayers: BluffPlayerState[],
  options: {
    roundNumber: number;
    deckCount: number;
    startingPlayerIndex?: number;
    rng?: () => number;
  }
): BluffGameState {
  const deckCount = Math.max(1, Math.min(4, options.deckCount));
  const deck = shuffleCards(createMultiDeck(deckCount), options.rng);
  const players: BluffPlayerState[] = existingPlayers.map((p) => ({
    ...p,
    hand: [],
    passedInCycle: false,
    lastAction: undefined,
  }));

  let idx = 0;
  while (deck.length > 0) {
    players[idx % players.length].hand.push(deck.pop()!);
    idx++;
  }

  return {
    gameType: 'bluff',
    roundNumber: options.roundNumber,
    deckCount,
    phase: 'PLAYING',
    activePlayerIndex: (options.startingPlayerIndex ?? 0) % players.length,
    pile: [],
    claimedRank: null,
    lastPlay: null,
    lastReveal: null,
    winnerId: null,
    winnerName: null,
    players,
    actionLog: [
      `Round #${options.roundNumber} dealt (${deckCount} deck${deckCount > 1 ? 's' : ''}). ${players[(options.startingPlayerIndex ?? 0) % players.length].name} leads.`,
    ],
  };
}

function findNextNonEmptyOrNonPassed(
  players: BluffPlayerState[],
  fromIndex: number,
  skipPassed: boolean
): number {
  const n = players.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (!skipPassed || !players[idx].passedInCycle) {
      return idx;
    }
  }
  return (fromIndex + 1) % n;
}

export function applyBluffAction(
  state: BluffGameState,
  playerId: string,
  action: BluffAction
): BluffGameState {
  if (state.phase === 'ROUND_OVER') return state;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== playerId) {
    throw new Error('Not your turn to act.');
  }

  const next: BluffGameState = {
    ...state,
    pile: [...state.pile],
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] })),
    actionLog: [...state.actionLog],
    lastReveal: state.lastReveal,
  };

  const player = next.players[next.activePlayerIndex];

  if (action.type === 'call_bluff') {
    if (!next.lastPlay) {
      throw new Error('There is no recent play to challenge.');
    }

    const accused = next.players.find((p) => p.id === next.lastPlay!.playerId)!;
    const claimed = next.lastPlay.claimedRank;
    const revealed = next.lastPlay.cards;
    const wasBluff = revealed.some((c) => c.rank !== claimed);
    const loser = wasBluff ? accused : player;
    const cardsPickedUp = next.pile.length;

    loser.hand.push(...next.pile);
    next.pile = [];
    next.lastReveal = {
      callerName: player.name,
      accusedName: accused.name,
      wasBluff,
      claimedRank: claimed,
      revealedCards: revealed,
      cardsPickedUp,
    };

    for (const p of next.players) {
      p.passedInCycle = false;
    }

    if (wasBluff) {
      player.lastAction = 'Caught a Bluff!';
      accused.lastAction = `Picked up ${cardsPickedUp}`;
      next.actionLog.push(
        `${player.name} called BLUFF on ${accused.name} — CAUGHT! ${accused.name} picked up ${cardsPickedUp} cards.`
      );
      next.activePlayerIndex = next.players.findIndex((p) => p.id === player.id);
    } else {
      player.lastAction = `Failed challenge (+${cardsPickedUp})`;
      accused.lastAction = 'Honest play!';
      next.actionLog.push(
        `${player.name} called BLUFF on ${accused.name} — FALSE CALL! ${player.name} picked up ${cardsPickedUp} cards.`
      );

      // If accused had emptied their hand on that honest play, they win immediately!
      if (accused.hand.length === 0) {
        next.phase = 'ROUND_OVER';
        next.winnerId = accused.id;
        next.winnerName = accused.name;
        accused.score += 1;
        next.lastPlay = null;
        next.claimedRank = null;
        next.actionLog.push(`${accused.name} won Round #${next.roundNumber}!`);
        return next;
      }

      next.activePlayerIndex = next.players.findIndex((p) => p.id === accused.id);
    }

    next.lastPlay = null;
    next.claimedRank = null;
    return next;
  }

  if (action.type === 'pass') {
    if (!next.lastPlay) {
      throw new Error('You are leading the table and must play at least 1 card.');
    }
    player.passedInCycle = true;
    player.lastAction = 'Passed';
    next.actionLog.push(`${player.name} passed.`);

    // If the leader had 0 cards and this next player didn't challenge, check if everyone else passed or leader is unchallenged
    const leaderIdx = next.players.findIndex((p) => p.id === next.lastPlay!.playerId);
    const everyoneElsePassed = next.players.every(
      (p, i) => i === leaderIdx || p.passedInCycle
    );

    if (everyoneElsePassed) {
      const leader = next.players[leaderIdx];
      if (leader.hand.length === 0) {
        next.phase = 'ROUND_OVER';
        next.winnerId = leader.id;
        next.winnerName = leader.name;
        leader.score += 1;
        next.actionLog.push(`${leader.name} won Round #${next.roundNumber}!`);
        return next;
      }
      // Clear pile and start fresh cycle with leader
      next.pile = [];
      next.claimedRank = null;
      next.lastPlay = null;
      for (const p of next.players) p.passedInCycle = false;
      next.activePlayerIndex = leaderIdx;
      next.actionLog.push(`Pile cleared. ${leader.name} leads a new rank.`);
      return next;
    }

    next.activePlayerIndex = findNextNonEmptyOrNonPassed(
      next.players,
      next.activePlayerIndex,
      true
    );
    return next;
  }

  // PLAY
  if (!action.cardIds || action.cardIds.length < 1 || action.cardIds.length > 4) {
    throw new Error('Select 1 to 4 cards to play.');
  }

  const chosenCards = action.cardIds
    .map((id) => player.hand.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (chosenCards.length !== action.cardIds.length) {
    throw new Error('Selected cards are not in your hand.');
  }

  // If the previous player emptied their hand and current player chose to play instead of calling bluff, previous player wins!
  if (next.lastPlay) {
    const prevLeader = next.players.find((p) => p.id === next.lastPlay!.playerId);
    if (prevLeader && prevLeader.hand.length === 0) {
      next.phase = 'ROUND_OVER';
      next.winnerId = prevLeader.id;
      next.winnerName = prevLeader.name;
      prevLeader.score += 1;
      next.actionLog.push(`${prevLeader.name} went unchallenged and won Round #${next.roundNumber}!`);
      return next;
    }
  }

  const claimedRank: Rank = next.claimedRank ?? action.claimedRank;
  const idSet = new Set(action.cardIds);
  player.hand = player.hand.filter((c) => !idSet.has(c.id));
  player.passedInCycle = false;
  next.pile.push(...chosenCards);
  next.claimedRank = claimedRank;
  next.lastReveal = null;
  next.lastPlay = {
    playerId: player.id,
    playerName: player.name,
    cards: chosenCards,
    count: chosenCards.length,
    claimedRank,
  };

  const rankWord = formatRank(claimedRank);
  player.lastAction = `Claimed ${chosenCards.length}× ${rankWord}`;
  next.actionLog.push(`${player.name} played ${chosenCards.length} card${chosenCards.length > 1 ? 's' : ''} claiming ${rankWord}.`);

  // If this play emptied the player's hand, give next player one chance to challenge or pass, UNLESS all others passed
  next.activePlayerIndex = findNextNonEmptyOrNonPassed(
    next.players,
    next.activePlayerIndex,
    false
  );
  return next;
}

export function decideBluffBotAction(
  state: BluffGameState,
  botId: string,
  rng: () => number = Math.random
): BluffAction {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return { type: 'pass' };

  // If previous player just emptied their hand, decide whether to challenge
  if (state.lastPlay) {
    const prevPlayer = state.players.find((p) => p.id === state.lastPlay!.playerId);
    const matchingInBotHand = bot.hand.filter((c) => c.rank === state.lastPlay!.claimedRank).length;
    const totalOfRankInGame = 4 * state.deckCount;
    const impossibleClaim = matchingInBotHand + state.lastPlay.count > totalOfRankInGame;

    if (impossibleClaim) {
      return { type: 'call_bluff' };
    }
    if (prevPlayer && prevPlayer.hand.length === 0) {
      return rng() < 0.65 ? { type: 'call_bluff' } : { type: 'pass' };
    }
    if (state.lastPlay.count >= 3 && rng() < 0.4) {
      return { type: 'call_bluff' };
    }
    if (rng() < 0.16) {
      return { type: 'call_bluff' };
    }
  }

  // Starting a fresh rank
  if (!state.claimedRank) {
    const counts = new Map<Rank, typeof bot.hand>();
    for (const c of bot.hand) {
      const list = counts.get(c.rank) ?? [];
      list.push(c);
      counts.set(c.rank, list);
    }
    const sortedGroups = Array.from(counts.entries()).sort((a, b) => b[1].length - a[1].length);
    const [bestRank, cards] = sortedGroups[0];
    const playCards = cards.slice(0, Math.min(4, cards.length));
    return {
      type: 'play',
      cardIds: playCards.map((c) => c.id),
      claimedRank: bestRank,
    };
  }

  // Continuing an existing claimedRank
  const matching = bot.hand.filter((c) => c.rank === state.claimedRank);
  if (matching.length > 0) {
    const playCards = matching.slice(0, Math.min(3, matching.length));
    return {
      type: 'play',
      cardIds: playCards.map((c) => c.id),
      claimedRank: state.claimedRank,
    };
  }

  // Bluff occasionally (especially when hand is small), otherwise pass
  if (rng() < 0.35 && bot.hand.length > 0) {
    const bluffCard = bot.hand[Math.floor(rng() * bot.hand.length)];
    return {
      type: 'play',
      cardIds: [bluffCard.id],
      claimedRank: state.claimedRank,
    };
  }

  return { type: 'pass' };
}

export function sanitizeBluffState(
  state: BluffGameState,
  viewerId: string
): SanitizedBluffState {
  const revealAll = state.phase === 'ROUND_OVER';
  return {
    gameType: 'bluff',
    roundNumber: state.roundNumber,
    deckCount: state.deckCount,
    phase: state.phase,
    activePlayerIndex: state.activePlayerIndex,
    pileCount: state.pile.length,
    claimedRank: state.claimedRank,
    lastPlay: state.lastPlay
      ? {
          playerId: state.lastPlay.playerId,
          playerName: state.lastPlay.playerName,
          count: state.lastPlay.count,
          claimedRank: state.lastPlay.claimedRank,
        }
      : null,
    lastReveal: state.lastReveal,
    winnerId: state.winnerId,
    winnerName: state.winnerName,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      hand: revealAll || p.id === viewerId ? p.hand : [],
      cardCount: p.hand.length,
      passedInCycle: p.passedInCycle,
      score: p.score,
      lastAction: p.lastAction,
    })),
    actionLog: state.actionLog.slice(-12),
  };
}

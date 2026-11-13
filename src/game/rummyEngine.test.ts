import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRummyAction,
  buildRummyPlayers,
  canLayOffCard,
  createRummyRound,
  decideRummyBotAction,
  findOptimalMelds,
  isValidRun,
  isValidSet,
} from './rummyEngine';
import type { Card, Rank, Suit } from './types';

function c(rank: Rank, suit: Suit, deckIndex = 1): Card {
  return { id: `d${deckIndex}-${suit}-${rank}`, rank, suit, deckIndex };
}

test('isValidSet validates 1-deck vs multi-deck sets accurately', () => {
  assert.equal(
    isValidSet([c(7, 'spades', 1), c(7, 'hearts', 1), c(7, 'clubs', 1)], 1),
    true
  );
  // Duplicate suit only allowed when deckCount >= 2
  assert.equal(
    isValidSet([c(7, 'spades', 1), c(7, 'spades', 2), c(7, 'clubs', 1)], 1),
    false
  );
  assert.equal(
    isValidSet([c(7, 'spades', 1), c(7, 'spades', 2), c(7, 'clubs', 1)], 2),
    true
  );
});

test('isValidRun validates low-ace and high-ace consecutive runs', () => {
  assert.equal(isValidRun([c(14, 'hearts'), c(2, 'hearts'), c(3, 'hearts')]), true);
  assert.equal(isValidRun([c(12, 'spades'), c(13, 'spades'), c(14, 'spades')]), true);
  assert.equal(isValidRun([c(13, 'spades'), c(14, 'spades'), c(2, 'spades')]), false);
  assert.equal(isValidRun([c(4, 'spades'), c(5, 'hearts'), c(6, 'spades')]), false);
});

test('findOptimalMelds minimizes deadwood across sets and runs', () => {
  const hand = [
    c(10, 'hearts'),
    c(11, 'hearts'),
    c(12, 'hearts'),
    c(5, 'spades'),
    c(5, 'clubs'),
    c(5, 'diamonds'),
    c(2, 'clubs'),
  ];
  const res = findOptimalMelds(hand, 1);
  assert.equal(res.melds.length, 2);
  assert.equal(res.deadwoodPoints, 2);
});

test('canLayOffCard extends an existing set or run', () => {
  const runMeld = {
    id: 'm1',
    type: 'run' as const,
    cards: [c(4, 'clubs'), c(5, 'clubs'), c(6, 'clubs')],
    ownerId: 'u1',
  };
  assert.equal(canLayOffCard(c(7, 'clubs'), runMeld, 1), true);
  assert.equal(canLayOffCard(c(3, 'clubs'), runMeld, 1), true);
  assert.equal(canLayOffCard(c(8, 'clubs'), runMeld, 1), false);
});

test('rummy round plays cleanly with bots and multi-deck stock', () => {
  const players = buildRummyPlayers(
    [{ id: 'u1', name: 'Host', isBot: false, connected: true, isHost: true, chips: 1000 }],
    2
  );
  let state = createRummyRound(players, { roundNumber: 1, deckCount: 2 });
  assert.equal(state.players.length, 3);
  assert.equal(state.cardsPerPlayer, 10);
  assert.equal(state.stock.length, 104 - 30 - 1);

  // Run 15 turns of bot/simulated actions to verify state transitions never crash
  for (let step = 0; step < 30 && state.phase !== 'ROUND_OVER'; step++) {
    const active = state.players[state.activePlayerIndex];
    const action = decideRummyBotAction(state, active.id);
    state = applyRummyAction(state, active.id, action);
  }
  assert.ok(['DRAW', 'MELD_OR_DISCARD', 'ROUND_OVER'].includes(state.phase));
});

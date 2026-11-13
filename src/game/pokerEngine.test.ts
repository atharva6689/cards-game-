import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiDeck } from './deck';
import {
  applyPokerAction,
  buildPokerPlayers,
  compareEvaluatedHands,
  createPokerHand,
  decidePokerBotAction,
  evaluatePokerHand,
} from './pokerEngine';
import type { Card, Rank, Suit } from './types';

function c(rank: Rank, suit: Suit, deckIndex = 1): Card {
  return { id: `d${deckIndex}-${suit}-${rank}`, rank, suit, deckIndex };
}

test('createMultiDeck creates exact 52 * deckCount unique cards', () => {
  assert.equal(createMultiDeck(1).length, 52);
  assert.equal(createMultiDeck(2).length, 104);
  assert.equal(createMultiDeck(4).length, 208);
  const ids = new Set(createMultiDeck(3).map((card) => card.id));
  assert.equal(ids.size, 156);
});

test('evaluatePokerHand ranks hands in proper order including wheel and five-of-a-kind', () => {
  const royal = evaluatePokerHand([
    c(14, 'spades'),
    c(13, 'spades'),
    c(12, 'spades'),
    c(11, 'spades'),
    c(10, 'spades'),
    c(2, 'hearts'),
    c(3, 'clubs'),
  ]);
  const fiveKind = evaluatePokerHand([
    c(9, 'spades', 1),
    c(9, 'hearts', 1),
    c(9, 'diamonds', 1),
    c(9, 'clubs', 1),
    c(9, 'spades', 2),
    c(2, 'clubs', 1),
    c(3, 'diamonds', 1),
  ]);
  const wheel = evaluatePokerHand([
    c(14, 'hearts'),
    c(2, 'clubs'),
    c(3, 'diamonds'),
    c(4, 'spades'),
    c(5, 'hearts'),
    c(9, 'clubs'),
    c(12, 'spades'),
  ]);
  const fullHouse = evaluatePokerHand([
    c(13, 'spades'),
    c(13, 'hearts'),
    c(13, 'diamonds'),
    c(7, 'clubs'),
    c(7, 'spades'),
    c(2, 'hearts'),
    c(4, 'clubs'),
  ]);

  assert.equal(royal.name, 'Royal Flush');
  assert.equal(fiveKind.category, 9);
  assert.equal(wheel.category, 4);
  assert.equal(wheel.tiebreakers[0], 5);
  assert.ok(compareEvaluatedHands(fiveKind, royal) > 0);
  assert.ok(compareEvaluatedHands(royal, fullHouse) > 0);
  assert.ok(compareEvaluatedHands(fullHouse, wheel) > 0);
});

test('poker hand progresses from preflop fold to winner payout conserving chips', () => {
  const players = buildPokerPlayers(
    [{ id: 'u1', name: 'Alice', isBot: false, connected: true, isHost: true, chips: 1000 }],
    2,
    1000
  );
  let state = createPokerHand(players, {
    handNumber: 1,
    deckCount: 2,
    dealerIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
  });

  const totalStart = state.players.reduce((s, p) => s + p.chips, 0) + state.pot;
  assert.equal(totalStart, 3000);
  assert.equal(state.deckCount, 2);

  // Two players fold, remaining wins
  while (!state.finished) {
    const active = state.players[state.activePlayerIndex];
    state = applyPokerAction(state, active.id, { type: 'fold' });
  }

  assert.equal(state.street, 'SHOWDOWN');
  assert.equal(state.winners.length, 1);
  const totalEnd = state.players.reduce((s, p) => s + p.chips, 0);
  assert.equal(totalEnd, 3000);
});

test('poker full street runout through showdown preserves total chips', () => {
  const players = buildPokerPlayers(
    [{ id: 'u1', name: 'Alice', isBot: false, connected: true, isHost: true, chips: 1000 }],
    3,
    1000
  );
  let state = createPokerHand(players, {
    handNumber: 1,
    deckCount: 1,
    dealerIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
  });

  let guard = 0;
  while (!state.finished && guard < 100) {
    guard++;
    const active = state.players[state.activePlayerIndex];
    const action = active.isBot
      ? decidePokerBotAction(state, active.id, () => 0.5)
      : state.currentBet > active.currentBet
        ? { type: 'call' as const }
        : { type: 'check' as const };
    state = applyPokerAction(state, active.id, action);
  }

  assert.equal(state.finished, true);
  assert.ok(state.winners.length >= 1);
  const totalEnd = state.players.reduce((s, p) => s + p.chips, 0);
  assert.equal(totalEnd, 4000);
});

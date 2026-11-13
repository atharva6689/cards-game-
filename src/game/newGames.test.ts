import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBluffAction,
  buildBluffPlayers,
  createBluffRound,
  decideBluffBotAction,
} from './bluffEngine';
import {
  applySevensAction,
  buildSevensPlayers,
  createSevensRound,
  decideSevensBotAction,
  isCardPlayableInSevens,
} from './sevensEngine';
import {
  applyUnoAction,
  buildUnoPlayers,
  createUnoDeck,
  createUnoRound,
  decideUnoBotAction,
  isUnoCardPlayable,
} from './unoEngine';
import type { LobbyPlayer } from './types';

const HOST: LobbyPlayer = {
  id: 'u1',
  name: 'Banana',
  isBot: false,
  connected: true,
  isHost: true,
  chips: 1000,
};

test('Sevens / Badam Satti opens with 7 of Hearts and completes a bot round', () => {
  const players = buildSevensPlayers([HOST], 3);
  let state = createSevensRound(players, { roundNumber: 1, deckCount: 1 });

  const starter = state.players[state.activePlayerIndex];
  const sevenHearts = starter.hand.find((c) => c.suit === 'hearts' && c.rank === 7);
  assert.ok(sevenHearts);
  assert.equal(state.mustPlaySevenHearts, true);
  assert.equal(
    isCardPlayableInSevens(sevenHearts!, state.lanes, state.mustPlaySevenHearts, 1),
    true
  );

  // Full game simulation with bots finishes cleanly
  let guard = 0;
  while (state.phase === 'PLAYING' && guard < 400) {
    guard++;
    const curr = state.players[state.activePlayerIndex];
    const action = decideSevensBotAction(state, curr.id);
    state = applySevensAction(state, curr.id, action);
  }
  assert.equal(state.phase, 'ROUND_OVER');
  assert.ok(state.summary?.winnerId);
});

test('Bluff Master catches a bluff and awards pile to the bluffer', () => {
  const players = buildBluffPlayers([HOST], 2);
  let state = createBluffRound(players, { roundNumber: 1, deckCount: 1 });

  const p0 = state.players[0];
  const nonAce = p0.hand.find((c) => c.rank !== 14)!;
  // P0 lies and claims Ace
  state = applyBluffAction(state, p0.id, {
    type: 'play',
    cardIds: [nonAce.id],
    claimedRank: 14,
  });

  assert.equal(state.pile.length, 1);
  assert.equal(state.claimedRank, 14);

  const p1 = state.players[state.activePlayerIndex];
  const p0CountBefore = state.players[0].hand.length;
  state = applyBluffAction(state, p1.id, { type: 'call_bluff' });

  assert.equal(state.lastReveal?.wasBluff, true);
  assert.equal(state.pile.length, 0);
  assert.equal(state.players[0].hand.length, p0CountBefore + 1);
});

test('Bluff Master runs cleanly with bot decisions', () => {
  const players = buildBluffPlayers([HOST], 3);
  let state = createBluffRound(players, { roundNumber: 1, deckCount: 2 });
  for (let i = 0; i < 40 && state.phase === 'PLAYING'; i++) {
    const curr = state.players[state.activePlayerIndex];
    const action = decideBluffBotAction(state, curr.id, () => 0.5);
    state = applyBluffAction(state, curr.id, action);
  }
  assert.ok(['PLAYING', 'ROUND_OVER'].includes(state.phase));
});

test('UNO deck has 108 * deckCount cards and special actions work', () => {
  assert.equal(createUnoDeck(1).length, 108);
  assert.equal(createUnoDeck(2).length, 216);

  const players = buildUnoPlayers([HOST], 3);
  let state = createUnoRound(players, { roundNumber: 1, deckCount: 1 });
  assert.equal(state.players.length, 4);
  assert.equal(state.players[0].hand.length, 7);

  // Verify playability check and run 40 turns of bot play
  const top = state.discardPile[state.discardPile.length - 1];
  assert.equal(
    isUnoCardPlayable(
      { id: 'w1', color: 'wild', value: 'wild', deckIndex: 1 },
      top,
      state.activeColor
    ),
    true
  );

  for (let i = 0; i < 60 && state.phase === 'PLAYING'; i++) {
    const curr = state.players[state.activePlayerIndex];
    const action = decideUnoBotAction(state, curr.id);
    state = applyUnoAction(state, curr.id, action);
  }
  assert.ok(['PLAYING', 'ROUND_OVER'].includes(state.phase));
});

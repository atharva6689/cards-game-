export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  deckIndex: number;
}

export type GameType = 'poker' | 'rummy' | 'sevens' | 'bluff' | 'uno';
export type LobbyPlayMode = 'solo' | 'friends';

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  provider: 'google' | 'password' | 'guest';
  chips: number;
  gamesPlayed: number;
  wins: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  isHost: boolean;
  chips: number;
}

export interface ChatMessage {
  id: string;
  lobbyId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// ---------- POKER ----------
export type PokerStreet = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export interface PokerPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  totalCommitted: number;
  folded: boolean;
  allIn: boolean;
  hasActedThisStreet: boolean;
  lastAction?: string;
  bestHandName?: string;
}

export interface PokerWinnerSummary {
  playerId: string;
  playerName: string;
  amount: number;
  handName: string;
}

export interface PokerGameState {
  gameType: 'poker';
  handNumber: number;
  deckCount: number;
  smallBlind: number;
  bigBlind: number;
  dealerIndex: number;
  street: PokerStreet;
  pot: number;
  currentBet: number;
  minRaise: number;
  activePlayerIndex: number;
  deck: Card[];
  communityCards: Card[];
  players: PokerPlayerState[];
  winners: PokerWinnerSummary[];
  actionLog: string[];
  finished: boolean;
}

export type PokerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; amount: number };

// ---------- RUMMY ----------
export type RummyPhase = 'DRAW' | 'MELD_OR_DISCARD' | 'ROUND_OVER';

export interface RummyMeld {
  id: string;
  type: 'set' | 'run';
  cards: Card[];
  ownerId: string;
}

export interface RummyPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  score: number;
  roundDeadwood: number;
  lastAction?: string;
}

export interface RummyRoundSummary {
  winnerId: string;
  winnerName: string;
  deckReshuffles: number;
  standings: {
    playerId: string;
    playerName: string;
    deadwood: number;
    totalScore: number;
    remainingCards: Card[];
  }[];
}

export interface RummyGameState {
  gameType: 'rummy';
  roundNumber: number;
  deckCount: number;
  cardsPerPlayer: number;
  phase: RummyPhase;
  activePlayerIndex: number;
  stock: Card[];
  discardPile: Card[];
  tableMelds: RummyMeld[];
  players: RummyPlayerState[];
  drawnFromDiscardId: string | null;
  reshuffleCount: number;
  summary: RummyRoundSummary | null;
  actionLog: string[];
}

export type RummyAction =
  | { type: 'draw_stock' }
  | { type: 'draw_discard' }
  | { type: 'meld'; cardIds: string[] }
  | { type: 'layoff'; cardId: string; meldId: string }
  | { type: 'discard'; cardId: string }
  | { type: 'declare' };

// ---------- SEVENS / BADAM SATTI ----------
export interface SevensSuitLane {
  low: number | null; // 1 (Ace) .. 7
  high: number | null; // 7 .. 13 (King)
  cards: Card[];
}

export interface SevensPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  score: number;
  lastAction?: string;
}

export interface SevensRoundSummary {
  winnerId: string;
  winnerName: string;
  standings: {
    playerId: string;
    playerName: string;
    roundPoints: number;
    totalScore: number;
    cardsLeft: number;
  }[];
}

export interface SevensGameState {
  gameType: 'sevens';
  roundNumber: number;
  deckCount: number;
  phase: 'PLAYING' | 'ROUND_OVER';
  activePlayerIndex: number;
  mustPlaySevenHearts: boolean;
  lanes: Record<Suit, SevensSuitLane>;
  players: SevensPlayerState[];
  summary: SevensRoundSummary | null;
  actionLog: string[];
}

export type SevensAction =
  | { type: 'play'; cardId: string }
  | { type: 'pass' };

// ---------- BLUFF MASTER ----------
export interface BluffPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: Card[];
  passedInCycle: boolean;
  score: number; // rounds won
  lastAction?: string;
}

export interface BluffLastPlay {
  playerId: string;
  playerName: string;
  cards: Card[]; // hidden from clients until resolved!
  count: number;
  claimedRank: Rank;
}

export interface BluffRevealBanner {
  callerName: string;
  accusedName: string;
  wasBluff: boolean;
  claimedRank: Rank;
  revealedCards: Card[];
  cardsPickedUp: number;
}

export interface BluffGameState {
  gameType: 'bluff';
  roundNumber: number;
  deckCount: number;
  phase: 'PLAYING' | 'ROUND_OVER';
  activePlayerIndex: number;
  pile: Card[];
  claimedRank: Rank | null;
  lastPlay: BluffLastPlay | null;
  lastReveal: BluffRevealBanner | null;
  winnerId: string | null;
  winnerName: string | null;
  players: BluffPlayerState[];
  actionLog: string[];
}

export type BluffAction =
  | { type: 'play'; cardIds: string[]; claimedRank: Rank }
  | { type: 'pass' }
  | { type: 'call_bluff' };

// ---------- UNO ----------
export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
export type UnoCardColor = UnoColor | 'wild';
export type UnoValue =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface UnoCard {
  id: string;
  color: UnoCardColor;
  value: UnoValue;
  deckIndex: number;
}

export interface UnoPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  hand: UnoCard[];
  calledUno: boolean;
  score: number;
  lastAction?: string;
}

export interface UnoRoundSummary {
  winnerId: string;
  winnerName: string;
  pointsWon: number;
  standings: {
    playerId: string;
    playerName: string;
    handPoints: number;
    totalScore: number;
    cardsLeft: number;
  }[];
}

export interface UnoGameState {
  gameType: 'uno';
  roundNumber: number;
  deckCount: number;
  phase: 'PLAYING' | 'ROUND_OVER';
  direction: 1 | -1;
  activePlayerIndex: number;
  activeColor: UnoColor;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  drawnPlayableCardId: string | null; // If player drew a card and may play or pass
  players: UnoPlayerState[];
  summary: UnoRoundSummary | null;
  actionLog: string[];
}

export type UnoAction =
  | { type: 'play'; cardId: string; chosenColor?: UnoColor }
  | { type: 'draw' }
  | { type: 'pass_after_draw' }
  | { type: 'call_uno' }
  | { type: 'catch_uno'; targetPlayerId: string };

// ---------- UNION & SANITIZED VIEWS ----------
export type TableGameState =
  | PokerGameState
  | RummyGameState
  | SevensGameState
  | BluffGameState
  | UnoGameState;

export type TableGameAction =
  | PokerAction
  | RummyAction
  | SevensAction
  | BluffAction
  | UnoAction;

export interface LobbyConfig {
  gameType: GameType;
  mode: LobbyPlayMode;
  deckCount: number; // 1 to 4
  botCount: number;  // 0 to 9
  startingChips: number;
}

export type SanitizedPokerPlayer = Omit<PokerPlayerState, 'holeCards'> & {
  holeCards: Card[];
  cardCount: number;
};

export type SanitizedPokerState = Omit<PokerGameState, 'deck' | 'players'> & {
  deckRemaining: number;
  players: SanitizedPokerPlayer[];
};

export type SanitizedRummyPlayer = Omit<RummyPlayerState, 'hand'> & {
  hand: Card[];
  cardCount: number;
};

export type SanitizedRummyState = Omit<RummyGameState, 'stock' | 'players'> & {
  stockCount: number;
  players: SanitizedRummyPlayer[];
};

export type SanitizedSevensPlayer = Omit<SevensPlayerState, 'hand'> & {
  hand: Card[];
  cardCount: number;
};

export type SanitizedSevensState = Omit<SevensGameState, 'players'> & {
  players: SanitizedSevensPlayer[];
};

export type SanitizedBluffPlayer = Omit<BluffPlayerState, 'hand'> & {
  hand: Card[];
  cardCount: number;
};

export type SanitizedBluffState = Omit<BluffGameState, 'pile' | 'lastPlay' | 'players'> & {
  pileCount: number;
  lastPlay: Omit<BluffLastPlay, 'cards'> | null;
  players: SanitizedBluffPlayer[];
};

export type SanitizedUnoPlayer = Omit<UnoPlayerState, 'hand'> & {
  hand: UnoCard[];
  cardCount: number;
};

export type SanitizedUnoState = Omit<UnoGameState, 'drawPile' | 'players'> & {
  drawPileCount: number;
  players: SanitizedUnoPlayer[];
};

export type SanitizedGameState =
  | SanitizedPokerState
  | SanitizedRummyState
  | SanitizedSevensState
  | SanitizedBluffState
  | SanitizedUnoState;

export interface PublicLobbySnapshot {
  id: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  config: LobbyConfig;
  players: LobbyPlayer[];
  gameState: SanitizedGameState | null;
  messages: ChatMessage[];
}

import {
  BookOpen,
  Check,
  Copy,
  Menu,
  MessageSquare,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { GameType } from '../game/types';

interface TableTopBarProps {
  lobbyId: string;
  gameType: GameType;
  deckCount: number;
  unreadChatCount: number;
  chatOpen: boolean;
  muted: boolean;
  onToggleChat: () => void;
  onToggleMute: () => void;
  onOpenRules: () => void;
  onOpenMenu: () => void;
}

const SHORT_TITLE: Record<GameType, string> = {
  poker: "Hold'em",
  rummy: 'Rummy',
  sevens: 'Sevens',
  bluff: 'Bluff Master',
  uno: 'UNO Club',
};

const FULL_TITLE: Record<GameType, string> = {
  poker: "Hold'em Poker",
  rummy: 'Rummy Club',
  sevens: 'Sevens / Badam Satti',
  bluff: 'Bluff Master',
  uno: 'UNO Club',
};

export function TableTopBar({
  lobbyId,
  gameType,
  deckCount,
  unreadChatCount,
  chatOpen,
  muted,
  onToggleChat,
  onToggleMute,
  onOpenRules,
  onOpenMenu,
}: TableTopBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?lobby=${lobbyId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore clipboard errors
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="relative z-20 flex h-13 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0A130E] px-2.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <span className="truncate font-display text-base font-bold text-[#F5F2EA] sm:text-lg">
          <span className="sm:hidden">{SHORT_TITLE[gameType]}</span>
          <span className="hidden sm:inline">{FULL_TITLE[gameType]}</span>
        </span>
        <span className="hidden text-xs text-[#9AA89F] md:inline whitespace-nowrap">
          · {deckCount} {deckCount === 1 ? 'Deck' : 'Decks'}
        </span>
        <button
          type="button"
          onClick={handleCopyInvite}
          aria-label={`Copy invite link for lobby ${lobbyId}`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#1D3225] bg-[#112018] px-2 font-mono text-[11px] font-semibold text-[#E5B857] transition-colors hover:border-[#D4A853]/60 whitespace-nowrap sm:px-2.5 sm:text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : lobbyId}</span>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onOpenRules}
          aria-label="Game rules"
          className="flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-[#1D3225] bg-[#101D16] text-xs font-medium text-[#D6DDD8] hover:border-[#D4A853]/60 sm:w-auto sm:px-3 whitespace-nowrap"
        >
          <BookOpen className="h-4 w-4 text-[#E5B857]" />
          <span className="hidden sm:inline">Rules</span>
        </button>

        <button
          type="button"
          onClick={onToggleChat}
          aria-label={chatOpen ? 'Hide table chat' : 'Open table chat'}
          aria-expanded={chatOpen}
          className={`relative flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors sm:w-auto sm:px-3 whitespace-nowrap ${
            chatOpen
              ? 'border-[#E5B857] bg-[#E5B857] text-[#111714]'
              : 'border-[#1D3225] bg-[#101D16] text-[#D6DDD8] hover:border-[#D4A853]/60'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Chat</span>
          {unreadChatCount > 0 && !chatOpen && (
            <span className="absolute -right-1 -top-1 rounded-full bg-[#E5B857] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-[#111714] tabular-nums sm:static sm:ml-0.5">
              {unreadChatCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1D3225] bg-[#101D16] text-[#D6DDD8] hover:border-[#D4A853]/60"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Table menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1D3225] bg-[#101D16] text-[#D6DDD8] hover:border-[#D4A853]/60"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function RulesModal({
  gameType,
  deckCount,
  onClose,
}: {
  gameType: GameType;
  deckCount: number;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Rules"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-6 text-[#F5F2EA] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1D3225] pb-3">
          <h2 className="font-display text-xl font-bold">
            {FULL_TITLE[gameType]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D3225] bg-[#09110D] text-[#B8C6BD] hover:border-[#D4A853]/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {gameType === 'poker' && (
          <ul className="space-y-2 text-sm text-[#B8C6BD]">
            <li>2 private hole cards + 5 community cards from a {deckCount}-deck shoe.</li>
            <li>Bet across Pre-Flop, Flop, Turn, and River.</li>
            <li>Strongest 5-card hand wins the pot{deckCount >= 2 ? ' (Five of a Kind beats Royal Flush).' : '.'}</li>
          </ul>
        )}
        {gameType === 'rummy' && (
          <ul className="space-y-2 text-sm text-[#B8C6BD]">
            <li>Draw 1 card from Stock or Discard pile, then meld Sets/Runs or Lay Off onto existing melds.</li>
            <li>Discard 1 card to end your turn. Empty your hand or Declare Rummy to win.</li>
          </ul>
        )}
        {gameType === 'sevens' && (
          <ul className="space-y-2 text-sm text-[#B8C6BD]">
            <li>The player holding 7♥ starts the round by playing 7♥.</li>
            <li>On your turn, play any 7 to open its suit, or extend a suit lane one step downward (6→A) or upward (8→K).</li>
            <li>Pass only when you have zero legal plays. First player to 0 cards wins.</li>
          </ul>
        )}
        {gameType === 'bluff' && (
          <ul className="space-y-2 text-sm text-[#B8C6BD]">
            <li>The leader plays 1–4 cards face-down and declares a rank.</li>
            <li>Next players can add 1–4 cards claiming the same rank, Pass, or Call Bluff!</li>
            <li>If the play was a lie, the bluffer picks up the whole pile; if honest, the caller picks up the pile.</li>
          </ul>
        )}
        {gameType === 'uno' && (
          <ul className="space-y-2 text-sm text-[#B8C6BD]">
            <li>Play a card matching the active color or value, or play any Wild / Wild +4.</li>
            <li>Special cards: Skip, Reverse, Draw +2, Wild, and Wild +4.</li>
            <li>Click UNO! when down to 1 card so opponents cannot catch you for +2 cards.</li>
          </ul>
        )}

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full rounded-xl bg-[#E5B857] text-sm font-bold text-[#111714]"
        >
          Back to Table
        </button>
      </div>
    </div>
  );
}

export function TablePauseModal({
  isHost,
  lobbyId,
  onResume,
  onReturnToSetup,
  onLeaveToTitle,
}: {
  isHost: boolean;
  lobbyId: string;
  onResume: () => void;
  onReturnToSetup: () => void;
  onLeaveToTitle: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Table Menu"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-6 text-[#F5F2EA] shadow-2xl">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold">Table Paused</h2>
          <p className="mt-1 text-xs text-[#9AB0A2]">
            Lobby Code: <span className="font-mono font-bold text-[#E5B857]">{lobbyId}</span>
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="min-h-[46px] w-full rounded-xl bg-[#E5B857] text-sm font-bold text-[#111714]"
          >
            Resume Game
          </button>
          {isHost && (
            <button
              type="button"
              onClick={onReturnToSetup}
              className="min-h-[44px] w-full rounded-xl border border-[#1D3225] bg-[#14241B] text-xs font-semibold text-[#F5F2EA] hover:border-[#D4A853]/60"
            >
              Change Game / Decks / Bots
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveToTitle}
            className="min-h-[44px] w-full rounded-xl border border-[#C82829]/45 bg-[#C82829]/15 text-xs font-semibold text-[#FCA5A5] hover:bg-[#C82829]/25"
          >
            Leave Table
          </button>
        </div>
      </div>
    </div>
  );
}

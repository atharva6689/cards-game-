import { BookOpen, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import keyartImg from '../assets/images/title_felt_keyart_1794599266493.jpg';
import type { AuthUser } from '../game/types';
import { loginAsGuest } from '../utils/api';

interface TitleScreenProps {
  user: AuthUser | null;
  pendingLobbyCode: string | null;
  onAuthenticated: (user: AuthUser) => void;
  onEnterClub: () => void;
  onJoinLobbyCode: (code: string) => Promise<void>;
}

export function BrandLogo() {
  return (
    <span className="inline-flex items-center gap-3 select-none">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4A853]/45 bg-[#122219] shadow-lg">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#D4A853]" fill="currentColor" aria-hidden="true">
          <path d="M12 2C12 2 4 10 4 15C4 17.8 6.2 20 8.8 20C10.3 20 11.4 19.3 12 18.3C12.6 19.3 13.7 20 15.2 20C17.8 20 20 17.8 20 15C20 10 12 2 12 2ZM10.7 18.8L9 22H15L13.3 18.8H10.7Z" />
        </svg>
      </span>
      <span className="font-display text-3xl font-bold tracking-tight text-[#F5F2EA] sm:text-4xl">
        TABLESTAKES
      </span>
    </span>
  );
}

export function TitleScreen({
  user,
  pendingLobbyCode,
  onAuthenticated,
  onEnterClub,
  onJoinLobbyCode,
}: TitleScreenProps) {
  const [nickname, setNickname] = useState(user?.displayName || 'Club Player');
  const [roomCode, setRoomCode] = useState(pendingLobbyCode ?? '');
  const [howToOpen, setHowToOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (pendingLobbyCode) setRoomCode(pendingLobbyCode);
  }, [pendingLobbyCode]);

  useEffect(() => {
    if (user?.displayName) setNickname(user.displayName);
  }, [user?.displayName]);

  const ensureSession = async (): Promise<AuthUser> => {
    const clean = nickname.trim();
    if (clean.length < 2 || clean.length > 24) {
      throw new Error('Nickname must be between 2 and 24 characters.');
    }
    if (user && user.displayName === clean) {
      return user;
    }
    const res = await loginAsGuest(clean);
    onAuthenticated(res.user);
    return res.user;
  };

  const handleCreateRoom = async () => {
    setError(null);
    setBusy(true);
    try {
      await ensureSession();
      onEnterClub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enter a valid nickname.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError('Enter a room code to join.');
      return;
    }
    setBusy(true);
    try {
      await ensureSession();
      await onJoinLobbyCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (howToOpen) {
        if (e.key === 'Escape') setHowToOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCreateRoom();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="relative flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-[#09110D] text-[#F5F2EA]">
      {/* Full-bleed luxury emerald felt & poker keyart background */}
      <div className="pointer-events-none absolute inset-0">
        {!imgError ? (
          <img
            src={keyartImg}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_70%_45%,#15472D_0%,#09110D_68%)]" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(9,17,13,0.96) 0%, rgba(9,17,13,0.88) 42%, rgba(9,17,13,0.45) 100%)',
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10 sm:px-12">
        <div className="max-w-lg space-y-6">
          <div className="space-y-3">
            <BrandLogo />
            <p className="max-w-md text-[15px] leading-relaxed text-[#B6C5BC] sm:text-base">
              Private Texas Hold&rsquo;em, Classic Rummy, Sevens, Bluff Master &amp; UNO tables. Configure your deck shoe, choose your bot seats, or invite friends with a custom lobby link.
            </p>
          </div>

          {pendingLobbyCode && (
            <div className="rounded-xl border border-[#D4A853]/45 bg-[#13261B]/90 px-4 py-3 text-xs text-[#E5E0D5]">
              Invited to room <span className="font-mono font-bold text-[#D4A853]">{pendingLobbyCode}</span> — enter your nickname and click <strong className="text-[#F5F2EA]">Join</strong>.
            </div>
          )}

          {/* Single Clean Entry Card matching Screenshot 2 */}
          <div className="rounded-2xl border border-[#1D3225] bg-[#0F1C15]/95 p-6 shadow-2xl backdrop-blur-sm">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="hero-nickname"
                  className="mb-1.5 block text-xs font-medium text-[#B8C6BD]"
                >
                  Your Nickname
                </label>
                <input
                  id="hero-nickname"
                  type="text"
                  maxLength={24}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  className="h-12 w-full rounded-xl border border-[#1D3225] bg-[#09110D] px-4 text-sm font-medium text-[#F5F2EA] placeholder:text-[#556B5D] focus:border-[#D4A853] focus:outline-none"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-[#C82829]/50 bg-[#C82829]/15 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                data-start="true"
                disabled={busy}
                onClick={handleCreateRoom}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E5B857] px-5 text-sm font-bold text-[#111714] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>{busy ? 'Opening Table...' : 'Create Private Room & Choose Game'}</span>
              </button>

              <div className="flex items-center gap-3 py-0.5">
                <div className="h-px flex-1 bg-[#1D3225]" />
                <span className="text-xs text-[#6E8477]">or join a friend&rsquo;s room</span>
                <div className="h-px flex-1 bg-[#1D3225]" />
              </div>

              <form onSubmit={handleJoinSubmit} className="flex items-center gap-2.5">
                <label htmlFor="hero-room-code" className="sr-only">
                  Lobby code
                </label>
                <input
                  id="hero-room-code"
                  type="text"
                  maxLength={12}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Lobby code..."
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#1D3225] bg-[#09110D] px-3.5 font-mono text-sm uppercase tracking-wider text-[#F5F2EA] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[#556B5D] focus:border-[#D4A853] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#1D3225] bg-[#14241B] px-5 text-sm font-semibold text-[#F5F2EA] transition-colors hover:border-[#D4A853]/60 disabled:opacity-50 whitespace-nowrap"
                >
                  <Users className="h-4 w-4 text-[#D4A853]" />
                  <span>Join Lobby</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Hint Bar matching Screenshot 2 */}
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 pb-5 text-xs text-[#7F9487] sm:px-12">
        <span>
          Click or tap cards · Enter or Space to start · M to mute · Esc for table menu
        </span>
        <button
          type="button"
          onClick={() => setHowToOpen(true)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#1D3225] bg-[#0F1C15]/90 px-3 text-xs font-medium text-[#D4A853] hover:border-[#D4A853]/60"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>How To Play</span>
        </button>
      </footer>

      {/* How To Play Modal */}
      {howToOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="How To Play"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#1D3225] bg-[#0F1C15] p-6 text-[#F5F2EA] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1D3225] pb-3">
              <h2 className="font-display text-2xl font-bold text-[#F5F2EA]">
                How To Play
              </h2>
              <button
                type="button"
                onClick={() => setHowToOpen(false)}
                aria-label="Close how to play"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D3225] bg-[#09110D] text-[#B8C6BD] hover:border-[#D4A853]/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-[#B8C6BD]">
              <div>
                <h3 className="font-semibold text-[#D4A853]">Poker (Texas Hold&rsquo;em)</h3>
                <p className="text-xs text-[#8EA396]">
                  Make the best 5-card hand from 2 hole cards + 5 community cards. Supports 1–4 decks (including Five of a Kind on multi-deck tables).
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#D4A853]">Classic Rummy</h3>
                <p className="text-xs text-[#8EA396]">
                  Draw from Deck or Discard, meld Sets (3–4 same rank) or Runs (3+ consecutive same suit), lay off cards, and discard to go out.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#10B981]">Sevens / Badam Satti</h3>
                <p className="text-xs text-[#8EA396]">
                  7♥ opens the table. Build each suit outward from 7 down to Ace and up to King. Pass only if you have no legal move. First to 0 cards wins.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#10B981]">Bluff Master</h3>
                <p className="text-xs text-[#8EA396]">
                  Play 1–4 cards face-down and declare a rank. Next player can play onto the same rank, Pass, or Call Bluff! Liars pick up the whole pile.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#10B981]">UNO</h3>
                <p className="text-xs text-[#8EA396]">
                  Match the active color or value. Use Skip, Reverse, Draw +2, Wild, and Wild +4. Click UNO! when down to 1 card.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHowToOpen(false)}
              className="mt-5 h-11 w-full rounded-xl bg-[#E5B857] text-sm font-bold text-[#111714]"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

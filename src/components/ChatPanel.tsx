import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../game/types';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
  onClose?: () => void;
  className?: string;
}

const QUICK_PHRASES = ['Good luck!', 'Nice play', 'Bluff!', 'UNO!'];

export function ChatPanel({
  messages,
  currentUserId,
  onSendMessage,
  onClose,
  className = '',
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onSendMessage(clean);
    setDraft('');
  };

  return (
    <aside
      aria-label="Table Chat"
      className={`flex flex-col border-l border-[#1D3225] bg-[#0B1510] text-[#F5F2EA] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#1D3225] px-4 py-3">
        <div>
          <h2 className="font-display text-base font-bold text-[#F5F2EA]">
            Table Chat
          </h2>
          <p className="text-xs text-[#8EA396]">Live room messages</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1D3225] bg-[#0F1C15] text-[#B8C6BD] hover:border-[#D4A853]/60 hover:text-[#F5F2EA]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="felt-scroll flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-[#6E8477]">
            No messages yet. Say hello to the table.
          </p>
        )}
        {messages.map((msg) => {
          const isSystem = msg.senderId === 'system';
          const isMine = msg.senderId === currentUserId;
          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="border-y border-[#1D3225]/70 py-1.5 text-center text-xs text-[#8EA396]"
              >
                {msg.text}
              </div>
            );
          }
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 text-[11px] text-[#8EA396]">
                <span className="font-semibold text-[#D6DDD8]">
                  {isMine ? 'You' : msg.senderName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug break-words ${
                  isMine
                    ? 'bg-[#E5B857] font-medium text-[#111714]'
                    : 'border border-[#1D3225] bg-[#122219] text-[#F5F2EA]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-[#1D3225] p-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => onSendMessage(phrase)}
              className="min-h-[34px] rounded-lg border border-[#1D3225] bg-[#101D16] px-2.5 py-1 text-xs text-[#C6D4CB] transition-colors hover:border-[#D4A853]/60 hover:text-[#F5F2EA] whitespace-nowrap"
            >
              {phrase}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="table-chat-input" className="sr-only">
            Chat message
          </label>
          <input
            id="table-chat-input"
            type="text"
            value={draft}
            maxLength={300}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message table..."
            className="min-h-[42px] flex-1 rounded-xl border border-[#1D3225] bg-[#09110D] px-3 text-sm text-[#F5F2EA] placeholder:text-[#556B5D] focus:border-[#D4A853] focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E5B857] text-[#111714] transition-opacity hover:opacity-95 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

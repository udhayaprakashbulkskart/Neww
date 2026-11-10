'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teamApi } from '@/lib/team/client';
import { Avatar, formatBytes, formatDay, formatTime, Notice } from './ui';

export type ChatMessage = {
  id: string;
  body: string | null;
  senderId: string;
  senderName: string;
  senderInitials: string;
  senderPhotoUrl: string | null;
  createdAt: string;
  file: null | { id: string; name: string; mimeType: string; sizeBytes: number; isImage: boolean; url: string };
};

const POLL_MS = 2500;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * One chat surface for both private and group conversations. The server decides who may read or
 * write; this component only renders what it is given and polls for new messages.
 */
export function ChatView({
  messagesUrl,
  readUrl,
  meId,
  showSenderNames,
  compact = false,
  emptyText = 'No messages yet. Say hello!',
}: {
  messagesUrl: string;
  readUrl: string;
  meId: string;
  showSenderNames: boolean;
  compact?: boolean;
  emptyText?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stickToBottom = useRef(true);

  const markRead = useCallback(() => {
    teamApi(readUrl, { method: 'POST' }).catch(() => undefined);
  }, [readUrl]);

  // Newest message time seen so far. Polling asks only for messages from this point on.
  const lastSeenAt = useRef<string | null>(null);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return 0;
    for (const m of incoming) {
      if (!lastSeenAt.current || m.createdAt > lastSeenAt.current) lastSeenAt.current = m.createdAt;
    }
    let fresh = 0;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) {
        if (!byId.has(m.id)) fresh += 1;
        byId.set(m.id, m);
      }
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
    return fresh;
  }, []);

  // Initial load, then incremental polling. Polling pauses while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async (after: string | null) => {
      try {
        const url = after ? `${messagesUrl}?after=${encodeURIComponent(after)}` : messagesUrl;
        const res = await teamApi<{ messages: ChatMessage[] }>(url);
        if (cancelled) return;
        const fresh = merge(res.messages);
        setLoaded(true);
        if (fresh > 0 && res.messages.some((m) => m.senderId !== meId)) markRead();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load messages.');
      }
    };

    const tick = async () => {
      if (!document.hidden) await load(lastSeenAt.current);
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };

    void load(null).then(() => {
      if (cancelled) return;
      markRead();
      timer = setTimeout(tick, POLL_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [messagesUrl, meId, merge, markRead]);

  // Keep the newest message in view unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const groups = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    for (const m of messages) {
      const day = formatDay(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && !file) || sending) return;
    setSending(true);
    setError(null);
    try {
      let payload: BodyInit;
      if (file) {
        const fd = new FormData();
        if (body) fd.append('body', body);
        fd.append('file', file);
        payload = fd;
      } else {
        payload = JSON.stringify({ body });
      }
      const res = await fetch(messagesUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: file ? undefined : { 'Content-Type': 'application/json' },
        body: payload,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? 'Message could not be sent.');
      stickToBottom.current = true;
      merge([data.data.message as ChatMessage]);
      setText('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function onPickFile(f: File | undefined) {
    setError(null);
    if (!f) return setFile(null);
    if (f.size > 4 * 1024 * 1024) return setError('Files must be 4 MB or smaller.');
    setFile(f);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} onScroll={onScroll} className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-3 py-3' : 'px-4 py-5 md:px-6'}`}>
        {!loaded && <p className="py-10 text-center text-sm text-tp-muted">Loading messages…</p>}
        {loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-tp-muted">{emptyText}</p>}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-tp-muted">
              <span className="h-px flex-1 bg-tp-line" />
              {g.day}
              <span className="h-px flex-1 bg-tp-line" />
            </div>
            <div className="space-y-3">
              {g.items.map((m) => (
                <MessageRow key={m.id} m={m} mine={m.senderId === meId} showSenderName={showSenderNames} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 pb-2">
          <Notice>{error}</Notice>
        </div>
      )}

      <form onSubmit={send} className="border-t border-tp-line bg-white p-3">
        {file && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-tp-lilac px-3 py-2 text-sm text-tp-purpleDark">
            <span className="truncate">
              📎 {file.name} <span className="text-tp-muted">({formatBytes(file.size)})</span>
            </span>
            <button type="button" onClick={() => onPickFile(undefined)} className="text-xs font-semibold hover:underline">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-tp-line text-tp-muted transition hover:border-tp-purple/40 hover:text-tp-purple"
            title="Attach an image or PDF"
          >
            <span className="sr-only">Attach a file</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={4000}
            rows={1}
            placeholder="Write a message"
            aria-label="Message"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-tp-line bg-tp-canvas px-3.5 py-2.5 text-sm text-tp-ink outline-none placeholder:text-tp-muted focus:border-tp-purple focus:bg-white focus:ring-4 focus:ring-tp-purple/15"
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && !file)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-tp-purple px-4 text-sm font-semibold text-white transition hover:bg-tp-purpleDark disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageRow({ m, mine, showSenderName }: { m: ChatMessage; mine: boolean; showSenderName: boolean }) {
  const bubble = mine
    ? 'rounded-2xl rounded-br-md bg-tp-purple text-white shadow-[0_8px_20px_-12px_rgba(109,77,242,0.8)]'
    : 'rounded-2xl rounded-bl-md border border-tp-line bg-white text-tp-ink';
  return (
    <div className={`flex items-end gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
      {!mine && <Avatar name={m.senderName} initials={m.senderInitials} photoUrl={m.senderPhotoUrl} size="sm" seed={m.senderId} />}
      <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {showSenderName && !mine && <span className="mb-1 px-1 text-xs font-semibold text-tp-muted">{m.senderName}</span>}
        <div className={`px-3.5 py-2.5 text-sm ${bubble}`}>
          {m.file && m.file.isImage && (
            <a href={m.file.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.file.url} alt={m.file.name} loading="lazy" className="max-h-64 max-w-full rounded-xl object-cover" />
            </a>
          )}
          {m.file && !m.file.isImage && (
            <a
              href={m.file.url}
              className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-tp-canvas hover:bg-tp-lilac'}`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${mine ? 'bg-white/20' : 'bg-tp-lilac text-tp-purple'}`}>
                PDF
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold underline-offset-2 hover:underline">{m.file.name}</span>
                <span className={`block text-xs ${mine ? 'text-white/75' : 'text-tp-muted'}`}>{formatBytes(m.file.sizeBytes)} · Download</span>
              </span>
            </a>
          )}
          {m.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>}
        </div>
        <span className="mt-1 px-1 text-[11px] text-tp-muted">{formatTime(m.createdAt)}</span>
      </div>
    </div>
  );
}

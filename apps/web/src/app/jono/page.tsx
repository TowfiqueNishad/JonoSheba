'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDigits } from '@jonoshheba/shared';
import { FilmPlateBanner } from '../../components/NostosPrimitive';
import { SafeMarkdown, TrustChip } from '../../components/UiStates';
import { apiDelete, apiPost, type ApiError } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface Citation {
  index: number;
  title: string;
  agency: string;
  sourceUrl: string;
  trustLabel: string;
  lastVerifiedAt?: string;
}

interface ActionCard {
  type: 'emergency_call' | 'transport_handoff' | 'eligibility_wizard' | 'complaint_draft';
  label: string;
  url?: string;
  phone?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  emergency?: boolean;
  citations?: Citation[];
  actionCards?: ActionCard[];
  suggestions?: string[];
  feedbackSent?: 'up' | 'down';
  feedbackReason?: string;
}

const MAX_CHARS = 4000;
const SESSION_ID_KEY = 'jonoshheba_jono_session_id';
const SESSION_TOKEN_KEY = 'jonoshheba_jono_session_token';

export default function JonoPage() {
  const { locale, dict } = useLocale();
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [drawerCitations, setDrawerCitations] = useState<Citation[] | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [downvoteTurnId, setDownvoteTurnId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const initialQuerySent = useRef(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: dict.jono.welcome,
    },
  ]);

  const defaultChips =
    locale === 'bn'
      ? [
          'ই-পাসপোর্ট আবেদন ও ফি কত?',
          'ঢাকা থেকে রাজশাহী ট্রেন কখন?',
          'জমির খাজনা অনলাইনে কীভাবে দেবো?',
          'বয়স্ক ভাতা বা ফ্যামিলি কার্ড ২০২৬ যোগ্যতা',
        ]
      : [
          'e-Passport application & fees',
          'Dhaka to Rajshahi train times',
          'How to pay land tax (Khajna) online?',
          'Old Age Allowance & Family Card 2026',
        ];

  useEffect(() => {
    try {
      const storedId = window.sessionStorage.getItem(SESSION_ID_KEY) || undefined;
      const storedTok = window.sessionStorage.getItem(SESSION_TOKEN_KEY) || undefined;
      if (storedId) setSessionId(storedId);
      if (storedTok) setSessionToken(storedTok);
    } catch {
      // sessionStorage unavailable
    }
    const win = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    setVoiceSupported(Boolean(win.SpeechRecognition || win.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (rateLimitCountdown <= 0) return;
    const t = setTimeout(() => setRateLimitCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [rateLimitCountdown]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (initialQuerySent.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q')?.trim();
    if (q) {
      initialQuerySent.current = true;
      void send(q);
    }
  }, []);

  function persistSession(id?: string, tok?: string) {
    setSessionId(id);
    if (tok !== undefined) setSessionToken(tok);
    try {
      if (id) window.sessionStorage.setItem(SESSION_ID_KEY, id);
      else window.sessionStorage.removeItem(SESSION_ID_KEY);
      if (tok) window.sessionStorage.setItem(SESSION_TOKEN_KEY, tok);
      else if (!id) window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  }

  async function deleteChat() {
    if (sessionId && sessionToken) {
      await apiDelete(`/api/v1/assistant/sessions/${encodeURIComponent(sessionId)}`, {
        locale,
        headers: { 'X-Session-Token': sessionToken },
      }).catch(() => undefined);
    }
    persistSession(undefined, undefined);
    setConfirmClearOpen(false);
    setNetworkError(null);
    setMessages([{ id: `welcome-${Date.now()}`, role: 'assistant', text: dict.jono.welcome }]);
  }

  async function send(textToSend?: string) {
    const q = (textToSend ?? input).trim();
    if (!q || loading || q.length > MAX_CHARS || rateLimitCountdown > 0) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLastQuery(q);
    setNetworkError(null);
    setLoading(true);

    try {
      const headers = sessionToken ? { 'X-Session-Token': sessionToken } : undefined;
      const res = await apiPost<{
        sessionId: string;
        sessionToken?: string;
        sessionRenewed?: boolean;
        turnId: string;
        reply: string;
        emergencyBypass: boolean;
        citations: Citation[];
        actionCards?: ActionCard[];
        suggestions?: string[];
      }>('/api/v1/assistant/message', { message: q, sessionId, locale }, { locale, headers });

      persistSession(res.sessionId, res.sessionToken ?? sessionToken);

      setMessages((prev) => [
        ...prev,
        {
          id: res.turnId,
          role: 'assistant',
          text: res.reply,
          emergency: res.emergencyBypass,
          citations: res.citations ?? [],
          actionCards: res.actionCards ?? [],
          suggestions: res.suggestions ?? [],
        },
      ]);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.status === 429) {
        setRateLimitCountdown(15);
        setNetworkError(
          locale === 'bn'
            ? 'আপনি অনেক দ্রুত প্রশ্ন পাঠিয়েছেন। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।'
            : 'Too many requests in a short window. Please wait a few seconds before sending again.',
        );
      } else if (apiErr?.status === 401 || apiErr?.status === 404) {
        persistSession(undefined, undefined);
        try {
          const retryRes = await apiPost<{
            sessionId: string;
            sessionToken?: string;
            turnId: string;
            reply: string;
            emergencyBypass: boolean;
            citations: Citation[];
            actionCards?: ActionCard[];
            suggestions?: string[];
          }>('/api/v1/assistant/message', { message: q, locale }, { locale });
          persistSession(retryRes.sessionId, retryRes.sessionToken);
          setMessages((prev) => [
            ...prev,
            {
              id: retryRes.turnId,
              role: 'assistant',
              text: retryRes.reply,
              emergency: retryRes.emergencyBypass,
              citations: retryRes.citations ?? [],
              actionCards: retryRes.actionCards ?? [],
              suggestions: retryRes.suggestions ?? [],
            },
          ]);
        } catch {
          setNetworkError(dict.jono.networkError);
        }
      } else {
        setNetworkError(dict.jono.networkError);
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(turnId: string, rating: 'up' | 'down', reason?: string) {
    if (!sessionId) return;
    if (rating === 'down' && !reason) {
      setDownvoteTurnId(turnId);
      return;
    }
    setDownvoteTurnId(null);
    const headers = sessionToken ? { 'X-Session-Token': sessionToken } : undefined;
    await apiPost(
      '/api/v1/assistant/feedback',
      { sessionId, turnId, rating, reason },
      { locale, headers },
    ).catch(() => undefined);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === turnId ? { ...m, feedbackSent: rating, feedbackReason: reason } : m,
      ),
    );
  }

  async function copyAnswer(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  function startVoiceInput() {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
    };
    const SpeechRec = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = locale === 'bn' ? 'bn-BD' : 'en-US';
    rec.onresult = (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.start();
  }

  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeChips =
    latestAssistant?.suggestions && latestAssistant.suggestions.length > 0
      ? latestAssistant.suggestions
      : defaultChips;

  const feedbackReasons =
    locale === 'bn'
      ? ['তথ্য অসম্পূর্ণ', 'ভুল ফি বা তারিখ', 'লিংক কাজ করছে না', 'অন্যান্য']
      : ['Incomplete info', 'Wrong fee or date', 'Broken link', 'Other'];

  return (
    <div>
      <FilmPlateBanner
        overline="III — THE ORACLE · CITIZEN INTELLIGENCE"
        title={dict.jono.title}
        subtitle={dict.jono.subtitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.jono }]}
        actions={
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="nostos-btn-gold"
          >
            {dict.jono.newChat}
          </button>
        }
      />

      {/* Centred Editorial Column (max 720px) */}
      <div className="mx-auto max-w-[720px] space-y-6 px-4 py-10 pb-24 sm:pb-12">
        {/* In-Page Confirm Modal before clearing conversation */}
        {confirmClearOpen && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-clear-title"
            className="border border-[var(--gold-line)] bg-[var(--surface)] p-5 text-sm text-[var(--text)]"
          >
            <p id="confirm-clear-title" className="font-semibold">
              {locale === 'bn'
                ? 'আপনি কি বর্তমান কথোপকথন মুছে নতুন কথোপকথন শুরু করতে চান?'
                : 'Clear the current conversation and start a new dialogue?'}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => void deleteChat()}
                className="nostos-btn-gold"
              >
                {locale === 'bn' ? 'হ্যাঁ, নতুন কথোপকথন' : 'Yes, start new chat'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="min-h-[44px] border border-[var(--hair)] px-4 text-xs font-semibold text-[var(--text)]"
              >
                {locale === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Suggested Question Chips */}
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => void send(chip)}
              className="min-h-[40px] border border-[var(--hair)] bg-[var(--surface)] px-3.5 text-xs text-[var(--text)] transition-colors hover:border-[var(--gold-line)] hover:text-[var(--gold)]"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Oracle Chat Transcript */}
        <div
          role="log"
          aria-live="polite"
          aria-busy={loading}
          className="min-h-[380px] space-y-5 border border-[var(--hair)] bg-[var(--surface)] p-5"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`nostos-chat-develop max-w-[92%] p-5 text-sm ${
                m.role === 'user'
                  ? 'ml-auto border border-[var(--hair)] bg-[var(--surface-2)] text-[var(--text)]'
                  : m.emergency
                    ? 'border-l-2 border-[#B3261E] bg-[var(--surface-2)] text-[var(--text)]'
                    : 'border-l-2 border-[var(--gold)] bg-[var(--page)] text-[var(--text)]'
              }`}
            >
              <p className="nostos-overline mb-2 text-[9px] text-[var(--accent)]">
                {m.role === 'user'
                  ? locale === 'bn'
                    ? 'নাগরিক'
                    : 'CITIZEN'
                  : 'JONO ORACLE'}
              </p>

              {m.emergency && (
                <div className="mb-4 border border-[#B3261E] bg-[#B3261E] p-3.5 text-white">
                  <p className="text-xs font-semibold">{dict.emergency.noDispatchNotice}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <a
                      href="tel:999"
                      className="inline-flex min-h-[44px] items-center bg-white px-4 text-xs font-bold text-[#B3261E]"
                    >
                      {dict.emergency.call999}
                    </a>
                    <a
                      href="tel:16263"
                      className="inline-flex min-h-[44px] items-center border border-white px-3 text-xs font-bold text-white"
                    >
                      16263
                    </a>
                  </div>
                </div>
              )}

              {m.role === 'user' ? <p>{m.text}</p> : <SafeMarkdown text={m.text} />}

              {m.actionCards && m.actionCards.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {m.actionCards.map((ac, idx) => (
                    <a
                      key={`${m.id}-ac-${idx}`}
                      href={ac.url ?? (ac.phone ? `tel:${ac.phone}` : '#')}
                      target={ac.url?.startsWith('http') ? '_blank' : undefined}
                      rel={ac.url?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className={
                        ac.type === 'emergency_call'
                          ? 'nostos-emergency-999 inline-flex min-h-[44px] items-center px-4 text-xs font-bold text-white'
                          : 'nostos-btn-gold'
                      }
                    >
                      {ac.label}
                    </a>
                  ))}
                </div>
              )}

              {/* SOURCE line in tracked small caps */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--hair)] pt-3">
                  <span className="nostos-overline text-[9px] text-[var(--gold)]">SOURCE ·</span>
                  {m.citations.map((c) => (
                    <button
                      key={`${m.id}-${c.index}`}
                      type="button"
                      onClick={() => setDrawerCitations(m.citations ?? null)}
                      className="nostos-overline inline-flex min-h-[34px] items-center gap-1 border border-[var(--hair)] px-2.5 text-[9px] text-[var(--accent)] hover:border-[var(--gold-line)]"
                    >
                      <span>[{formatDigits(c.index, locale)}]</span>
                      <span>{c.agency}</span>
                    </button>
                  ))}
                </div>
              )}

              {m.role === 'assistant' && m.id !== 'welcome' && (
                <div className="mt-3 space-y-2 border-t border-[var(--hair-soft)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <button
                      type="button"
                      onClick={() => void copyAnswer(m.id, m.text)}
                      className="min-h-[36px] border border-[var(--hair)] px-2.5 text-[11px] text-[var(--text)] hover:border-[var(--gold-line)]"
                    >
                      {copiedId === m.id
                        ? locale === 'bn'
                          ? 'কপি হয়েছে'
                          : 'Copied'
                        : locale === 'bn'
                          ? 'উত্তর কপি করুন'
                          : 'Copy answer'}
                    </button>
                    {sessionId && (
                      <>
                        <span>{dict.jono.helpfulPrompt}</span>
                        <button
                          type="button"
                          aria-label="Helpful"
                          aria-pressed={m.feedbackSent === 'up'}
                          onClick={() => void sendFeedback(m.id, 'up')}
                          className={`min-h-[36px] min-w-[36px] border px-2 font-semibold ${
                            m.feedbackSent === 'up'
                              ? 'border-[var(--gold)] text-[var(--gold)]'
                              : 'border-[var(--hair)] text-[var(--text)]'
                          }`}
                        >
                          {locale === 'bn' ? 'হ্যাঁ' : 'Yes'}
                        </button>
                        <button
                          type="button"
                          aria-label="Not helpful"
                          aria-pressed={m.feedbackSent === 'down'}
                          onClick={() => void sendFeedback(m.id, 'down')}
                          className={`min-h-[36px] min-w-[36px] border px-2 font-semibold ${
                            m.feedbackSent === 'down'
                              ? 'border-[#B3261E] text-[#E57368]'
                              : 'border-[var(--hair)] text-[var(--text)]'
                          }`}
                        >
                          {locale === 'bn' ? 'না' : 'No'}
                        </button>
                      </>
                    )}
                  </div>

                  {downvoteTurnId === m.id && (
                    <div className="flex flex-wrap items-center gap-1.5 border border-[var(--hair)] bg-[var(--surface)] p-2 text-xs">
                      <span className="font-semibold text-[var(--text)]">
                        {locale === 'bn' ? 'কারণ জানান:' : 'Tell us why:'}
                      </span>
                      {feedbackReasons.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => void sendFeedback(m.id, 'down', reason)}
                          className="min-h-[32px] border border-[var(--hair)] px-2.5 text-[var(--text)] hover:border-[var(--gold-line)]"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Three slow-pulsing gold points typing indicator */}
          {loading && (
            <div className="inline-flex items-center gap-2 border-l-2 border-[var(--gold)] bg-[var(--page)] px-4 py-3 text-xs text-[var(--text-muted)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gold)]" />
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gold)]"
                style={{ animationDelay: '300ms' }}
              />
              <span
                className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--gold)]"
                style={{ animationDelay: '600ms' }}
              />
              <span className="ml-1">{dict.jono.sending}</span>
            </div>
          )}

          {networkError && (
            <div role="alert" className="border border-[#B3261E] bg-[var(--page)] p-3 text-xs text-[var(--text)]">
              <p className="font-semibold">
                {networkError}
                {rateLimitCountdown > 0 ? ` (${formatDigits(rateLimitCountdown, locale)}s)` : ''}
              </p>
              {lastQuery && rateLimitCountdown === 0 && (
                <button
                  type="button"
                  onClick={() => void send(lastQuery)}
                  className="nostos-btn-gold mt-2"
                >
                  {dict.jono.retry}
                </button>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Sticky Hairline Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="sticky bottom-14 z-20 space-y-1.5 border border-[var(--hair)] bg-[var(--panel)] p-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:p-0"
        >
          <label htmlFor="jono-chat-input" className="sr-only">
            {dict.jono.inputLabel}
          </label>
          <div className="flex gap-2">
            <textarea
              id="jono-chat-input"
              rows={2}
              maxLength={MAX_CHARS}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={dict.jono.inputPlaceholder}
              className="flex-1 border border-[var(--hair)] bg-[var(--field)] px-4 py-2.5 text-sm text-[var(--text)]"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={startVoiceInput}
                aria-label={dict.jono.voiceInput}
                className="min-h-[44px] min-w-[44px] border border-[var(--hair)] px-3 text-xs font-semibold text-[var(--text)] hover:border-[var(--gold-line)]"
              >
                {locale === 'bn' ? 'কণ্ঠ' : 'Voice'}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="nostos-btn-gold min-h-[44px] px-6 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dict.jono.send}
            </button>
          </div>
          <p className="text-right font-mono text-[11px] text-[var(--text-muted)]">
            {formatDigits(input.length, locale)} / {formatDigits(MAX_CHARS, locale)}
          </p>
        </form>

        {/* Glass Sources Drawer */}
        {drawerCitations && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dict.jono.sourcesTitle}
            className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          >
            <div className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--hair)] bg-[var(--panel)] p-6">
              <div className="flex items-center justify-between border-b border-[var(--hair)] pb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">
                  {dict.jono.sourcesTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setDrawerCitations(null)}
                  className="min-h-[44px] min-w-[44px] border border-[var(--hair)] font-bold text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {drawerCitations.map((c) => (
                  <div
                    key={c.index}
                    className="border border-[var(--hair)] bg-[var(--surface)] p-4 text-sm"
                  >
                    <TrustChip
                      label={c.trustLabel}
                      lastVerifiedAt={c.lastVerifiedAt}
                      locale={locale}
                    />
                    <p className="mt-2 font-semibold text-[var(--text)]">
                      [{formatDigits(c.index, locale)}] {c.title}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{c.agency}</p>
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nostos-link mt-2 inline-block text-xs text-[var(--gold)]"
                    >
                      {c.sourceUrl} →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { formatDhakaDate, getTrustLabelText, type Locale } from '@jonoshheba/shared';
import { useLocale } from '../lib/i18n';

/**
 * NOSTOS Skeleton:
 * Hairline bars with a slow gold sheen (never shows "0").
 */
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-32 border border-[var(--hair)] bg-[var(--surface)] p-5"
        >
          <div className="nostos-skeleton-sheen h-2.5 w-1/3" />
          <div className="nostos-skeleton-sheen mt-4 h-4 w-3/4" />
          <div className="nostos-skeleton-sheen mt-3 h-2.5 w-full" />
          <div className="nostos-skeleton-sheen mt-2 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * NOSTOS Error State:
 * One line of Cormorant italic + #B3261E hairline border + action button.
 */
export function ErrorRetryCard({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { dict } = useLocale();
  return (
    <div
      role="alert"
      className="border border-[#B3261E] bg-[var(--surface)] p-6 text-sm text-[var(--text)]"
    >
      <p className="nostos-overline text-[#E57368]">{dict.states.errorTitle}</p>
      <p className="nostos-editorial-italic mt-2 text-lg text-[var(--text)]">
        {message || dict.states.errorHint}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="nostos-btn-gold mt-4"
        >
          {dict.states.retry}
        </button>
      )}
    </div>
  );
}

/**
 * NOSTOS Empty State:
 * One line of Cormorant italic + action.
 */
export function EmptyStateCard({
  title,
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  const { dict } = useLocale();
  return (
    <div className="border border-[var(--hair)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
      <p className="nostos-editorial-italic text-xl text-[var(--text)]">
        {title || dict.states.empty}
      </p>
      {hint && <p className="mt-2 text-xs text-[var(--text-muted)]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * NOSTOS Trust Tag:
 * - Official/verified = steel-blue outline
 * - Pending = dashed gold outline
 * - Unknown/stale = hairline grey
 * - Wide-tracked small caps
 */
export function TrustChip({
  label,
  lastVerifiedAt,
  pending = false,
  locale,
}: {
  label: string;
  lastVerifiedAt?: string | null;
  pending?: boolean;
  locale: Locale;
}) {
  const isPending = pending || !lastVerifiedAt;
  const text = isPending
    ? locale === 'bn'
      ? 'যাচাই চলছে'
      : 'VERIFICATION PENDING'
    : getTrustLabelText(label, locale);

  const style = isPending
    ? 'border border-dashed border-[var(--gold)] text-[var(--gold)]'
    : label === 'UNAVAILABLE_STALE'
      ? 'border border-[var(--hair)] text-[var(--text-muted)]'
      : 'border border-[var(--accent)] text-[var(--accent)]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 font-overline text-[10px] font-semibold uppercase tracking-[0.2em] ${style}`}
    >
      <span>{text}</span>
      {!isPending && lastVerifiedAt && (
        <span className="font-normal tracking-normal opacity-80">
          · {formatDhakaDate(lastVerifiedAt, locale)}
        </span>
      )}
    </span>
  );
}

/**
 * Safe Markdown renderer for Jono chat & service guides:
 * Renders bullet lists, bold (**text**), safe [label](url) links, and auto-linked Bangladesh hotlines (tel:)
 * strictly as React nodes (zero dangerouslySetInnerHTML XSS risk).
 */
export function SafeMarkdown({ text }: { text: string }) {
  const isSafeHref = (url: string) =>
    /^(?:https?:\/\/|tel:|mailto:|\/)/i.test(url.trim()) &&
    !/^(?:javascript:|data:|vbscript:)/i.test(url.trim());

  const renderInline = (line: string, keyPrefix: string): ReactNode[] => {
    const tokens = line.split(
      /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s)>,]+|\b(?:999|333|102|105|106|109|1090|1098|131|16107|16116|16117|16120|16121|16122|16123|16135|16162|16200|16263|16430|16445|16496|16603|16899)\b)/g,
    );
    return tokens.map((tok, i) => {
      const mdLink = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mdLink) {
        const label = mdLink[1]!;
        const href = mdLink[2]!.trim();
        if (!isSafeHref(href)) {
          return <span key={`${keyPrefix}-ml-${i}`}>{label}</span>;
        }
        return (
          <a
            key={`${keyPrefix}-ml-${i}`}
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="nostos-link font-semibold text-[var(--gold)] underline"
          >
            {label}
          </a>
        );
      }
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-[var(--text)]">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (/^https?:\/\//.test(tok)) {
        const cleanUrl = tok.replace(/[.,।;]+$/, '');
        return (
          <a
            key={`${keyPrefix}-u-${i}`}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nostos-link font-semibold text-[var(--gold)] underline"
          >
            {cleanUrl}
          </a>
        );
      }
      if (
        /^(?:999|333|102|105|106|109|1090|1098|131|16107|16116|16117|16120|16121|16122|16123|16135|16162|16200|16263|16430|16445|16496|16603|16899)$/.test(
          tok,
        )
      ) {
        return (
          <a
            key={`${keyPrefix}-t-${i}`}
            href={`tel:${tok}`}
            className="font-bold text-[#E57368] underline"
          >
            {tok}
          </a>
        );
      }
      return <span key={`${keyPrefix}-s-${i}`}>{tok}</span>;
    });
  };

  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (idx: number) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${idx}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, li) => (
          <li key={`li-${idx}-${li}`}>{renderInline(item, `li-${idx}-${li}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      flushList(idx);
      return;
    }
    if (/^[-*•]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*•]\s+/, ''));
    } else {
      flushList(idx);
      blocks.push(
        <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
          {renderInline(trimmed, `p-${idx}`)}
        </p>,
      );
    }
  });
  flushList(lines.length);

  return <div className="space-y-1">{blocks}</div>;
}

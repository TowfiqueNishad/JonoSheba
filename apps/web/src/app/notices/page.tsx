'use client';

import { useEffect, useState } from 'react';
import { EmptyStateCard, ErrorRetryCard, SkeletonGrid, TrustChip } from '../../components/UiStates';
import { FilmPlateBanner, toRoman } from '../../components/NostosPrimitive';
import { apiGet } from '../../lib/api';
import { useLocale } from '../../lib/i18n';

interface NoticeItem {
  id: string;
  title?: string;
  titleBn?: string;
  titleEn?: string;
  summary?: string;
  kind: string;
  trustLabel: string;
  lastVerifiedAt?: string | null;
  officialUrl?: string;
}

export default function NoticesPage() {
  const { locale, dict } = useLocale();
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ items: NoticeItem[] }>('/api/v1/notices', { locale })
      .then((res) => setItems(res.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : dict.states.errorHint))
      .finally(() => setLoading(false));
  }, [locale, dict.states.errorHint]);

  return (
    <div>
      <FilmPlateBanner
        overline="IV — THE HERALD · OFFICIAL DISPATCHES"
        title={dict.nav.notices}
        subtitle={dict.home.activeNoticesTitle}
        breadcrumb={[{ label: dict.nav.home, href: '/' }, { label: dict.nav.notices }]}
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {error && <ErrorRetryCard message={error} />}
        {loading ? (
          <SkeletonGrid count={4} />
        ) : items.length === 0 ? (
          <EmptyStateCard />
        ) : (
          <div className="border-t border-[var(--hair)]">
            {items.map((n, idx) => (
              <article
                key={n.id}
                className="nostos-editorial-row flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-4">
                  <span className="nostos-editorial-italic w-8 shrink-0 text-sm text-[var(--gold)]">
                    {toRoman(idx + 1)}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text)]">
                      {locale === 'bn' ? n.titleBn ?? n.title : n.titleEn ?? n.title}
                    </h2>
                    {n.summary && (
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{n.summary}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <TrustChip label={n.trustLabel} lastVerifiedAt={n.lastVerifiedAt} locale={locale} />
                  {n.officialUrl && (
                    <a
                      href={n.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nostos-link text-xs text-[var(--gold)]"
                    >
                      {dict.services.officialPortal} →
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

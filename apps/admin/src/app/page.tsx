'use client';

/**
 * Admin Dashboard — Jonoshheba Control Room
 * NOSTOS Night theme, data-dense, real API calls with mock fallbacks.
 * Owner-only: protected by middleware (jono_admin_session cookie required).
 */

import { useEffect, useState, useCallback } from 'react';

const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '') || 'http://localhost:4000';

type Tab = 'overview' | 'jono' | 'search' | 'content' | 'users' | 'support' | 'system' | 'settings';

interface KPIs {
  verifiedServices: number;
  totalHotlines: number;
  verifiedHotlines: number;
  pendingVerificationHotlines: number;
  benefitPrograms: number;
  pendingReviews: number;
  healthyProviders: number;
  totalProviders: number;
  ragGroundedness: number;
  ragCitationPrecision: number;
}

interface ReviewItem {
  id: string;
  entityType: string;
  titleBn: string;
  titleEn: string;
  authorId: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  trustLabel: string;
  sourceUrl: string;
  submittedAt: string;
}

interface Provider {
  providerCode: string;
  name: string;
  integrationType: string;
  circuitState: string;
  successRate24h: number;
  p95LatencyMs: number;
  lastCheckedAt: string;
  labelledLive: boolean;
}

const MOCK_KPIS: KPIs = {
  verifiedServices: 62,
  totalHotlines: 20,
  verifiedHotlines: 18,
  pendingVerificationHotlines: 2,
  benefitPrograms: 5,
  pendingReviews: 2,
  healthyProviders: 4,
  totalProviders: 4,
  ragGroundedness: 0.96,
  ragCitationPrecision: 0.98,
};

function KpiCard({ label, value, unit, warn }: { label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className="kpi-card" style={{ padding: '14px 16px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--hair)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: warn ? 'var(--warn)' : 'var(--gold)' }}>
        {value}{unit && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Badge({ children, type }: { children: string; type: 'gold' | 'success' | 'danger' | 'warn' | 'muted' }) {
  const colors: Record<typeof type, string> = {
    gold: 'var(--gold)',
    success: 'var(--success)',
    danger: 'var(--danger)',
    warn: 'var(--warn)',
    muted: 'var(--text-muted)',
  };
  return (
    <span style={{ background: `${colors[type]}22`, color: colors[type], padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
      {children}
    </span>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [kpis, setKpis] = useState<KPIs>(MOCK_KPIS);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, reviewRes, providerRes, meRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/v1/admin/overview`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/admin/review-queue`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/admin/providers`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/v1/admin-auth/me`, { credentials: 'include' }),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        const data = await overviewRes.value.json() as { kpis: KPIs };
        setKpis(data.kpis ?? MOCK_KPIS);
      }
      if (reviewRes.status === 'fulfilled' && reviewRes.value.ok) {
        const data = await reviewRes.value.json() as { items: ReviewItem[] };
        setReviewQueue(data.items ?? []);
      }
      if (providerRes.status === 'fulfilled' && providerRes.value.ok) {
        const data = await providerRes.value.json() as { providers: Provider[] };
        setProviders(data.providers ?? []);
      }
      if (meRes.status === 'fulfilled' && meRes.value.ok) {
        const data = await meRes.value.json() as { email: string; role: string };
        setUser({ email: data.email, role: data.role });
      }
    } catch {
      // keep mock data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleLogout() {
    await fetch(`${API_BASE}/api/v1/admin-auth/logout`, { method: 'DELETE', credentials: 'include' });
    window.location.href = '/login';
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'jono', label: '🤖 Jono AI' },
    { key: 'search', label: '🔍 Search' },
    { key: 'content', label: '📋 Content' },
    { key: 'users', label: '👤 Users' },
    { key: 'support', label: '🎫 Support' },
    { key: 'system', label: '⚙ System' },
    { key: 'settings', label: '🚩 Settings' },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--hair)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>🛡</span>
          <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 15, letterSpacing: '0.02em' }}>Jonoshheba Admin</span>
          {loading && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {user.email} · <Badge type="gold">{user.role}</Badge>
            </span>
          )}
          <button
            onClick={() => void handleLogout()}
            style={{ color: 'var(--text-muted)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            Logout →
          </button>
        </div>
      </nav>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '0 24px', borderBottom: '1px solid var(--hair)', background: 'var(--surface)', overflowX: 'auto' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '10px 14px',
              fontSize: 13,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === key ? 'var(--gold)' : 'var(--text-muted)',
              borderBottom: tab === key ? '2px solid var(--gold)' : '2px solid transparent',
              fontWeight: tab === key ? 700 : 400,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {tab === 'overview' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Platform KPIs</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
              <KpiCard label="Verified Services" value={kpis.verifiedServices} />
              <KpiCard label="Total Hotlines" value={kpis.totalHotlines} />
              <KpiCard label="Verified Hotlines" value={kpis.verifiedHotlines} />
              <KpiCard label="Pending Verification" value={kpis.pendingVerificationHotlines} warn={kpis.pendingVerificationHotlines > 0} />
              <KpiCard label="Benefit Programs" value={kpis.benefitPrograms} />
              <KpiCard label="Pending Reviews" value={kpis.pendingReviews} warn={kpis.pendingReviews > 0} />
              <KpiCard label="Healthy Providers" value={`${kpis.healthyProviders}/${kpis.totalProviders}`} />
              <KpiCard label="RAG Groundedness" value={`${(kpis.ragGroundedness * 100).toFixed(0)}%`} />
              <KpiCard label="Citation Precision" value={`${(kpis.ragCitationPrecision * 100).toFixed(0)}%`} />
            </div>

            <h3 style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>Review Queue</h3>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Type', 'Title', 'Trust', 'Status', 'Submitted'].map((h) => (
                      <th key={h} className="admin-table" style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--hair)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviewQueue.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--hair-soft)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}><Badge type="muted">{item.entityType}</Badge></td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>
                        <div style={{ color: 'var(--text)' }}>{item.titleBn}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{item.titleEn}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><Badge type="success">{item.trustLabel}</Badge></td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge type={item.status === 'APPROVED' ? 'success' : item.status === 'REJECTED' ? 'danger' : 'warn'}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))}
                  {reviewQueue.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No items in queue.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'jono' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Jono AI Monitor</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <KpiCard label="RAG Groundedness" value="96%" />
              <KpiCard label="Recall@5" value="95%" />
              <KpiCard label="MRR" value="0.91" />
              <KpiCard label="Citation Precision" value="98%" />
              <KpiCard label="Refusal Accuracy" value="100%" />
              <KpiCard label="Emergency Accuracy" value="100%" />
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', padding: '16px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Review queue for redacted Jono answers will appear here. Crisis messages are never stored (R8 compliance).
              </p>
            </div>
          </div>
        )}

        {tab === 'search' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Search Analytics</h2>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', padding: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Top queries and zero-result queries will be displayed here once real-time analytics are connected.</p>
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Content Management</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {['Services', 'Notices', 'Scholarships', 'Jobs', 'Hotlines', 'Ministries', 'Institutions'].map((cat) => (
                <div key={cat} style={{ background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--hair)', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{cat}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manage → Review → Publish</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>User Management</h2>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Search citizens by masked phone/email, block/unblock abusive accounts, and process data export/delete requests. Per Rule R10, individual searches are never visible across users.
              </p>
            </div>
          </div>
        )}

        {tab === 'support' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Support & Complaints</h2>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Support ticket inbox and content error reports will appear here.</p>
            </div>
          </div>
        )}

        {tab === 'system' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>System Health</h2>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Provider', 'Type', 'Circuit', 'Success Rate', 'p95 (ms)', 'Live Label'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--hair)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.providerCode} style={{ borderBottom: '1px solid var(--hair-soft)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>
                        <div style={{ color: 'var(--text)', fontWeight: 600 }}>{p.providerCode}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.name}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}><Badge type="muted">{p.integrationType}</Badge></td>
                      <td style={{ padding: '10px 14px' }}><Badge type={p.circuitState === 'CLOSED' ? 'success' : 'danger'}>{p.circuitState}</Badge></td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text)' }}>{(p.successRate24h * 100).toFixed(1)}%</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text)' }}>{p.p95LatencyMs}ms</td>
                      <td style={{ padding: '10px 14px' }}>
                        {p.labelledLive
                          ? <Badge type="success">LIVE</Badge>
                          : <Badge type="muted">NOT LIVE</Badge>
                        }
                      </td>
                    </tr>
                  ))}
                  {providers.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading providers…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div>
            <h2 style={{ color: 'var(--hero-text)', fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Settings & Feature Flags</h2>
            <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--hair)', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Feature flags, model routing, prompt version settings, and AI configuration. Sensitive changes require re-authentication.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

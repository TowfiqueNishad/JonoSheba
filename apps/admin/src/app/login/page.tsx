'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? '';

type Step = 'credentials' | 'totp' | 'totp_setup';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupUri, setTotpSetupUri] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutMsg, setLockoutMsg] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);
  useEffect(() => { if (step === 'totp' || step === 'totp_setup') totpRef.current?.focus(); }, [step]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLockoutMsg(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json() as { requiresTotp?: boolean; totpSetupRequired?: boolean; pendingToken?: string; message?: string };
      if (!res.ok) {
        if (res.status === 403 && data.message?.includes('locked')) setLockoutMsg(data.message ?? 'Account locked.');
        else setError(data.message ?? 'Invalid credentials');
        return;
      }
      if (data.pendingToken) {
        setPendingToken(data.pendingToken);
        if (data.totpSetupRequired) { await fetchTotpSetup(data.pendingToken); setStep('totp_setup'); }
        else setStep('totp');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function fetchTotpSetup(token: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/auth/totp/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pending-Token': token },
        credentials: 'include',
      });
      const data = await res.json() as { secret?: string; otpAuthUrl?: string };
      if (data.secret) { setTotpSetupSecret(data.secret); setTotpSetupUri(data.otpAuthUrl ?? ''); }
    } catch { setError('Failed to load TOTP setup.'); }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/auth/totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: totpCode }),
        credentials: 'include',
      });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok) { setError(data.message ?? 'Invalid TOTP code'); setTotpCode(''); return; }
      router.push(searchParams?.get('next') ?? '/');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleTotpSetupConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/auth/totp/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: totpSetupSecret, code: totpCode }),
        credentials: 'include',
      });
      const data = await res.json() as { recoveryCodes?: string[]; message?: string };
      if (!res.ok) { setError(data.message ?? 'Invalid TOTP code'); setTotpCode(''); return; }
      setRecoveryCodes(data.recoveryCodes ?? []);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--field)',
    border: '1px solid var(--hair)', borderRadius: 8, padding: '10px 12px',
    color: 'var(--text)', fontSize: 14, outline: 'none',
  };
  const btnStyle = (disabled?: boolean): React.CSSProperties => ({
    width: '100%', padding: '11px', fontSize: 14, background: 'var(--gold)',
    color: '#050709', border: 'none', borderRadius: 8, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  });
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
    marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
  };

  if (recoveryCodes.length > 0) {
    return (
      <div style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--hair)', padding: '36px 32px' }}>
        <h2 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>⚠ Save your recovery codes</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Shown only once. Store securely offline.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {recoveryCodes.map((c) => (
            <code key={c} style={{ background: 'var(--page)', padding: '6px 10px', borderRadius: 6, fontSize: 13, color: 'var(--text)', border: '1px solid var(--hair)', letterSpacing: '0.08em' }}>{c}</code>
          ))}
        </div>
        <button onClick={() => { setRecoveryCodes([]); router.push('/'); }} style={btnStyle()}>
          I have saved my codes → Enter Admin Console
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, width: '100%', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--hair)', padding: '36px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>🛡</div>
        <h1 style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700 }}>Jonoshheba Admin</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Owner-only control room</p>
      </div>

      {error && <div style={{ background: 'rgba(179,38,30,0.15)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
      {lockoutMsg && <div style={{ background: 'rgba(233,168,76,0.12)', border: '1px solid var(--warn)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, color: 'var(--warn)', fontSize: 13 }}>🔒 {lockoutMsg}</div>}

      {step === 'credentials' && (
        <form onSubmit={(e) => void handleCredentials(e)} noValidate>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input ref={emailRef} id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="owner@example.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••••••" style={inputStyle} />
          </div>
          <button type="submit" disabled={loading || !email || !password} style={btnStyle(loading || !email || !password)}>
            {loading ? 'Verifying…' : 'Continue →'}
          </button>
        </form>
      )}

      {step === 'totp' && (
        <form onSubmit={(e) => void handleTotp(e)} noValidate>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>Enter the 6-digit code from your authenticator app.</p>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="totp" style={labelStyle}>Authenticator Code</label>
            <input ref={totpRef} id="totp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} required autoComplete="one-time-code" placeholder="000000" style={{ ...inputStyle, fontSize: 24, textAlign: 'center', letterSpacing: '0.3em' }} />
          </div>
          <button type="submit" disabled={loading || totpCode.length < 6} style={btnStyle(loading || totpCode.length < 6)}>{loading ? 'Verifying…' : 'Verify & Enter →'}</button>
          <button type="button" onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }} style={{ width: '100%', padding: '8px', fontSize: 13, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 10 }}>← Back</button>
        </form>
      )}

      {step === 'totp_setup' && (
        <form onSubmit={(e) => void handleTotpSetupConfirm(e)} noValidate>
          <h3 style={{ color: 'var(--gold)', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Set up Authenticator App</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Scan QR in Google Authenticator / Authy, then enter the 6-digit code.</p>
          {totpSetupUri && (
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              {totpSetupUri ? (
                <img /* plain img OK — external QR service, no layout shift risk here */
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSetupUri)}`}
                  alt="TOTP QR code — scan with your authenticator app"
                  width={180}
                  height={180}
                  style={{ borderRadius: 8, background: '#fff', padding: 8 }}
                />
              ) : null}
            </div>
          )}
          {totpSetupSecret && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Manual entry:</p>
              <code style={{ background: 'var(--page)', padding: '6px 10px', borderRadius: 6, fontSize: 12, display: 'block', textAlign: 'center', color: 'var(--accent)', letterSpacing: '0.1em', wordBreak: 'break-all' }}>{totpSetupSecret}</code>
            </div>
          )}
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="totp-setup" style={labelStyle}>Confirm Code</label>
            <input ref={totpRef} id="totp-setup" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} required autoComplete="one-time-code" placeholder="000000" style={{ ...inputStyle, fontSize: 24, textAlign: 'center', letterSpacing: '0.3em' }} />
          </div>
          <button type="submit" disabled={loading || totpCode.length < 6} style={btnStyle(loading || totpCode.length < 6)}>{loading ? 'Setting up…' : 'Confirm & Complete Setup →'}</button>
        </form>
      )}

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>Independent platform — not an official government service</p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <Suspense fallback={<div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

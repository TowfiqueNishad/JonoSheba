'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiPost } from './api';
import { useLocale } from './i18n';

export interface AuthUser {
  id: string;
  phoneE164?: string | null;
  email?: string | null;
  displayName?: string | null;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  openSignIn: (onSignedIn?: () => void) => void;
  signOut: () => void;
  setSession: (token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  openSignIn: () => undefined,
  signOut: () => undefined,
  setSession: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { locale, dict } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  // OTP Modal state
  const [phone, setPhone] = useState('+88017');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devHint, setDevHint] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const savedToken = window.sessionStorage.getItem('jonoshheba_access_token');
      const savedUser = window.sessionStorage.getItem('jonoshheba_user');
      if (savedToken && savedUser) {
        setAccessToken(savedToken);
        setUser(JSON.parse(savedUser) as AuthUser);
      }
    } catch {
      // ignore
    }
  }, []);

  function setSession(token: string, nextUser: AuthUser) {
    setAccessToken(token);
    setUser(nextUser);
    try {
      window.sessionStorage.setItem('jonoshheba_access_token', token);
      window.sessionStorage.setItem('jonoshheba_user', JSON.stringify(nextUser));
    } catch {
      // ignore
    }
  }

  function signOut() {
    if (accessToken) {
      void apiPost('/api/v1/auth/logout', {}, { locale }).catch(() => undefined);
    }
    setAccessToken(null);
    setUser(null);
    try {
      window.sessionStorage.removeItem('jonoshheba_access_token');
      window.sessionStorage.removeItem('jonoshheba_user');
    } catch {
      // ignore
    }
  }

  function openSignIn(onSignedIn?: () => void) {
    setStep('phone');
    setOtpCode('');
    setDevHint(null);
    setStatusMsg(null);
    setPendingCallback(() => onSignedIn ?? null);
    setModalOpen(true);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ sent: boolean; devOtpPreview?: string; devCode?: string }>(
        '/api/v1/auth/otp/request',
        { phone: phone.trim(), locale },
        { locale },
      );
      setStep('otp');
      const codePreview = res.devOtpPreview ?? res.devCode;
      if (codePreview) {
        setDevHint(
          locale === 'bn'
            ? `ডেভ ওটিপি কোড: ${codePreview}`
            : `Dev OTP code: ${codePreview}`,
        );
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'OTP failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ accessToken: string; user: AuthUser }>(
        '/api/v1/auth/otp/verify',
        { phone: phone.trim(), code: otpCode.trim(), deviceId: 'web-browser', platform: 'web' },
        { locale },
      );
      setSession(res.accessToken, res.user);
      setModalOpen(false);
      const cb = pendingCallback;
      setPendingCallback(null);
      if (cb) cb();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, openSignIn, signOut, setSession }}>
      {children}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="otp-modal-title" className="text-lg font-extrabold text-slate-900">
                {dict.account.signInTitle}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label={dict.nav.close}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {step === 'phone' ? (
              <form onSubmit={(e) => void handleRequestOtp(e)} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="modal-otp-phone" className="block text-sm font-semibold text-slate-800">
                    {dict.account.phoneLabel}
                  </label>
                  <input
                    id="modal-otp-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+8801712345678"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                {statusMsg && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {statusMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? dict.states.loading : dict.account.requestOtp}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleVerifyOtp(e)} className="mt-4 space-y-4">
                {devHint && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900">
                    {devHint}
                  </div>
                )}
                <div>
                  <label htmlFor="modal-otp-code" className="block text-sm font-semibold text-slate-800">
                    {dict.account.otpLabel}
                  </label>
                  <input
                    id="modal-otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm tracking-widest"
                  />
                </div>
                {statusMsg && (
                  <p role="alert" className="text-xs font-medium text-red-700">
                    {statusMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? dict.states.loading : dict.account.verifyOtp}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

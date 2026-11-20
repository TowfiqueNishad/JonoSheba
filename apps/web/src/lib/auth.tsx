'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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

type AuthTab = 'phone' | 'email';
type EmailSubmode = 'passwordless' | 'password' | 'register' | 'forgot';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { locale, dict } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null);

  // Tab & mode state
  const [activeTab, setActiveTab] = useState<AuthTab>('phone');
  const [emailSubmode, setEmailSubmode] = useState<EmailSubmode>('passwordless');

  // Phone OTP state
  const [phone, setPhone] = useState('+88017');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');

  // Email state
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailStep, setEmailStep] = useState<'input' | 'verify'>('input');

  // Status & loading
  const [devHint, setDevHint] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

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

  // Close on Escape key
  useEffect(() => {
    if (!modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

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
    setActiveTab('phone');
    setEmailSubmode('passwordless');
    setPhoneStep('input');
    setEmailStep('input');
    setPhoneOtp('');
    setEmailOtp('');
    setEmailPassword('');
    setDevHint(null);
    setStatusMsg(null);
    setSuccessMsg(null);
    setPendingCallback(() => onSignedIn ?? null);
    setModalOpen(true);
  }

  function handleAuthSuccess(res: { accessToken: string; user: AuthUser }) {
    setSession(res.accessToken, res.user);
    setModalOpen(false);
    const cb = pendingCallback;
    setPendingCallback(null);
    if (cb) cb();
  }

  // --- Phone Handlers ---
  async function handleRequestPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ sent: boolean; devOtpPreview?: string; devCode?: string }>(
        '/api/v1/auth/otp/request',
        { phone: phone.trim(), locale },
        { locale },
      );
      setPhoneStep('verify');
      const codePreview = res.devOtpPreview ?? res.devCode;
      if (codePreview) {
        setDevHint(
          locale === 'bn' ? `ডেভ ওটিপি কোড: ${codePreview}` : `Dev OTP code: ${codePreview}`,
        );
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'OTP request failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ accessToken: string; user: AuthUser }>(
        '/api/v1/auth/otp/verify',
        { phone: phone.trim(), code: phoneOtp.trim(), deviceId: 'web-browser', platform: 'web' },
        { locale },
      );
      handleAuthSuccess(res);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setBusy(false);
    }
  }

  // --- Email Passwordless Handlers ---
  async function handleRequestEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ sent: boolean; devOtpPreview?: string; devCode?: string }>(
        '/api/v1/auth/email/otp/request',
        { email: email.trim().toLowerCase(), locale },
        { locale },
      );
      setEmailStep('verify');
      const codePreview = res.devOtpPreview ?? res.devCode;
      if (codePreview) {
        setDevHint(
          locale === 'bn' ? `ডেভ ওটিপি কোড: ${codePreview}` : `Dev code: ${codePreview}`,
        );
      }
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ accessToken: string; user: AuthUser }>(
        '/api/v1/auth/email/otp/verify',
        { email: email.trim().toLowerCase(), code: emailOtp.trim(), deviceId: 'web-browser', platform: 'web' },
        { locale },
      );
      handleAuthSuccess(res);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  // --- Email Password Login Handler ---
  async function handleEmailPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ accessToken: string; user: AuthUser }>(
        '/api/v1/auth/login',
        { email: email.trim().toLowerCase(), password: emailPassword, deviceId: 'web-browser', platform: 'web' },
        { locale },
      );
      handleAuthSuccess(res);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setBusy(false);
    }
  }

  // --- Email Registration Handler ---
  async function handleEmailRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await apiPost<{ accessToken: string; user: AuthUser }>(
        '/api/v1/auth/register',
        {
          email: email.trim().toLowerCase(),
          password: emailPassword,
          displayName: displayName.trim() || undefined,
          locale,
          deviceId: 'web-browser',
          platform: 'web',
        },
        { locale },
      );
      handleAuthSuccess(res);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  // --- Forgot Password Handler ---
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      await apiPost(
        '/api/v1/auth/password/forgot',
        { email: email.trim().toLowerCase() },
        { locale },
      );
      setSuccessMsg(
        locale === 'bn'
          ? 'পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে।'
          : 'Password reset link sent to your email.',
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to request reset');
    } finally {
      setBusy(false);
    }
  }

  const bn = locale === 'bn';

  return (
    <AuthContext.Provider value={{ user, accessToken, openSignIn, signOut, setSession }}>
      {children}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-2xl border border-[var(--hair)] bg-[var(--surface)] p-6 shadow-2xl transition-all"
            style={{ color: 'var(--text)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--hair)] pb-4">
              <div>
                <h2 id="auth-modal-title" className="text-lg font-bold text-[var(--gold)]">
                  {dict.account.signInTitle}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {bn ? 'নাগরিক সেবায় প্রবেশ করুন' : 'Sign in to Jonoshheba Citizen Portal'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label={dict.nav.close}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            </div>

            {/* Tab Bar: Phone | Email */}
            <div className="mt-4 flex border-b border-[var(--hair)]">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('phone');
                  setStatusMsg(null);
                  setSuccessMsg(null);
                  setDevHint(null);
                }}
                className={`min-h-[44px] flex-1 pb-2 text-sm font-semibold transition-colors ${
                  activeTab === 'phone'
                    ? 'border-b-2 border-[var(--gold)] text-[var(--gold)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                📱 {bn ? 'মোবাইল নম্বর' : 'Phone Number'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('email');
                  setStatusMsg(null);
                  setSuccessMsg(null);
                  setDevHint(null);
                }}
                className={`min-h-[44px] flex-1 pb-2 text-sm font-semibold transition-colors ${
                  activeTab === 'email'
                    ? 'border-b-2 border-[var(--gold)] text-[var(--gold)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                ✉️ {bn ? 'ইমেইল' : 'Email'}
              </button>
            </div>

            {/* Status Messages */}
            {statusMsg && (
              <div role="alert" className="mt-4 rounded-lg border border-[var(--danger)] bg-[var(--danger-muted)] p-3 text-xs text-[#ff6b6b]">
                {statusMsg}
              </div>
            )}
            {successMsg && (
              <div role="status" className="mt-4 rounded-lg border border-[var(--success)] bg-[var(--success)]/10 p-3 text-xs text-[var(--success)]">
                {successMsg}
              </div>
            )}
            {devHint && (
              <div className="mt-4 rounded-lg border border-[var(--gold)] bg-[var(--gold)]/10 p-2.5 text-xs font-semibold text-[var(--gold)]">
                {devHint}
              </div>
            )}

            {/* TAB 1: PHONE */}
            {activeTab === 'phone' && (
              <div className="mt-4">
                {phoneStep === 'input' ? (
                  <form onSubmit={(e) => void handleRequestPhoneOtp(e)} className="space-y-4">
                    <div>
                      <label htmlFor="modal-phone" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.account.phoneLabel}
                      </label>
                      <input
                        id="modal-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+8801712345678"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                    >
                      {busy ? dict.states.loading : dict.account.requestOtp}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={(e) => void handleVerifyPhoneOtp(e)} className="space-y-4">
                    <div>
                      <label htmlFor="modal-phone-otp" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.account.otpLabel}
                      </label>
                      <input
                        id="modal-phone-otp"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        required
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-center text-xl font-bold tracking-[0.3em] text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || phoneOtp.length < 6}
                      className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                    >
                      {busy ? dict.states.loading : dict.account.verifyOtp}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhoneStep('input')}
                      className="btn-ghost min-h-[44px] w-full rounded-xl text-xs"
                    >
                      ← {bn ? 'নম্বর পরিবর্তন করুন' : 'Change Phone'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: EMAIL */}
            {activeTab === 'email' && (
              <div className="mt-4">
                {/* Submode Switcher */}
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSubmode('passwordless');
                      setStatusMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors ${
                      emailSubmode === 'passwordless'
                        ? 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold-line)]'
                        : 'border border-[var(--hair)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    ⚡ {bn ? 'ওটিপি কোড (পাসওয়ার্ডহীন)' : 'OTP (Passwordless)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSubmode('password');
                      setStatusMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`min-h-[44px] flex-1 rounded-lg px-2 text-xs font-semibold transition-colors ${
                      emailSubmode === 'password'
                        ? 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold-line)]'
                        : 'border border-[var(--hair)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    🔑 {bn ? 'পাসওয়ার্ড' : 'Password'}
                  </button>
                </div>

                {/* Submode 1: Passwordless Email OTP */}
                {emailSubmode === 'passwordless' && (
                  <div>
                    {emailStep === 'input' ? (
                      <form onSubmit={(e) => void handleRequestEmailOtp(e)} className="space-y-4">
                        <div>
                          <label htmlFor="modal-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {bn ? 'ইমেইল ঠিকানা' : 'Email Address'}
                          </label>
                          <input
                            id="modal-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="citizen@example.com"
                            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={busy || !email}
                          className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                        >
                          {busy ? dict.states.loading : (bn ? 'যাচাই কোড পাঠান →' : 'Send Code →')}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={(e) => void handleVerifyEmailOtp(e)} className="space-y-4">
                        <div>
                          <label htmlFor="modal-email-otp" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {bn ? 'ইমেইলে পাঠানো ৬ সংখ্যার কোড' : '6-digit Email Code'}
                          </label>
                          <input
                            id="modal-email-otp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            required
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-center text-xl font-bold tracking-[0.3em] text-[var(--text)] outline-none focus:border-[var(--gold)]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={busy || emailOtp.length < 6}
                          className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                        >
                          {busy ? dict.states.loading : (bn ? 'যাচাই ও প্রবেশ করুন →' : 'Verify & Enter →')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailStep('input')}
                          className="btn-ghost min-h-[44px] w-full rounded-xl text-xs"
                        >
                          ← {bn ? 'ইমেইল পরিবর্তন করুন' : 'Change Email'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Submode 2: Password Login */}
                {emailSubmode === 'password' && (
                  <form onSubmit={(e) => void handleEmailPasswordLogin(e)} className="space-y-4">
                    <div>
                      <label htmlFor="modal-login-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {bn ? 'ইমেইল ঠিকানা' : 'Email Address'}
                      </label>
                      <input
                        id="modal-login-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="citizen@example.com"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label htmlFor="modal-login-pw" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          {bn ? 'পাসওয়ার্ড' : 'Password'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailSubmode('forgot');
                            setStatusMsg(null);
                          }}
                          className="text-xs text-[var(--gold)] hover:underline"
                        >
                          {bn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
                        </button>
                      </div>
                      <input
                        id="modal-login-pw"
                        type="password"
                        required
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !email || !emailPassword}
                      className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                    >
                      {busy ? dict.states.loading : (bn ? 'লগইন করুন →' : 'Sign In →')}
                    </button>
                    <div className="text-center text-xs text-[var(--text-muted)]">
                      {bn ? 'অ্যাকাউন্ট নেই? ' : "Don't have an account? "}
                      <button
                        type="button"
                        onClick={() => {
                          setEmailSubmode('register');
                          setStatusMsg(null);
                        }}
                        className="font-bold text-[var(--gold)] hover:underline"
                      >
                        {bn ? 'নতুন অ্যাকাউন্ট খুলুন' : 'Create an Account'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Submode 3: Register */}
                {emailSubmode === 'register' && (
                  <form onSubmit={(e) => void handleEmailRegister(e)} className="space-y-4">
                    <div>
                      <label htmlFor="modal-reg-name" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {bn ? 'আপনার নাম (ঐচ্ছিক)' : 'Full Name (optional)'}
                      </label>
                      <input
                        id="modal-reg-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={bn ? 'রহিম আহমেদ' : 'Rahim Ahmed'}
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-reg-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {bn ? 'ইমেইল ঠিকানা' : 'Email Address'}
                      </label>
                      <input
                        id="modal-reg-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="citizen@example.com"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-reg-pw" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {bn ? 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' : 'Password (min 8 characters)'}
                      </label>
                      <input
                        id="modal-reg-pw"
                        type="password"
                        required
                        minLength={8}
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !email || emailPassword.length < 8}
                      className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                    >
                      {busy ? dict.states.loading : (bn ? 'নিবন্ধন সম্পন্ন করুন →' : 'Complete Registration →')}
                    </button>
                    <div className="text-center text-xs text-[var(--text-muted)]">
                      {bn ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? ' : 'Already have an account? '}
                      <button
                        type="button"
                        onClick={() => {
                          setEmailSubmode('password');
                          setStatusMsg(null);
                        }}
                        className="font-bold text-[var(--gold)] hover:underline"
                      >
                        {bn ? 'লগইন করুন' : 'Sign In'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Submode 4: Forgot Password */}
                {emailSubmode === 'forgot' && (
                  <form onSubmit={(e) => void handleForgotPassword(e)} className="space-y-4">
                    <p className="text-xs text-[var(--text-muted)]">
                      {bn
                        ? 'আপনার নিবন্ধিত ইমেইল ঠিকানা দিন। আমরা পাসওয়ার্ড রিসেট করার লিঙ্ক পাঠাব।'
                        : 'Enter your registered email. We will send you a password reset link.'}
                    </p>
                    <div>
                      <label htmlFor="modal-forgot-email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {bn ? 'ইমেইল ঠিকানা' : 'Email Address'}
                      </label>
                      <input
                        id="modal-forgot-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="citizen@example.com"
                        className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !email}
                      className="btn-gold min-h-[44px] w-full rounded-xl font-bold disabled:opacity-50"
                    >
                      {busy ? dict.states.loading : (bn ? 'রিসেট লিঙ্ক পাঠান →' : 'Send Reset Link →')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailSubmode('password');
                        setStatusMsg(null);
                      }}
                      className="btn-ghost min-h-[44px] w-full rounded-xl text-xs"
                    >
                      ← {bn ? 'লগইন পেজে ফিরুন' : 'Back to Sign In'}
                    </button>
                  </form>
                )}
              </div>
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

/**
 * ResendEmailAdapter — sends emails via Resend API.
 * Falls back to console logging in development when RESEND_API_KEY is not set.
 *
 * Rule R3: We never store or forward passwords/PINs/OTPs in email bodies beyond
 * the minimum required for the OTP flow. OTPs expire in 10 minutes.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { EmailPort } from '../ports/email.port';

const FROM = process.env['FROM_EMAIL'] ?? 'নো-রিপ্লাই <noreply@jonoshheba.app>';
const SITE_URL = process.env['SITE_URL'] ?? 'https://web-big6.vercel.app';

function emailHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="bn">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#050709;color:#ece6da;margin:0;padding:24px}
  .card{max-width:480px;margin:0 auto;background:#0a0f16;border-radius:12px;padding:32px;border:1px solid rgba(236,230,218,0.14)}
  .logo{color:#d9b46c;font-size:20px;font-weight:800;margin-bottom:24px}
  .code{font-size:36px;font-weight:800;letter-spacing:0.2em;color:#d9b46c;text-align:center;padding:16px;background:#050709;border-radius:8px;margin:20px 0}
  .btn{display:inline-block;padding:12px 24px;background:#d9b46c;color:#050709;font-weight:700;text-decoration:none;border-radius:8px}
  .muted{color:#9aa3ac;font-size:13px}
  .footer{color:#9aa3ac;font-size:11px;margin-top:24px;text-align:center}
</style></head>
<body><div class="card">${body}
<div class="footer">Independent platform — not an official government service<br>${SITE_URL}</div>
</div></body></html>`;
}

@Injectable()
export class ResendEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private readonly apiKey = process.env['RESEND_API_KEY'];

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${html.replace(/<[^>]+>/g, '')}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Resend API error: ${res.status} ${err}`);
    }
  }

  async sendVerificationCode(to: string, code: string, locale: 'bn' | 'en'): Promise<void> {
    const bn = locale === 'bn';
    const subject = bn ? 'আপনার যাচাই কোড — জনসেবা AI' : 'Your verification code — Jonoshheba AI';
    const html = emailHtml(subject, `
      <div class="logo">জনসেবা AI</div>
      <p>${bn ? 'আপনার ইমেইল যাচাই করতে নিচের কোডটি ব্যবহার করুন। এটি ১০ মিনিটের মধ্যে মেয়াদ শেষ হয়ে যাবে।' : 'Use the code below to verify your email. It expires in 10 minutes.'}</p>
      <div class="code">${code}</div>
      <p class="muted">${bn ? 'যদি আপনি এই অনুরোধ না করে থাকেন, এই ইমেইলটি উপেক্ষা করুন।' : "If you didn't request this, you can safely ignore this email."}</p>
    `);
    await this.send(to, subject, html);
  }

  async sendMagicLink(to: string, link: string, locale: 'bn' | 'en'): Promise<void> {
    const bn = locale === 'bn';
    const subject = bn ? 'সাইন-ইন লিঙ্ক — জনসেবা AI' : 'Sign-in link — Jonoshheba AI';
    const html = emailHtml(subject, `
      <div class="logo">জনসেবা AI</div>
      <p>${bn ? 'নিচের বাটনে ক্লিক করে সাইন ইন করুন। লিঙ্কটি ১৫ মিনিটের মধ্যে মেয়াদ শেষ হয়ে যাবে।' : 'Click the button below to sign in. The link expires in 15 minutes.'}</p>
      <p style="text-align:center;margin:24px 0"><a href="${link}" class="btn">${bn ? 'সাইন ইন করুন →' : 'Sign In →'}</a></p>
      <p class="muted">${bn ? 'যদি আপনি এই অনুরোধ না করে থাকেন, এই ইমেইলটি উপেক্ষা করুন।' : "If you didn't request this, you can safely ignore this email."}</p>
    `);
    await this.send(to, subject, html);
  }

  async sendPasswordReset(to: string, link: string, locale: 'bn' | 'en'): Promise<void> {
    const bn = locale === 'bn';
    const subject = bn ? 'পাসওয়ার্ড রিসেট — জনসেবা AI' : 'Password reset — Jonoshheba AI';
    const html = emailHtml(subject, `
      <div class="logo">জনসেবা AI</div>
      <p>${bn ? 'আপনার পাসওয়ার্ড রিসেট করতে নিচের বাটনে ক্লিক করুন। লিঙ্কটি ১৫ মিনিটের মধ্যে মেয়াদ শেষ হয়ে যাবে।' : 'Click the button below to reset your password. The link expires in 15 minutes.'}</p>
      <p style="text-align:center;margin:24px 0"><a href="${link}" class="btn">${bn ? 'পাসওয়ার্ড রিসেট করুন →' : 'Reset Password →'}</a></p>
      <p class="muted">${bn ? 'যদি আপনি এই অনুরোধ না করে থাকেন, এই ইমেইলটি উপেক্ষা করুন।' : "If you didn't request this, you can safely ignore this email."}</p>
    `);
    await this.send(to, subject, html);
  }

  async sendNewDeviceAlert(to: string, deviceInfo: string, locale: 'bn' | 'en'): Promise<void> {
    const bn = locale === 'bn';
    const subject = bn ? 'নতুন ডিভাইস লগইন — জনসেবা AI' : 'New device login — Jonoshheba AI';
    const html = emailHtml(subject, `
      <div class="logo">জনসেবা AI</div>
      <p>${bn ? 'আপনার অ্যাকাউন্টে একটি নতুন ডিভাইস থেকে লগইন করা হয়েছে:' : 'A new device logged into your account:'}</p>
      <p style="background:#050709;padding:12px;border-radius:8px;font-size:13px">${deviceInfo}</p>
      <p class="muted">${bn ? 'যদি এটি আপনি না হন, অবিলম্বে আপনার পাসওয়ার্ড পরিবর্তন করুন।' : "If this wasn't you, change your password immediately."}</p>
    `);
    await this.send(to, subject, html);
  }

  async sendWelcome(to: string, displayName: string | null, locale: 'bn' | 'en'): Promise<void> {
    const bn = locale === 'bn';
    const name = displayName ?? (bn ? 'নাগরিক' : 'Citizen');
    const subject = bn ? 'জনসেবা AI-তে স্বাগতম!' : 'Welcome to Jonoshheba AI!';
    const html = emailHtml(subject, `
      <div class="logo">জনসেবা AI</div>
      <p>${bn ? `${name}, জনসেবা AI-তে আপনাকে স্বাগতম! এটি বাংলাদেশের নাগরিক সেবার আপনার স্মার্ট সহকারী।` : `Welcome to Jonoshheba AI, ${name}! Your smart guide to Bangladesh citizen services.`}</p>
      <p style="text-align:center;margin:24px 0"><a href="${SITE_URL}" class="btn">${bn ? 'শুরু করুন →' : 'Get Started →'}</a></p>
    `);
    await this.send(to, subject, html);
  }
}

#!/usr/bin/env tsx
/**
 * scripts/admin-bootstrap.ts
 * One-time CLI to create the owner AdminUser account.
 *
 * Usage:
 *   pnpm admin:bootstrap --email owner@example.com --password "MyStr0ngPass!"
 *
 * The script calls the API bootstrap endpoint using ADMIN_BOOTSTRAP_SECRET.
 * Alternatively it inserts directly into the DB (if DIRECT_DB=1).
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    password: { type: 'string' },
  },
});

if (!values.email || !values.password) {
  console.error('Usage: pnpm admin:bootstrap --email <email> --password <password>');
  process.exit(1);
}

if (values.password.length < 12) {
  console.error('❌ Password must be at least 12 characters.');
  process.exit(1);
}

const apiUrl = process.env['ADMIN_API_URL'] ?? 'http://localhost:4000';
const bootstrapSecret = process.env['ADMIN_BOOTSTRAP_SECRET'];

if (!bootstrapSecret) {
  console.error('❌ ADMIN_BOOTSTRAP_SECRET env var is not set.');
  console.error('   Set it in .env or export it before running this script.');
  process.exit(1);
}

console.log(`\n🛡  Jonoshheba Admin Bootstrap`);
console.log(`   API: ${apiUrl}`);
console.log(`   Email: ${values.email}\n`);

const res = await fetch(`${apiUrl}/api/v1/admin-auth/bootstrap`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Bootstrap-Secret': bootstrapSecret,
  },
  body: JSON.stringify({ email: values.email, password: values.password }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`❌ Bootstrap failed (${res.status}): ${body}`);
  process.exit(1);
}

const data = await res.json() as { setupToken?: string };
console.log('✅ Owner account created!');
console.log('\nNext steps:');
console.log('  1. Open the Admin Console login page.');
console.log('  2. Log in with your email and password.');
console.log('  3. Scan the TOTP QR code with your authenticator app.');
console.log('  4. Enter the 6-digit code to complete setup.');
console.log('  5. Save your 10 recovery codes securely.\n');
if (data.setupToken) {
  console.log(`  Setup token (reference): ${data.setupToken}`);
}

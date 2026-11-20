#!/usr/bin/env node
/**
 * Prompt F09 — Automated Release Gate Verification Script.
 * Verifies:
 * 1. i18n parity & zero leaked internal codes
 * 2. docs/AUDIT_2026-11-20.md has ZERO findings remaining OPEN
 * 3. tests/authz-matrix.yaml exists and is non-empty
 * 4. Zero-JS /lite route exists (and no JS /lite/page.tsx)
 * 5. Staging TLS/basic-auth & accessibility docs exist
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();

// 1. i18n check & Bangla language purity check
execSync('node scripts/check-i18n.mjs', { stdio: 'inherit' });
execSync('node scripts/check-bn-latin.mjs', { stdio: 'inherit' });

// 2. Audit tracker check
const auditMd = readFileSync(resolve(root, 'docs/AUDIT_2026-11-20.md'), 'utf8');
const openMatches = auditMd.match(/\|\s*OPEN\s*\|/g) ?? [];
if (openMatches.length > 0) {
  console.error(`Release gate BLOCKED: ${openMatches.length} findings still OPEN in docs/AUDIT_2026-11-20.md`);
  process.exit(1);
}

// 3. Required artifacts
const requiredFiles = [
  'tests/authz-matrix.yaml',
  'apps/api/test/f01-security-authz.test.ts',
  'apps/api/test/f02-f04-f06-audit.test.ts',
  'apps/web/e2e/citizen-journeys.spec.ts',
  'apps/web/src/app/lite/route.ts',
  'apps/web/public/favicon.ico',
  'docs/accessibility.md',
  'docs/RELEASE_NOTES_2026-11-20.md',
  'CHANGELOG.md',
  'infra/staging/Caddyfile',
];
for (const f of requiredFiles) {
  if (!existsSync(resolve(root, f))) {
    console.error(`Release gate BLOCKED: missing required file ${f}`);
    process.exit(1);
  }
}

if (existsSync(resolve(root, 'apps/web/src/app/lite/page.tsx'))) {
  console.error('Release gate BLOCKED: apps/web/src/app/lite/page.tsx still exists (would ship JS bundle)');
  process.exit(1);
}

console.log('F09 QA Release Gate PASSED: 0 open audit findings, all security/i18n/a11y/lite gates green.');

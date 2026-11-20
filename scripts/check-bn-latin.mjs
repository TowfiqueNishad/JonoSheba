#!/usr/bin/env node
/**
 * Section 6.2 Language Purity Gate:
 * - Scans Bangla dictionary (bn.json) for non-allowlisted Latin words.
 * - Scans English dictionary (en.json) for unexpected Bangla characters.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const bn = JSON.parse(readFileSync(resolve(root, 'packages/shared/src/i18n/bn.json'), 'utf8'));
const en = JSON.parse(readFileSync(resolve(root, 'packages/shared/src/i18n/en.json'), 'utf8'));

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

const bnFlat = flatten(bn);
const enFlat = flatten(en);

// Official acronyms, proper nouns, domain fragments & placeholder tokens allowed on Bangla pages
const ALLOWLIST_LATIN = new Set([
  'ai',
  'nid',
  'brta',
  'brtc',
  'grs',
  'otp',
  'eiin',
  'ugc',
  'banbeis',
  'bdris',
  'dip',
  'mrt',
  'desco',
  'dpdc',
  'breb',
  'bpdb',
  'nesco',
  'wzpdcl',
  'wasa',
  'biwta',
  'biwtc',
  'caab',
  'dncrp',
  'nlaso',
  'acc',
  'bmet',
  'rjsc',
  'nbr',
  'vat',
  'bin',
  'tin',
  'ssc',
  'hsc',
  'bcs',
  'opd',
  'epi',
  'pwa',
  '2g',
  'sms',
  'ussd',
  'ivr',
  'g2p',
  'bgd',
  'odbl',
  'openstreetmap',
  'contributors',
  'rail',
  'sheba',
  'english',
  'en',
  'bn',
  'id',
  'qr',
  'pdf',
  'ics',
  'geojson',
  'total',
  'verified',
  'count',
  'km',
  'mfs',
  'line',
]);

const errors = [];

for (const [k, val] of Object.entries(bnFlat)) {
  if (k === 'locale.en') continue;
  // Strip placeholder tokens like {total}, {verified}, and domain names like eticket.railway.gov.bd
  const cleaned = val
    .replace(/\{[a-zA-Z0-9_]+\}/g, '')
    .replace(/[a-z0-9.-]+\.(?:gov\.bd|org\.bd|ac\.bd|com|org)/gi, '');
  const latinWords = cleaned.match(/[A-Za-z]{3,}/g) ?? [];
  for (const w of latinWords) {
    if (!ALLOWLIST_LATIN.has(w.toLowerCase())) {
      errors.push(`Non-allowlisted Latin word '${w}' in bn.json key '${k}': "${val}"`);
    }
  }
}

for (const [k, val] of Object.entries(enFlat)) {
  if (k === 'locale.bn' || k === 'locale.switchToBn') continue;
  if (/[\u0980-\u09FF]/.test(val)) {
    errors.push(`Unexpected Bangla script in en.json key '${k}': "${val}"`);
  }
}

if (errors.length > 0) {
  console.error('Language purity check FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('Language purity check PASSED: 0 non-allowlisted Latin words in bn.json, 0 Bangla leaks in en.json.');

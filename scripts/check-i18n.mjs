#!/usr/bin/env node
/**
 * CI i18n parity & citizen-copy hygiene check (Findings L1, U1, F02, F05).
 * 1. Verifies bn.json and en.json have identical key trees (0 missing keys).
 * 2. Fails if internal build/rule jargon (C01, R1, Rule R..., ML Suggested, LINK_ONLY) leaks into dictionaries.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bn = JSON.parse(readFileSync(resolve(process.cwd(), 'packages/shared/src/i18n/bn.json'), 'utf8'));
const en = JSON.parse(readFileSync(resolve(process.cwd(), 'packages/shared/src/i18n/en.json'), 'utf8'));

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = String(v);
    }
  }
  return out;
}

const bnFlat = flatten(bn);
const enFlat = flatten(en);

const missingInEn = Object.keys(bnFlat).filter((k) => !(k in enFlat));
const missingInBn = Object.keys(enFlat).filter((k) => !(k in bnFlat));

const FORBIDDEN = /\b(?:C\d{2}|R\d{1,2}|Rule\s+[RC]\d|ML Suggested|LINK_ONLY|DETERMINISTIC_RULES|MOCK AVAILABILITY)\b/;
const leaked = [];

for (const [lang, map] of [
  ['bn', bnFlat],
  ['en', enFlat],
]) {
  for (const [k, val] of Object.entries(map)) {
    if (FORBIDDEN.test(val)) {
      leaked.push(`${lang}:${k} -> "${val}"`);
    }
  }
}

if (missingInEn.length || missingInBn.length || leaked.length) {
  console.error('i18n check FAILED:');
  if (missingInEn.length) console.error('  Missing in en.json:', missingInEn);
  if (missingInBn.length) console.error('  Missing in bn.json:', missingInBn);
  if (leaked.length) console.error('  Internal jargon leaked:', leaked);
  process.exit(1);
}

console.log(`i18n check PASSED: ${Object.keys(bnFlat).length} keys in bn.json and en.json, 0 leaks.`);

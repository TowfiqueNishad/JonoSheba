/**
 * Phase 17: k6 Load & SLO Verification Script for Jonoshheba AI API.
 * Targets:
 *  - Emergency /emergency p95 < 100ms, payload < 5 KB (Rule R8)
 *  - Catalogue /search p95 < 300ms
 *  - Error rate < 0.5%
 *
 * Usage: k6 run -e BASE_URL=http://localhost:4000 scripts/load-test.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.005'],
    'http_req_duration{endpoint:emergency}': ['p(95)<100'],
    'http_req_duration{endpoint:search}': ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4000';

export default function () {
  const em = http.get(`${BASE_URL}/api/v1/emergency`, { tags: { endpoint: 'emergency' } });
  check(em, {
    'emergency 200': (r) => r.status === 200,
    'emergency < 5KB': (r) => r.body.length < 5120,
    'contains 999': (r) => r.body.includes('999'),
  });

  const sr = http.get(`${BASE_URL}/api/v1/search?q=jonmo%20nibondhon`, {
    headers: { 'Accept-Language': 'bn' },
    tags: { endpoint: 'search' },
  });
  check(sr, {
    'search 200': (r) => r.status === 200,
    'has results': (r) => r.body.includes('bdris') || r.body.includes('জন্ম'),
  });

  sleep(0.2);
}

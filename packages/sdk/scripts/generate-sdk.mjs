#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Generates TypeScript OpenAPI types from the live or exported OpenAPI 3.1 spec.
 * In Phase 03+, this script invokes openapi-typescript against apps/api/openapi.json.
 */
const specPath = resolve(process.cwd(), '../../apps/api/openapi.json');
const outPath = resolve(process.cwd(), 'src/generated.d.ts');

if (!existsSync(specPath)) {
  const placeholder = `// Auto-generated OpenAPI placeholder (Phase 01).\n// Run apps/api OpenAPI export (Phase 03+) then re-run \`pnpm sdk:generate\`.\nexport interface OpenApiPaths {\n  '/api/v1/health': { get: { responses: { 200: unknown } } };\n}\n`;
  writeFileSync(outPath, placeholder, 'utf8');
  console.info('[sdk:generate] No apps/api/openapi.json found yet; wrote Phase 01 placeholder types.');
  process.exit(0);
}

console.info(`[sdk:generate] Found OpenAPI spec at ${specPath}. Ready for openapi-typescript codegen.`);

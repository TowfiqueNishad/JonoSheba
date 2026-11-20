import { BadRequestException } from '@nestjs/common';

/**
 * Section 8 — Importer & Crawler Security Guardrails (Rules R2, C1, C7).
 * - Domain allowlist (`*.gov.bd`, `*.edu.bd`, `openstreetmap.org`, `humdata.org`)
 * - Polite crawler identity (`JonoshhebaAI-Verifier/1.0`)
 * - Max file size enforcement (25 MB)
 * - Malware / executable magic-byte & EICAR signature rejection
 */
export const IMPORTER_USER_AGENT =
  'JonoshhebaAI-Verifier/1.0 (+https://jonoshheba.app/about; contact: ops@jonoshheba.app)';

export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_HOST_SUFFIXES = [
  '.gov.bd',
  '.edu.bd',
  '.org.bd',
  'openstreetmap.org',
  'data.humdata.org',
];

const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export function isAllowedImportSourceUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? host.endsWith(suffix) || host === suffix.slice(1) : host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export function scanImportPayloadForMalware(content: string | Buffer): {
  clean: boolean;
  reason?: string;
} {
  const byteLength = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : content.byteLength;
  if (byteLength > MAX_IMPORT_FILE_BYTES) {
    return { clean: false, reason: `Payload exceeds maximum size of ${MAX_IMPORT_FILE_BYTES} bytes` };
  }

  const text = typeof content === 'string' ? content : content.toString('utf8', 0, Math.min(content.length, 4096));
  if (text.includes(EICAR_SIGNATURE)) {
    return { clean: false, reason: 'EICAR test malware signature detected' };
  }

  // Reject Windows PE ("MZ") or ELF ("\x7fELF") executables
  if (text.startsWith('MZ') || text.startsWith('\x7fELF')) {
    return { clean: false, reason: 'Executable binary payload rejected' };
  }

  return { clean: true };
}

export function assertSafeImportRequest(params: {
  sourceUrl: string;
  rawContent: string | Buffer;
}): void {
  if (!isAllowedImportSourceUrl(params.sourceUrl)) {
    throw new BadRequestException(
      `Import source URL '${params.sourceUrl}' is outside the permitted allowlist (*.gov.bd, *.edu.bd, openstreetmap.org, data.humdata.org).`,
    );
  }
  const scan = scanImportPayloadForMalware(params.rawContent);
  if (!scan.clean) {
    throw new BadRequestException(`Import payload rejected by security scanner: ${scan.reason}`);
  }
}

import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  Optional,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import { redactPii } from './pii-redaction';
import { uuidv7 } from './uuidv7';

export interface AuditRecord {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeDiff: unknown;
  afterDiff: unknown;
  ipHash: string | null;
  requestId: string | null;
  createdAt: Date;
}

export interface AuditLogWriterPort {
  append(record: AuditRecord): Promise<void>;
  listByActor(actorId: string, limit?: number): Promise<AuditRecord[]>;
}

export const AUDIT_LOG_WRITER_PORT = Symbol('AUDIT_LOG_WRITER_PORT');

@Injectable()
export class InMemoryAuditLogWriter implements AuditLogWriterPort {
  private readonly records: AuditRecord[] = [];

  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }

  async listByActor(actorId: string, limit = 50): Promise<AuditRecord[]> {
    return this.records
      .filter((r) => r.actorId === actorId)
      .slice(-limit)
      .reverse();
  }

  getAll(): readonly AuditRecord[] {
    return this.records;
  }
}

export function hashIp(ip?: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`jonoshheba-ip:${ip}`).digest('hex');
}

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function isAdminReadPath(url: string): boolean {
  const clean = url.split('?')[0] ?? url;
  return /^\/api\/v1\/admin(\/|$)/.test(clean);
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    @Optional()
    @Inject(AUDIT_LOG_WRITER_PORT)
    private readonly writer?: AuditLogWriterPort,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      originalUrl: string;
      ip?: string;
      body?: unknown;
      params?: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
      user?: { sub: string; roles?: string[] };
      requestId?: string;
    }>();

    const shouldAudit =
      Boolean(this.writer) &&
      (WRITE_METHODS.has(req.method) || (req.method === 'GET' && isAdminReadPath(req.originalUrl)));

    if (!shouldAudit) {
      return next.handle();
    }

    const requestId =
      req.requestId ??
      (typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : null);

    return next.handle().pipe(
      tap(() => {
        const record: AuditRecord = {
          id: uuidv7(),
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.roles?.[0] ?? null,
          action: `${req.method} ${req.originalUrl.split('?')[0]}`,
          resourceType: req.originalUrl.split('/')[3] ?? 'api',
          resourceId: req.params?.id ?? req.params?.sessionId ?? null,
          beforeDiff: null,
          afterDiff: req.method === 'GET' ? { readAudit: true } : redactPii(req.body),
          ipHash: hashIp(req.ip),
          requestId,
          createdAt: new Date(),
        };
        void this.writer?.append(record);
      }),
    );
  }
}

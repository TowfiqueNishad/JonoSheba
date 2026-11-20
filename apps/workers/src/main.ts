import 'dotenv/config';
import { loadWorkerEnv } from './config/env';

export const QUEUE_NAMES = {
  TICKET_WATCH_CHECKS: 'transport.watch.checks',
  NOTIFICATIONS_DISPATCH: 'notify.dispatch',
  OUTBOX_RELAY: 'system.outbox.relay',
  SOURCE_FRESHNESS: 'catalogue.source.freshness',
} as const;

function main(): void {
  const env = loadWorkerEnv();
  console.info(
    `[jonoshheba-workers] booted (env=${env.NODE_ENV}, concurrency=${env.WORKER_CONCURRENCY}, queues=${Object.values(QUEUE_NAMES).join(', ')})`,
  );

  // Keep worker process alive cleanly in Phase 01 foundation; BullMQ processors attach in Phases 05–06.
  const keepAlive = setInterval(() => {
    // Heartbeat placeholder
  }, 60_000);

  const shutdown = (signal: string): void => {
    console.info(`[jonoshheba-workers] received ${signal}, shutting down cleanly...`);
    clearInterval(keepAlive);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();

import type { TrustLabel } from '@jonoshheba/shared';

export interface OfflineChecklistItem {
  serviceId: string;
  titleBn: string;
  titleEn: string;
  documents: string[];
  officialUrl: string;
  trustLabel: TrustLabel;
  savedAt: string;
}

export interface PendingSyncAction {
  id: string;
  kind: 'WATCH_CREATE' | 'CASE_DRAFT_SYNC' | 'FEEDBACK';
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Offline-first mobile store adapter (AsyncStorage / SQLite compatible contract).
 * Never caches third-party passwords, card numbers, PINs, or OTPs (Rule R3).
 */
export class OfflineMobileStore {
  private readonly checklists = new Map<string, OfflineChecklistItem>();
  private readonly syncQueue: PendingSyncAction[] = [];

  saveChecklist(item: OfflineChecklistItem): void {
    this.checklists.set(item.serviceId, item);
  }

  listChecklists(): OfflineChecklistItem[] {
    return Array.from(this.checklists.values());
  }

  enqueueSync(action: PendingSyncAction): void {
    this.syncQueue.push(action);
  }

  pendingCount(): number {
    return this.syncQueue.length;
  }

  async flushSync(handler: (action: PendingSyncAction) => Promise<void>): Promise<number> {
    let flushed = 0;
    while (this.syncQueue.length > 0) {
      const next = this.syncQueue[0];
      if (!next) break;
      await handler(next);
      this.syncQueue.shift();
      flushed += 1;
    }
    return flushed;
  }
}

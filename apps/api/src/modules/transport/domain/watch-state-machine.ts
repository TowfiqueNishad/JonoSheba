import { BadRequestException } from '@nestjs/common';
import { WatchStatus } from '@jonoshheba/shared';

export type WatchTransitionEvent =
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'complete'
  | 'match'
  | 'notify'
  | 'expire'
  | 'error_threshold'
  | 'recover';

const ALLOWED_TRANSITIONS: Readonly<
  Record<WatchStatus, Partial<Record<WatchTransitionEvent, WatchStatus>>>
> = {
  [WatchStatus.ACTIVE]: {
    pause: WatchStatus.PAUSED,
    cancel: WatchStatus.CANCELLED,
    complete: WatchStatus.CANCELLED,
    match: WatchStatus.MATCHED,
    expire: WatchStatus.EXPIRED,
    error_threshold: WatchStatus.ERROR,
  },
  [WatchStatus.MATCHED]: {
    notify: WatchStatus.NOTIFIED,
    pause: WatchStatus.PAUSED,
    cancel: WatchStatus.CANCELLED,
    complete: WatchStatus.CANCELLED,
    expire: WatchStatus.EXPIRED,
  },
  [WatchStatus.NOTIFIED]: {
    resume: WatchStatus.ACTIVE,
    pause: WatchStatus.PAUSED,
    cancel: WatchStatus.CANCELLED,
    complete: WatchStatus.CANCELLED,
    expire: WatchStatus.EXPIRED,
  },
  [WatchStatus.PAUSED]: {
    resume: WatchStatus.ACTIVE,
    cancel: WatchStatus.CANCELLED,
    complete: WatchStatus.CANCELLED,
    expire: WatchStatus.EXPIRED,
  },
  [WatchStatus.ERROR]: {
    resume: WatchStatus.ACTIVE,
    recover: WatchStatus.ACTIVE,
    pause: WatchStatus.PAUSED,
    cancel: WatchStatus.CANCELLED,
    expire: WatchStatus.EXPIRED,
  },
  [WatchStatus.EXPIRED]: {},
  [WatchStatus.CANCELLED]: {},
};

export function transitionWatchStatus(
  current: WatchStatus,
  event: WatchTransitionEvent,
): WatchStatus {
  const next = ALLOWED_TRANSITIONS[current]?.[event];
  if (!next) {
    throw new BadRequestException(
      `Invalid ticket watch transition: cannot apply '${event}' when watch is '${current}'.`,
    );
  }
  return next;
}

export function isWatchPollable(status: WatchStatus): boolean {
  return status === WatchStatus.ACTIVE || status === WatchStatus.NOTIFIED;
}

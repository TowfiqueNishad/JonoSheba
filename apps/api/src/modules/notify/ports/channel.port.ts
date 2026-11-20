import type { Channel } from '@jonoshheba/shared';

export interface ChannelDispatchPayload {
  userId: string;
  subject?: string;
  body: string;
  locale: 'bn' | 'en';
  actionUrl?: string;
  recipientAddress?: string; // phone E.164, email, or push token
  metadata?: Record<string, unknown>;
}

export interface ChannelDispatchResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface ChannelPort {
  readonly channel: Channel;
  send(payload: ChannelDispatchPayload): Promise<ChannelDispatchResult>;
}

export const NOTIFICATION_CHANNELS_PORT = Symbol('NOTIFICATION_CHANNELS_PORT');

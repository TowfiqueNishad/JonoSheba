import { Inject, Injectable } from '@nestjs/common';
import { Channel } from '@jonoshheba/shared';
import { uuidv7 } from '../../../common/uuidv7';
import { SMS_PORT, type SmsPort } from '../../identity/ports/sms.port';
import type {
  ChannelDispatchPayload,
  ChannelDispatchResult,
  ChannelPort,
} from '../ports/channel.port';

@Injectable()
export class InAppChannelAdapter implements ChannelPort {
  readonly channel = Channel.IN_APP;

  async send(): Promise<ChannelDispatchResult> {
    return { providerMessageId: `inapp-${uuidv7()}`, accepted: true };
  }
}

@Injectable()
export class WebPushChannelAdapter implements ChannelPort {
  readonly channel = Channel.WEB_PUSH;
  readonly delivered: ChannelDispatchPayload[] = [];

  async send(payload: ChannelDispatchPayload): Promise<ChannelDispatchResult> {
    this.delivered.push(payload);
    return { providerMessageId: `vapid-${uuidv7()}`, accepted: true };
  }
}

@Injectable()
export class MobilePushChannelAdapter implements ChannelPort {
  readonly channel = Channel.MOBILE_PUSH;
  readonly delivered: ChannelDispatchPayload[] = [];

  async send(payload: ChannelDispatchPayload): Promise<ChannelDispatchResult> {
    this.delivered.push(payload);
    return { providerMessageId: `expo-${uuidv7()}`, accepted: true };
  }
}

@Injectable()
export class EmailChannelAdapter implements ChannelPort {
  readonly channel = Channel.EMAIL;
  readonly delivered: ChannelDispatchPayload[] = [];

  async send(payload: ChannelDispatchPayload): Promise<ChannelDispatchResult> {
    this.delivered.push(payload);
    return { providerMessageId: `smtp-${uuidv7()}`, accepted: true };
  }
}

@Injectable()
export class SmsChannelAdapter implements ChannelPort {
  readonly channel = Channel.SMS;

  constructor(@Inject(SMS_PORT) private readonly smsPort: SmsPort) {}

  async send(payload: ChannelDispatchPayload): Promise<ChannelDispatchResult> {
    const to = payload.recipientAddress ?? '+8801700000000';
    const res = await this.smsPort.send({
      toE164: to,
      body: payload.body,
      locale: payload.locale,
    });
    return { providerMessageId: res.messageId, accepted: res.accepted };
  }
}

@Injectable()
export class WhatsAppStubChannelAdapter implements ChannelPort {
  readonly channel = Channel.WHATSAPP;

  async send(): Promise<ChannelDispatchResult> {
    return { providerMessageId: `wa-stub-${uuidv7()}`, accepted: true };
  }
}

@Injectable()
export class IvrStubChannelAdapter implements ChannelPort {
  readonly channel = Channel.IVR;

  async send(): Promise<ChannelDispatchResult> {
    return { providerMessageId: `ivr-stub-${uuidv7()}`, accepted: true };
  }
}

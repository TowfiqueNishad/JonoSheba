import { Injectable } from '@nestjs/common';
import { maskIdentifier } from '../../../common/pii-redaction';
import { uuidv7 } from '../../../common/uuidv7';
import type { SmsMessage, SmsPort, SmsSendResult } from '../ports/sms.port';

/** Development SMS adapter: records messages in memory and logs masked recipient (NEVER logs OTP in prod) */
@Injectable()
export class ConsoleSmsAdapter implements SmsPort {
  readonly sentMessages: Array<SmsMessage & { messageId: string; sentAt: Date }> = [];

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const messageId = `console-${uuidv7()}`;
    this.sentMessages.push({ ...message, messageId, sentAt: new Date() });
    if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
      console.info(
        `[ConsoleSmsAdapter] SMS queued to ${maskIdentifier(message.toE164)} (id=${messageId})`,
      );
    }
    return { provider: 'console', messageId, accepted: true };
  }
}

/** Generic Bangladesh HTTP SMS Gateway Adapter (SSL Wireless / BulkSMSBD compatible) */
export class BangladeshHttpSmsAdapter implements SmsPort {
  constructor(
    private readonly config: {
      providerName: 'sslwireless' | 'bulksmsbd';
      endpointUrl: string;
      apiKey: string;
      senderId: string;
    },
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const res = await fetch(this.config.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: this.config.apiKey,
        sid: this.config.senderId,
        msisdn: message.toE164.replace(/^\+/, ''),
        sms: message.body,
        csms_id: uuidv7(),
      }),
    });
    if (!res.ok) {
      throw new Error(`${this.config.providerName} SMS gateway error: HTTP ${res.status}`);
    }
    return {
      provider: this.config.providerName,
      messageId: `${this.config.providerName}-${uuidv7()}`,
      accepted: true,
    };
  }
}

/** Twilio HTTP API SMS Adapter */
export class TwilioSmsAdapter implements SmsPort {
  constructor(
    private readonly config: {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    },
  ) {}

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64',
    );
    const params = new URLSearchParams({
      To: message.toE164,
      From: this.config.fromNumber,
      Body: message.body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      throw new Error(`Twilio SMS error: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { sid?: string };
    return {
      provider: 'twilio',
      messageId: body.sid ?? `twilio-${uuidv7()}`,
      accepted: true,
    };
  }
}
